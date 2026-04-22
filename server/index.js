const express = require('express');
const mongoose = require('mongoose');
const Settings = require('./models/Settings');
const PayrollSettings = require('./models/PayrollSettings');


const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const User = require('./models/User');
const Request = require('./models/Request');
const Payroll = require('./models/Payroll');
const PayrollLog = require('./models/PayrollLog');
const ical = require('node-ical');


// Payroll Services
const { calculateEmployeePayroll, calculateAllPayroll, generateBankTransferCSV, RATES, PTKP_TABLE, getMonthName } = require('./services/payrollEngine');
const { generatePayslipPDF } = require('./services/pdfGenerator');
const { sendPayslipEmail, sendBulkPayslips } = require('./services/emailService');
const { initCronJobs, getCronStatus } = require('./services/cronJobs');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
}

// Inisialisasi Google OAuth2 Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ============================================================
// SECURITY MIDDLEWARE SETUP
// ============================================================

// 1. Helmet — Security HTTP headers (XSS, clickjacking, MIME sniffing protection)
app.use(helmet());

// 2. CORS — Restrict origins (hanya domain yang diizinkan)
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL,  // Set di .env untuk production
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Izinkan request tanpa origin (Postman, curl, mobile apps)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('CORS: Origin tidak diizinkan'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 3. Body Parser
app.use(express.json({ limit: '10mb' }));

// 4. Rate Limiting — Anti brute-force & DDoS
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 menit
    max: 200,                   // Maks 200 request per IP per 15 menit
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Terlalu banyak request. Coba lagi dalam 15 menit.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,                    // Login: maks 20 per 15 menit
    message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi nanti.' }
});

app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);

// 5. HTTPS Enforcement (Production)
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(301, `https://${req.headers.host}${req.url}`);
        }
        next();
    });
}

// ============================================================
// DATABASE CONNECTION
// ============================================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ Database connected');
        // Initialize Cron Jobs after DB is ready
        initCronJobs();
    })
    .catch(err => console.log('❌ Database error:', err.message));

// ============================================================
// INLINE MODELS (Attendance & Settings)
// ============================================================
const Attendance = mongoose.model('Attendance', new mongoose.Schema({
    email: String,
    name: String,
    profilePicture: String,
    latitude: Number,
    longitude: Number,
    type: { type: String, enum: ['clock_in', 'clock_out'], default: 'clock_in' },
    timestamp: { type: Date, default: Date.now }
}));


// Helper to get or init dynamic settings

async function getDynamicSetting(key, defaultValue) {
    try {
        const setting = await Settings.findOne({ key });
        return (setting && setting.value !== undefined && setting.value !== null) ? setting.value : defaultValue;

    } catch (e) {
        return defaultValue;
    }
}


// ============================================================
// SECURITY HELPERS
// ============================================================

// Escape regex special characters to prevent ReDoS & NoSQL injection
function escapeRegex(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Safe case-insensitive email query (with injection protection)
function emailQuery(email) {
    if (!email || typeof email !== 'string') return { email: '' };
    return { email: { $regex: new RegExp("^" + escapeRegex(email.trim()) + "$", "i") } };
}

// ============================================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ============================================================

// Verify Google JWT Token
async function verifyGoogleToken(token) {
    const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    return {
        googleId: payload['sub'],
        email: payload['email'],
        name: payload['name'],
        picture: payload['picture'],
        emailVerified: payload['email_verified'],
    };
}

// Auth Middleware — Verifies token and attaches user to req
async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
        }

        const token = authHeader.split('Bearer ')[1];
        const userData = await verifyGoogleToken(token);
        const user = await User.findOne(emailQuery(userData.email));

        if (!user) {
            return res.status(401).json({ success: false, message: 'User tidak terdaftar.' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kadaluarsa.' });
    }
}

// Role Authorization Middleware — Restricts access by role
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Akses ditolak. Role tidak memiliki izin.' });
        }
        next();
    };
}

// ============================================================
// INPUT VALIDATION HELPERS
// ============================================================
function validatePayrollInput(data) {
    const errors = [];
    if (data.baseSalary !== undefined) {
        const salary = Number(data.baseSalary);
        if (isNaN(salary) || salary < 0 || salary > 1000000000) errors.push('Gaji pokok tidak valid (0 - 1.000.000.000)');
    }
    if (data.allowance !== undefined) {
        const allowance = Number(data.allowance);
        if (isNaN(allowance) || allowance < 0 || allowance > 500000000) errors.push('Tunjangan tidak valid (0 - 500.000.000)');
    }
    if (data.role && !['employee', 'hrd', 'manager', 'admin'].includes(data.role)) {
        errors.push('Role tidak valid');
    }
    if (data.payrollStatus && !['Unpaid', 'Paid'].includes(data.payrollStatus)) {
        errors.push('Status payroll tidak valid');
    }
    if (data.leaveQuota !== undefined) {
        const quota = Number(data.leaveQuota);
        if (isNaN(quota) || quota < 0 || quota > 365) errors.push('Jatah cuti tidak valid (0-365)');
    }
    return errors;
}

function validateEmployeeInput(data) {
    const errors = [];
    if (data.role && !['employee', 'hrd', 'manager', 'admin'].includes(data.role)) {
        errors.push('Role tidak valid');
    }
    if (data.employmentStatus && !['Probation', 'Full-time', 'Contract'].includes(data.employmentStatus)) {
        errors.push('Status kerja tidak valid');
    }
    if (data.leaveQuota !== undefined) {
        const quota = Number(data.leaveQuota);
        if (isNaN(quota) || quota < 0 || quota > 365) errors.push('Jatah cuti tidak valid');
    }
    if (data.position && data.position.length > 100) errors.push('Posisi terlalu panjang (maks 100 karakter)');
    if (data.department && data.department.length > 100) errors.push('Departemen terlalu panjang (maks 100 karakter)');
    return errors;
}

function validateRequestInput(data) {
    const errors = [];
    if (!data.type || !['Leave', 'Permit', 'Sick', 'Overtime', 'Reimbursement', 'Timesheet', 'Expense', 'Other'].includes(data.type)) {
        errors.push('Tipe request tidak valid');
    }
    if (!data.reason || data.reason.trim().length === 0) errors.push('Alasan wajib diisi');
    if (data.reason && data.reason.length > 1000) errors.push('Alasan terlalu panjang (maks 1000 karakter)');
    if (data.amount !== undefined && data.amount !== '') {
        const amt = Number(data.amount);
        if (isNaN(amt) || amt < 0 || amt > 1000000000) errors.push('Jumlah tidak valid');
    }
    return errors;
}

function validateProfileInput(data) {
    const errors = [];
    if (data.name && (data.name.length < 2 || data.name.length > 100)) errors.push('Nama harus 2-100 karakter');
    if (data.bio && data.bio.length > 250) errors.push('Bio maksimal 250 karakter');
    if (data.phone && data.phone.length > 30) errors.push('Nomor HP terlalu panjang');
    if (data.address && data.address.length > 500) errors.push('Alamat terlalu panjang');
    if (data.gender && !['Male', 'Female', 'Other', '-'].includes(data.gender)) errors.push('Gender tidak valid');
    return errors;
}

// ============================================================
// ENDPOINT: Google Login & Registration
// (NO authMiddleware — this IS the login endpoint)
// ============================================================
app.post('/api/auth/google', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Token tidak ditemukan!' });
        }

        const userData = await verifyGoogleToken(token);

        // SECURITY: Check if user is pre-registered (prevent open registration)
        // If ALLOW_OPEN_REGISTRATION is not set, only existing users can login
        const existingUser = await User.findOne(emailQuery(userData.email));

        if (!existingUser && process.env.ALLOW_OPEN_REGISTRATION !== 'true') {
            return res.status(403).json({
                success: false,
                message: 'Akun belum terdaftar. Hubungi HRD untuk didaftarkan.'
            });
        }

        // Upsert user
        const user = await User.findOneAndUpdate(
            emailQuery(userData.email),
            {
                name: userData.name,
                email: userData.email,
                googleId: userData.googleId,
                profilePicture: userData.picture,
                $setOnInsert: {
                    phone: '-',
                    address: '-',
                    birthday: null,
                    gender: '-',
                    maritalStatus: '-',
                    employeeId: `EMS-${Math.floor(Math.random() * 900) + 100}`,
                    joinDate: new Date(),
                    employmentStatus: 'Probation',
                    contractEnd: new Date(new Date().setMonth(new Date().getMonth() + 3)),
                    department: 'General',
                    manager: '',
                    teamMembers: [],
                    baseSalary: 5000000,
                    allowance: 0,
                    bankAccount: '-',
                    payrollStatus: 'Unpaid',
                    leaveQuota: 0
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({
            success: true,
            message: `Selamat datang, ${user.name}!`,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                picture: user.profilePicture,
                role: user.role,
                position: user.position,
                bio: user.bio,
                phone: user.phone,
                address: user.address,
                birthday: user.birthday,
                gender: user.gender,
                maritalStatus: user.maritalStatus,
                employeeId: user.employeeId,
                joinDate: user.joinDate,
                employmentStatus: user.employmentStatus,
                contractEnd: user.contractEnd,
                department: user.department,
                manager: user.manager,
                teamMembers: user.teamMembers,
                baseSalary: user.baseSalary,
                allowance: user.allowance,
                bankAccount: user.bankAccount,
                payrollStatus: user.payrollStatus,
                leaveQuota: user.leaveQuota
            }
        });

    } catch (error) {
        console.error('Auth error:', error.message);
        res.status(401).json({
            success: false,
            message: 'Token tidak valid atau sudah kadaluarsa!',
        });
    }
});

// ============================================================
// ENDPOINT: Submit Attendance (PROTECTED)
// ============================================================
app.post('/api/attendance/submit', authMiddleware, async (req, res) => {
    try {
        const { lat, lng, type } = req.body;
        const clockType = type || 'clock_in';

        // --- TIME WINDOW VERIFICATION ---
        const now = new Date();
        const jakartaTime = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour12: false });
        const timePart = jakartaTime.split(', ')[1];
        if (timePart && clockType === 'clock_in') {
            const [h, m] = timePart.split(':').map(Number);
            if (h < 7) {
                return res.status(400).json({
                    success: false,
                    message: `Absensi Gagal: Jam operasional absen masuk dimulai pukul 07:00 WIB. (Sekarang ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} WIB)`
                });
            }
        }

        // Validate input
        if (lat === undefined || lng === undefined) {
            return res.status(400).json({ success: false, message: 'Koordinat GPS diperlukan.' });
        }
        if (type && !['clock_in', 'clock_out'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Tipe absensi tidak valid.' });
        }

        // --- GEOFENCING VERIFICATION (Logic Refined) ---
        const officeSetting = await Settings.findOne({ key: 'office_location' });
        const office = officeSetting ? officeSetting.value : { lat: -6.1528, lng: 106.7909, radius: 100 }; // Fallback to default

        // Explicitly cast to Number to avoid string comparison errors
        const userLat = Number(lat);
        const userLng = Number(lng);
        const officeLat = Number(office.lat);
        const officeLng = Number(office.lng);
        const allowedRadius = Number(office.radius || 100);

        const distance = calculateDistance(userLat, userLng, officeLat, officeLng);

        if (distance > allowedRadius) {
            console.log(`❌ [GEOFENCE] Attendance rejected for ${req.user.email}. Distance: ${Math.round(distance)}m, Allowed: ${allowedRadius}m`);
            return res.status(400).json({
                success: false,
                message: `Absensi Gagal: Anda berada di luar radius kantor! Jarak Anda: ${Math.round(distance)} meter dari titik kantor, sedangkan batas maksimal adalah ${allowedRadius} meter.`,
                debug: {
                    distance: Math.round(distance),
                    radius: allowedRadius
                }
            });
        }


        // Use authenticated user data (not from body — prevents spoofing)
        const absenBaru = new Attendance({
            email: req.user.email,
            name: req.user.name,
            profilePicture: req.user.profilePicture,
            latitude: lat,
            longitude: lng,
            type: clockType
        });


        await absenBaru.save();

        res.status(200).json({
            success: true,
            message: `Absensi ${req.user.name} berhasil dicatat!`,
            attendance: {
                email: req.user.email,
                name: req.user.name,
                latitude: lat,
                longitude: lng,
                type: clockType,
                timestamp: absenBaru.timestamp
            }
        });
    } catch (error) {
        console.error('Attendance error:', error.message);
        res.status(500).json({ success: false, message: 'Gagal mencatat absensi.' });
    }
});

// ============================================================
// ENDPOINT: Attendance History (PROTECTED)
// Admin/Manager can view any user, employees only their own
// ============================================================
app.get('/api/attendance/history', authMiddleware, async (req, res) => {
    try {
        const { email, month, year } = req.query;

        // SECURITY: Employees can only see their own history
        const targetEmail = ['admin', 'manager', 'hrd'].includes(req.user.role)
            ? (email || req.user.email)
            : req.user.email;

        let query = emailQuery(targetEmail);

        if (month !== undefined && year !== undefined) {
            const start = new Date(year, month, 1);
            const end = new Date(year, parseInt(month) + 1, 0, 23, 59, 59);
            query.timestamp = { $gte: start, $lte: end };
        }

        const records = await Attendance.find(query)
            .sort({ timestamp: -1 })
            .limit(100);

        res.status(200).json({ success: true, records });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil riwayat.' });
    }
});

// ============================================================
// ENDPOINT: Payroll Audit Logs (Admin/HRD Only)
// ============================================================
app.get('/api/payroll/logs', authMiddleware, requireRole('admin', 'hrd'), async (req, res) => {
    try {
        const logs = await PayrollLog.find({})
            .sort({ timestamp: -1 })
            .limit(50);
        res.json({ success: true, logs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil log payroll.' });
    }
});

// ============================================================
// ENDPOINT: Attendance Summary Today (PROTECTED)
// ============================================================
app.get('/api/attendance/summary/today', authMiddleware, async (req, res) => {
    try {
        const jakartaDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        const start = new Date(`${jakartaDateStr}T00:00:00.000+07:00`);
        const end = new Date(`${jakartaDateStr}T23:59:59.999+07:00`);

        const totalStaff = await User.countDocuments({});

        const todayRecords = await Attendance.find({
            timestamp: { $gte: start, $lte: end }
        });

        const usersAttendance = {};
        todayRecords.forEach(r => {
            if (!usersAttendance[r.email]) usersAttendance[r.email] = { in: false, out: false };
            if (r.type === 'clock_in') usersAttendance[r.email].in = true;
            if (r.type === 'clock_out') usersAttendance[r.email].out = true;
        });

        const isBefore7PM = new Date().getHours() < 19;
        const presentCount = Object.values(usersAttendance).filter(u => u.in && (u.out || isBefore7PM)).length;

        const lateThresholdMinutes = 9 * 60 + 15; // 09:15
        const userFirstIn = {};
        todayRecords.forEach(r => {
            if (r.type === 'clock_in') {
                if (!userFirstIn[r.email] || new Date(r.timestamp) < new Date(userFirstIn[r.email])) {
                    userFirstIn[r.email] = r.timestamp;
                }
            }
        });

        const lateCount = Object.values(userFirstIn).filter(time => {
            const d = new Date(time);
            const jakartaTime = d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour12: false });
            const timePart = jakartaTime.split(', ')[1];
            if (!timePart) return false;
            const [h, m] = timePart.split(':').map(Number);
            return (h * 60 + m) > lateThresholdMinutes;
        }).length;

        res.status(200).json({
            success: true,
            totalStaff,
            presentCount,
            lateCount
        });
    } catch (error) {
        console.error('Summary error:', error.message);
        res.status(500).json({ success: false, message: 'Gagal mengambil ringkasan absensi.' });
    }
});

// ============================================================
// ENDPOINT: Monthly Report (PROTECTED — Admin/Manager/HRD only)
// ============================================================
app.get('/api/attendance/summary/monthly', authMiddleware, requireRole('admin', 'manager', 'hrd'), async (req, res) => {
    try {
        const { month, year } = req.query;
        const start = new Date(year, month, 1);
        const end = new Date(year, parseInt(month) + 1, 0, 23, 59, 59);

        const users = await User.find({}).sort({ name: 1 });

        const attendance = await Attendance.find({
            timestamp: { $gte: start, $lte: end }
        });

        const lateThresholdMinutes = 9 * 60 + 15; // 09:15

        const reports = users.map(user => {
            const userAtt = attendance.filter(a => a.email.toLowerCase() === user.email.toLowerCase());

            const days = {};
            userAtt.forEach(a => {
                const d = new Date(a.timestamp);
                const dKey = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
                if (!days[dKey]) days[dKey] = { in: null, out: null };
                if (a.type === 'clock_in') {
                    if (!days[dKey].in || new Date(a.timestamp) < new Date(days[dKey].in)) {
                        days[dKey].in = a.timestamp;
                    }
                }
                if (a.type === 'clock_out') {
                    if (!days[dKey].out || new Date(a.timestamp) > new Date(days[dKey].out)) {
                        days[dKey].out = a.timestamp;
                    }
                }
            });

            let totalHours = 0;
            let daysPresent = 0;
            let lateDays = 0;

            const jakartaTodayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
            const nowJakarta = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));

            Object.entries(days).forEach(([dateStr, times]) => {
                const isToday = dateStr === jakartaTodayStr;
                const isPast7PM = nowJakarta.getHours() >= 19;

                let isValid = false;
                if (times.in && times.out) {
                    isValid = true;
                    totalHours += Math.abs(new Date(times.out) - new Date(times.in)) / (1000 * 60 * 60);
                } else if (times.in && isToday && !isPast7PM) {
                    isValid = true;
                }

                if (isValid) {
                    daysPresent++;
                    const d = new Date(times.in);
                    const jakartaTime = d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour12: false });
                    const timePart = jakartaTime.split(', ')[1];
                    if (timePart) {
                        const [h, m] = timePart.split(':').map(Number);
                        if ((h * 60 + m) > lateThresholdMinutes) {
                            lateDays++;
                        }
                    }
                }
            });

            return {
                id: user._id,
                name: user.name,
                email: user.email,
                position: user.position || 'Employee',
                profilePicture: user.profilePicture || null,
                daysPresent,
                lateDays,
                totalHours: totalHours.toFixed(1),
                attendanceRate: ((daysPresent / 22) * 100).toFixed(0)
            };
        });

        res.json({ success: true, reports });
    } catch (error) {
        console.error('Monthly report error:', error.message);
        res.status(500).json({ success: false, message: 'Gagal mengambil laporan bulanan.' });
    }
});

// ============================================================
// ENDPOINT: Employees List (PROTECTED — filtered by role)
// ============================================================
app.get('/api/employees', authMiddleware, async (req, res) => {
    try {
        const isPrivileged = ['admin', 'hrd', 'manager'].includes(req.user.role);

        // SECURITY: Filter sensitive fields based on role
        const projection = isPrivileged
            ? '-googleId -__v'
            : 'name email position department profilePicture employeeId role bio phone teamMembers manager joinDate employmentStatus contractEnd leaveQuota';

        const employees = await User.find({}).select(projection).sort({ name: 1 });
        res.status(200).json({ success: true, employees });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil daftar karyawan.' });
    }
});

// ============================================================
// ENDPOINT: Update Employee (PROTECTED — Admin/Manager/HRD only)
// ============================================================
app.put('/api/employees/:id', authMiddleware, requireRole('admin', 'manager', 'hrd'), async (req, res) => {
    try {
        const { id } = req.params;
        const { position, department, role, employeeId, employmentStatus, manager, teamMembers, leaveQuota, contractEnd } = req.body;

        // SECURITY: Input validation
        const validationErrors = validateEmployeeInput(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: validationErrors.join(', ') });
        }

        const oldEmployee = await User.findById(id);
        if (!oldEmployee) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });

        // SECURITY: Only admin can change roles
        const updateData = { position, department, employeeId, employmentStatus, manager, teamMembers, leaveQuota };
        if (role && req.user.role === 'admin') {
            updateData.role = role;
        }

        if (contractEnd !== undefined) {
            updateData.contractEnd = (contractEnd === '' || contractEnd === null) ? null : new Date(contractEnd);
        }

        const updatedEmployee = await User.findByIdAndUpdate(id, updateData, { new: true });

        // Bidirectional Team Sync
        if (manager !== oldEmployee.manager) {
            if (oldEmployee.manager) {
                await User.findOneAndUpdate(
                    { name: oldEmployee.manager },
                    { $pull: { teamMembers: { email: updatedEmployee.email } } }
                );
            }
            if (manager) {
                await User.findOneAndUpdate(
                    { name: manager },
                    {
                        $addToSet: {
                            teamMembers: {
                                name: updatedEmployee.name,
                                email: updatedEmployee.email,
                                position: updatedEmployee.position
                            }
                        }
                    }
                );
            }
        }

        if (JSON.stringify(teamMembers) !== JSON.stringify(oldEmployee.teamMembers)) {
            const oldEmails = (oldEmployee.teamMembers || []).map(m => m.email);
            const newEmails = (teamMembers || []).map(m => m.email);

            const addedMembers = newEmails.filter(email => !oldEmails.includes(email));
            if (addedMembers.length > 0) {
                await User.updateMany(
                    { email: { $in: addedMembers } },
                    { manager: updatedEmployee.name }
                );
            }

            const removedMembers = oldEmails.filter(email => !newEmails.includes(email));
            if (removedMembers.length > 0) {
                await User.updateMany(
                    { email: { $in: removedMembers }, manager: updatedEmployee.name },
                    { manager: '' }
                );
            }
        }

        res.status(200).json({ success: true, message: 'Data karyawan & tim berhasil disinkronkan!', employee: updatedEmployee });
    } catch (error) {
        console.error('Update employee error:', error.message);
        res.status(500).json({ success: false, message: 'Gagal memperbarui data karyawan.' });
    }
});

// ============================================================
// ENDPOINT: Delete Employee (PROTECTED — Admin only)
// ============================================================
app.delete('/api/employees/:id', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const deletedUser = await User.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
        }

        res.status(200).json({ success: true, message: 'Karyawan berhasil dihapus!' });
    } catch (error) {
        console.error('Delete employee error:', error.message);
        res.status(500).json({ success: false, message: 'Gagal menghapus karyawan.' });
    }
});

// ============================================================
// ENDPOINT: Update Payroll (PROTECTED — Admin/Manager/HRD only)
// ============================================================
app.put('/api/employees/:id/payroll', authMiddleware, requireRole('admin', 'manager', 'hrd'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            baseSalary, allowance, role, bankAccount, bankName, ptkpStatus,
            mealAllowanceRate, transportAllowanceRate, payrollStatus, leaveQuota, contractEnd,
            bpjsKesehatanAmount, bpjsTkAmount, pph21Amount
        } = req.body;


        // SECURITY: Input validation
        const validationErrors = validatePayrollInput(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: validationErrors.join(', ') });
        }

        const updateData = {
            baseSalary: Number(baseSalary),
            allowance: Number(allowance)
        };

        // SECURITY: Only admin can change roles via payroll
        if (role && req.user.role === 'admin') updateData.role = role;
        if (bankAccount !== undefined) updateData.bankAccount = bankAccount;
        if (bankName !== undefined) updateData.bankName = bankName;
        if (ptkpStatus && ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'].includes(ptkpStatus)) {
            updateData.ptkpStatus = ptkpStatus;
        }
        if (mealAllowanceRate !== undefined) updateData.mealAllowanceRate = Number(mealAllowanceRate);
        if (transportAllowanceRate !== undefined) updateData.transportAllowanceRate = Number(transportAllowanceRate);
        if (payrollStatus) updateData.payrollStatus = payrollStatus;
        if (leaveQuota !== undefined) updateData.leaveQuota = Number(leaveQuota);
        if (bpjsKesehatanAmount !== undefined) updateData.bpjsKesehatanAmount = Number(bpjsKesehatanAmount);
        if (bpjsTkAmount !== undefined) updateData.bpjsTkAmount = Number(bpjsTkAmount);
        if (pph21Amount !== undefined) updateData.pph21Amount = Number(pph21Amount);
        if (contractEnd !== undefined) updateData.contractEnd = (contractEnd === '' || contractEnd === null) ? null : new Date(contractEnd);


        const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
        }

        res.status(200).json({ success: true, message: 'Payroll & Kontrak berhasil diperbarui!', employee: updatedUser });
    } catch (error) {
        console.error('Payroll error:', error.message);
        res.status(500).json({ success: false, message: 'Gagal memperbarui payroll.' });
    }
});

// ============================================================
// ENDPOINT: Update User Profile (PROTECTED — IDOR FIXED)
// User can only edit THEIR OWN profile
// ============================================================
app.put('/api/users/profile', authMiddleware, async (req, res) => {
    try {
        const { name, bio, phone, address, birthday, gender, maritalStatus } = req.body;

        // SECURITY: Input validation
        const validationErrors = validateProfileInput(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: validationErrors.join(', ') });
        }

        // SECURITY FIX (IDOR): Use authenticated user's email, NOT from req.body
        const updatedUser = await User.findOneAndUpdate(
            { _id: req.user._id },
            { name, bio, phone, address, birthday, gender, maritalStatus },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
        }

        res.status(200).json({ success: true, message: 'Profil berhasil diperbarui!', user: updatedUser });
    } catch (error) {
        console.error('Profile error:', error.message);
        res.status(500).json({ success: false, message: 'Gagal memperbarui profil.' });
    }
});

// ============================================================
// ENDPOINT: Submit Request (PROTECTED)
// Uses authenticated user data to prevent spoofing
// ============================================================
app.post('/api/requests', authMiddleware, async (req, res) => {
    try {
        const { type, startDate, endDate, reason, amount } = req.body;

        // SECURITY: Input validation
        const validationErrors = validateRequestInput(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: validationErrors.join(', ') });
        }

        // SECURITY: Use authenticated user's data, not from body
        const newRequest = new Request({
            email: req.user.email,
            name: req.user.name,
            type, startDate, endDate, reason, amount
        });
        await newRequest.save();
        res.status(201).json({ success: true, message: 'Request submitted successfully!', request: newRequest });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to submit request.' });
    }
});

// ============================================================
// ENDPOINT: Personal Requests (PROTECTED)
// ============================================================
app.get('/api/requests', authMiddleware, async (req, res) => {
    try {
        // SECURITY: Only show own requests (use authenticated user's email)
        const requests = await Request.find(emailQuery(req.user.email)).sort({ timestamp: -1 });
        res.status(200).json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch personal requests.' });
    }
});

// ============================================================
// ENDPOINT: Pending Requests (PROTECTED — Admin/Manager/HRD)
// ============================================================
app.get('/api/requests/pending', authMiddleware, requireRole('admin', 'manager', 'hrd'), async (req, res) => {
    try {
        const requests = await Request.aggregate([
            { $match: { status: 'Pending' } },
            { $sort: { timestamp: -1 } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'email',
                    foreignField: 'email',
                    as: 'userData'
                }
            },
            {
                $addFields: {
                    profilePicture: { $arrayElemAt: ['$userData.profilePicture', 0] }
                }
            },
            {
                $project: { userData: 0 }
            }
        ]);
        res.status(200).json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch pending requests.' });
    }
});

// ============================================================
// ENDPOINT: Active Leave Today (PROTECTED)
// ============================================================
app.get('/api/requests/active-leave', authMiddleware, async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const activeLeaves = await Request.aggregate([
            {
                $match: {
                    status: 'Approved',
                    type: { $in: ['Leave', 'Sick', 'Permit'] },
                    startDate: { $lte: todayEnd },
                    endDate: { $gte: todayStart }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'email',
                    foreignField: 'email',
                    as: 'userData'
                }
            },
            {
                $addFields: {
                    profilePicture: { $arrayElemAt: ['$userData.profilePicture', 0] }
                }
            },
            {
                $project: { userData: 0 }
            }
        ]);

        res.status(200).json({ success: true, count: activeLeaves.length, data: activeLeaves });
    } catch (error) {
        console.error('Active leave error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch active leaves.' });
    }
});

// ============================================================
// ENDPOINT: Recent Requests Feed (PROTECTED)
// ============================================================
app.get('/api/requests/recent', authMiddleware, async (req, res) => {
    try {
        const recentRequests = await Request.aggregate([
            { $match: { type: { $in: ['Leave', 'Sick', 'Permit'] } } },
            { $sort: { timestamp: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: 'email',
                    foreignField: 'email',
                    as: 'userData'
                }
            },
            {
                $addFields: {
                    profilePicture: { $arrayElemAt: ['$userData.profilePicture', 0] }
                }
            },
            {
                $project: { userData: 0 }
            }
        ]);

        res.status(200).json({ success: true, activities: recentRequests });
    } catch (error) {
        console.error('Recent requests error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch recent activities.' });
    }
});

// ============================================================
// ENDPOINT: Schedule & Holidays (PROTECTED)
// ============================================================
app.get('/api/schedule/holidays', authMiddleware, async (req, res) => {
    try {
        const iCalUrl = 'https://calendar.google.com/calendar/ical/id.indonesian%23holiday%40group.v.calendar.google.com/public/basic.ics';

        ical.fromURL(iCalUrl, {}, function (err, data) {
            if (err) {
                console.error('iCal error:', err.message);
                return res.status(500).json({ success: false, message: 'Failed to fetch calendar data' });
            }

            const holidays = [];
            const currentYear = new Date().getFullYear();

            for (let k in data) {
                if (data.hasOwnProperty(k)) {
                    const ev = data[k];
                    if (data[k].type === 'VEVENT') {
                        const eventDate = new Date(ev.start);
                        eventDate.setHours(eventDate.getHours() + 12);

                        if (eventDate.getFullYear() === currentYear || eventDate.getFullYear() === currentYear + 1) {
                            holidays.push({
                                date: eventDate.toISOString().split('T')[0],
                                summary: ev.summary
                            });
                        }
                    }
                }
            }

            res.status(200).json({ success: true, holidays });
        });

    } catch (error) {
        console.error('Schedule error:', error.message);
        res.status(500).json({ success: false, message: 'Server error parsing schedule' });
    }
});

// ============================================================
// ENDPOINT: Update Request Status (PROTECTED — Admin/Manager/HRD)
// ============================================================
app.put('/api/requests/:id/status', authMiddleware, requireRole('admin', 'manager', 'hrd'), async (req, res) => {
    try {
        const { status } = req.body;
        const { id } = req.params;

        // SECURITY: Validate status value
        if (!['Approved', 'Rejected', 'Returned'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status tidak valid.' });
        }

        const oldRequest = await Request.findById(id);
        if (!oldRequest) return res.status(404).json({ success: false, message: 'Request not found.' });

        let unpaidDays = 0;
        let isUnpaid = false;

        // Special logic for LEAVE approval: check quota
        if (status === 'Approved' && oldRequest.status !== 'Approved' && oldRequest.type === 'Leave') {
            const user = await User.findOne(emailQuery(oldRequest.email));
            if (user) {
                const start = new Date(oldRequest.startDate);
                const end = new Date(oldRequest.endDate);
                const requestedDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;

                // Calculate how many days can be "Paid" from quota
                const currentQuota = Math.max(0, user.leaveQuota || 0);
                const paidDays = Math.min(requestedDays, currentQuota);

                unpaidDays = Math.max(0, requestedDays - paidDays);
                isUnpaid = unpaidDays > 0;

                // Deduct only the paid portion from the quota
                if (paidDays > 0) {
                    await User.findOneAndUpdate(
                        emailQuery(oldRequest.email),
                        { $inc: { leaveQuota: -paidDays } }
                    );
                }
            }
        }

        const updatedRequest = await Request.findByIdAndUpdate(id, {
            status,
            unpaidDays,
            isUnpaid
        }, { new: true });

        res.status(200).json({ success: true, message: `Request ${status}!`, request: updatedRequest });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update request status.' });
    }
});

// ============================================================
// OFFICE SETTINGS ENDPOINTS (PROTECTED)
// ============================================================
app.get('/api/settings/office', authMiddleware, async (req, res) => {
    try {
        const setting = await Settings.findOne({ key: 'office_location' });
        if (!setting) {
            return res.json({ success: true, data: { lat: -6.1528, lng: 106.7909, radius: 100, name: 'EMS Office' } });
        }
        res.json({ success: true, data: setting.value });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get settings.' });
    }
});

app.put('/api/settings/office', authMiddleware, requireRole('admin', 'hrd'), async (req, res) => {
    try {
        const { lat, lng, radius, name } = req.body;

        // SECURITY: Validate coordinates
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        const parsedRadius = parseInt(radius) || 100;

        if (isNaN(parsedLat) || isNaN(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
            return res.status(400).json({ success: false, message: 'Koordinat tidak valid.' });
        }
        if (parsedRadius < 10 || parsedRadius > 5000) {
            return res.status(400).json({ success: false, message: 'Radius harus antara 10-5000 meter.' });
        }

        const setting = await Settings.findOneAndUpdate(
            { key: 'office_location' },
            {
                value: {
                    lat: parsedLat,
                    lng: parsedLng,
                    radius: parsedRadius,
                    name: name || 'EMS Office'
                },
                updatedAt: new Date() // Force timestamp update for sync visibility
            },
            { upsert: true, new: true, runValidators: true }
        );
        console.log(`✅ [SETTINGS] Office location updated: ${name} (${parsedLat}, ${parsedLng}) R:${parsedRadius}`);

        res.json({ success: true, message: 'Lokasi kantor diperbarui!', data: setting.value });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update settings.' });
    }
});

// GET & PUT Work Days (PROTECTED)
app.get('/api/settings/workdays', authMiddleware, async (req, res) => {
    try {
        const setting = await Settings.findOne({ key: 'work_days' });
        if (!setting) {
            return res.json({ success: true, data: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] });
        }
        res.json({ success: true, data: setting.value });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get workdays.' });
    }
});

app.put('/api/settings/workdays', authMiddleware, requireRole('admin', 'hrd'), async (req, res) => {
    try {
        const { days } = req.body;

        // SECURITY: Validate days array
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        if (!Array.isArray(days) || days.some(d => !validDays.includes(d))) {
            return res.status(400).json({ success: false, message: 'Hari kerja tidak valid.' });
        }

        const setting = await Settings.findOneAndUpdate(
            { key: 'work_days' },
            { value: days },
            { upsert: true, new: true }
        );
        res.json({ success: true, message: 'Hari kerja diperbarui!', data: setting.value });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update workdays.' });
    }
});

// ============================================================
// PAYROLL AUTOMATION ENDPOINTS
// ============================================================

// --- Calculate Payroll (Manual Trigger) ---
app.post('/api/payroll/calculate', authMiddleware, requireRole('admin', 'hrd'), async (req, res) => {
    try {
        const { month, year, ids } = req.body;
        const targetMonth = month !== undefined ? parseInt(month) : new Date().getMonth();
        const targetYear = year !== undefined ? parseInt(year) : new Date().getFullYear();

        if (targetMonth < 0 || targetMonth > 11 || targetYear < 2020 || targetYear > 2100) {
            return res.status(400).json({ success: false, message: 'Bulan atau tahun tidak valid.' });
        }

        const result = await calculateAllPayroll(targetMonth, targetYear, req.user.email, ids);
        res.json({
            success: true,
            message: `Payroll ${getMonthName(targetMonth)} ${targetYear} berhasil dihitung untuk ${result.results.length} karyawan.`,
            data: {
                total: result.total,
                calculated: result.results.length,
                errors: result.errors.length,
                errorDetails: result.errors
            }
        });
    } catch (error) {
        console.error('Payroll calculate error:', error.message);
        res.status(500).json({ success: false, message: 'Gagal menghitung payroll.' });
    }
});

// --- Get Payroll Records (Admin/HRD) ---
app.get('/api/payroll/records', authMiddleware, requireRole('admin', 'hrd', 'manager'), async (req, res) => {
    try {
        const { month, year } = req.query;
        const targetMonth = month !== undefined ? parseInt(month) : new Date().getMonth();
        const targetYear = year !== undefined ? parseInt(year) : new Date().getFullYear();

        const records = await Payroll.find({
            'period.month': targetMonth,
            'period.year': targetYear
        }).sort({ name: 1 });

        const summary = {
            totalGross: records.reduce((s, r) => s + r.grossPay, 0),
            totalDeductions: records.reduce((s, r) => s + r.totalDeductions, 0),
            totalNet: records.reduce((s, r) => s + r.netPay, 0),
            totalEmployees: records.length,
            statusCounts: {
                draft: records.filter(r => r.status === 'Draft').length,
                finalized: records.filter(r => r.status === 'Finalized').length,
                paid: records.filter(r => r.status === 'Paid').length
            }
        };

        res.json({ success: true, records, summary });
    } catch (error) {
        console.error('Payroll records error:', error.message);
        res.status(500).json({ success: false, message: 'Gagal mengambil data payroll.' });
    }
});

// --- Get My Payslip ---
app.get('/api/payroll/my-payslip', authMiddleware, async (req, res) => {
    try {
        const { month, year } = req.query;
        const targetMonth = month !== undefined ? parseInt(month) : new Date().getMonth();
        const targetYear = year !== undefined ? parseInt(year) : new Date().getFullYear();

        const payslip = await Payroll.findOne({
            email: { $regex: new RegExp("^" + req.user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") },
            'period.month': targetMonth,
            'period.year': targetYear
        });

        // Also get history (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const history = await Payroll.find({
            email: { $regex: new RegExp("^" + req.user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") },
            calculatedAt: { $gte: sixMonthsAgo }
        }).sort({ 'period.year': -1, 'period.month': -1 }).limit(6);

        res.json({ success: true, payslip, history });
    } catch (error) {
        console.error('My payslip error:', error.message);
        res.status(500).json({ success: false, message: 'Gagal mengambil payslip.' });
    }
});

// --- Finalize Payroll ---
app.put('/api/payroll/:id/finalize', authMiddleware, requireRole('admin', 'hrd'), async (req, res) => {
    try {
        const record = await Payroll.findByIdAndUpdate(
            req.params.id,
            { status: 'Finalized', updatedAt: new Date() },
            { new: true }
        );
        if (!record) return res.status(404).json({ success: false, message: 'Record tidak ditemukan.' });

        // Audit Log
        await new PayrollLog({
            action: 'FINALIZE_SINGLE',
            performedBy: req.user.name,
            period: record.period,
            details: `Finalized payroll for ${record.name}.`
        }).save();

        res.json({ success: true, message: `Payroll ${record.name} berhasil di-finalize.`, record });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal finalize payroll.' });
    }
});

// --- Finalize ALL Payroll for a period ---
app.put('/api/payroll/finalize-all', authMiddleware, requireRole('admin', 'hrd'), async (req, res) => {
    try {
        const { month, year, ids } = req.body;
        const targetMonth = month !== undefined ? parseInt(month) : new Date().getMonth();
        const targetYear = year !== undefined ? parseInt(year) : new Date().getFullYear();

        const query = { 'period.month': targetMonth, 'period.year': targetYear, status: 'Draft' };
        if (ids && ids.length > 0) {
            query._id = { $in: ids };
        }

        const result = await Payroll.updateMany(query, { status: 'Finalized', updatedAt: new Date() });

        // Audit Log
        await new PayrollLog({
            action: 'FINALIZE_ALL',
            performedBy: req.user.name,
            period: { month: targetMonth, year: targetYear },
            entitiesCount: result.modifiedCount,
            details: `Finalized ${result.modifiedCount} payroll records.`
        }).save();

        res.json({ success: true, message: `${result.modifiedCount} payroll records di-finalize.`, modified: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal finalize semua payroll.' });
    }
});

// --- Mark Payroll as Paid ---
app.put('/api/payroll/:id/mark-paid', authMiddleware, requireRole('admin', 'hrd'), async (req, res) => {
    try {
        const record = await Payroll.findOneAndUpdate(
            { _id: req.params.id, status: 'Finalized' },
            { status: 'Paid', updatedAt: new Date() },
            { new: true }
        );

        if (!record) {
            return res.status(400).json({
                success: false,
                message: 'Record tidak ditemukan atau belum berstatus Finalized. Harap finalize dahulu.'
            });
        }

        // Also update User payrollStatus
        await User.findByIdAndUpdate(record.employeeId, { payrollStatus: 'Paid' });

        // Audit Log
        await new PayrollLog({
            action: 'MARK_PAID_SINGLE',
            performedBy: req.user.name,
            period: record.period,
            details: `Marked payroll for ${record.name} as PAID.`
        }).save();

        res.json({ success: true, message: `Payroll ${record.name} ditandai PAID.`, record });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mark as paid.' });
    }
});

// --- Mark ALL as Paid ---
app.put('/api/payroll/mark-all-paid', authMiddleware, requireRole('admin', 'hrd'), async (req, res) => {
    try {
        const { month, year, ids } = req.body;
        const targetMonth = month !== undefined ? parseInt(month) : new Date().getMonth();
        const targetYear = year !== undefined ? parseInt(year) : new Date().getFullYear();

        // Only process records that are already Finalized
        const query = {
            'period.month': targetMonth,
            'period.year': targetYear,
            status: 'Finalized'
        };

        if (ids && ids.length > 0) {
            query._id = { $in: ids };
        }

        const records = await Payroll.find(query, { employeeId: 1 });
        const employeeIds = records.map(r => r.employeeId);

        // Bulk update Payrolls
        await Payroll.updateMany(query, { status: 'Paid', updatedAt: new Date() });

        // Bulk update Users
        if (employeeIds.length > 0) {
            await User.updateMany({ _id: { $in: employeeIds } }, { payrollStatus: 'Paid' });
        }

        // Audit Log
        await new PayrollLog({
            action: 'MARK_PAID_ALL',
            performedBy: req.user.name,
            period: { month: targetMonth, year: targetYear },
            entitiesCount: records.length,
            details: `Marked ${records.length} payroll records as PAID.`
        }).save();

        res.json({ success: true, message: `${records.length} payroll records ditandai PAID.`, modified: records.length });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mark all as paid.' });
    }
});

// --- Mark Payroll as Unpaid (Revert) ---
app.put('/api/payroll/:id/mark-unpaid', authMiddleware, requireRole('admin', 'hrd'), async (req, res) => {
    try {
        const record = await Payroll.findByIdAndUpdate(
            req.params.id,
            { status: 'Draft', updatedAt: new Date() },
            { new: true }
        );
        if (!record) return res.status(404).json({ success: false, message: 'Record tidak ditemukan.' });

        // Also update User payrollStatus
        await User.findByIdAndUpdate(record.employeeId, { payrollStatus: 'Unpaid' });

        // Audit Log
        await new PayrollLog({
            action: 'MARK_UNPAID_SINGLE',
            performedBy: req.user.name,
            period: record.period,
            details: `Marked payroll for ${record.name} as UNPAID.`
        }).save();

        res.json({ success: true, message: `Payroll ${record.name} ditandai UNPAID.`, record });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mark as unpaid.' });
    }
});

// --- Mark ALL as Unpaid (Bulk Revert) ---
app.put('/api/payroll/mark-all-unpaid', authMiddleware, requireRole('admin', 'hrd'), async (req, res) => {
    try {
        const { month, year, ids } = req.body;
        const targetMonth = month !== undefined ? parseInt(month) : new Date().getMonth();
        const targetYear = year !== undefined ? parseInt(year) : new Date().getFullYear();

        const query = {
            'period.month': targetMonth,
            'period.year': targetYear,
            status: { $in: ['Paid', 'Finalized'] }
        };
        if (ids && ids.length > 0) {
            query._id = { $in: ids };
        }

        const records = await Payroll.find(query, { employeeId: 1 });
        const employeeIds = records.map(r => r.employeeId);

        // Bulk update Payrolls
        await Payroll.updateMany(query, { status: 'Draft', updatedAt: new Date() });

        // Bulk update Users
        if (employeeIds.length > 0) {
            await User.updateMany({ _id: { $in: employeeIds } }, { payrollStatus: 'Unpaid' });
        }

        // Audit Log
        await new PayrollLog({
            action: 'MARK_UNPAID_ALL',
            performedBy: req.user.name,
            period: { month: targetMonth, year: targetYear },
            entitiesCount: records.length,
            details: `Marked ${records.length} payroll records as UNPAID.`
        }).save();

        res.json({ success: true, message: `${records.length} payroll records ditandai UNPAID (Draft).`, modified: records.length });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mark all as unpaid.' });
    }
});


// --- Download PDF Payslip ---
app.get('/api/payroll/:id/pdf', authMiddleware, async (req, res) => {
    try {
        const record = await Payroll.findById(req.params.id);
        if (!record) return res.status(404).json({ success: false, message: 'Record tidak ditemukan.' });

        // Security: Only own payslip or admin/hrd
        const isPrivileged = ['admin', 'hrd', 'manager'].includes(req.user.role);
        if (!isPrivileged && record.email.toLowerCase() !== req.user.email.toLowerCase()) {
            return res.status(403).json({ success: false, message: 'Akses ditolak.' });
        }

        const pdfBuffer = await generatePayslipPDF(record);
        const filename = `Payslip_${record.name.replace(/\s+/g, '_')}_${getMonthName(record.period.month)}_${record.period.year}.pdf`;

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF generate error:', error.message);
        res.status(500).json({ success: false, message: 'Gagal generate PDF.' });
    }
});

// --- Send Email Blast ---
app.post('/api/payroll/send-emails', authMiddleware, requireRole('admin', 'hrd'), async (req, res) => {
    try {
        const { month, year, ids } = req.body;
        const targetMonth = month !== undefined ? parseInt(month) : new Date().getMonth();
        const targetYear = year !== undefined ? parseInt(year) : new Date().getFullYear();

        const query = {
            'period.month': targetMonth,
            'period.year': targetYear,
            status: { $in: ['Finalized', 'Paid'] }
        };

        if (ids && ids.length > 0) {
            query._id = { $in: ids };
        }

        const records = await Payroll.find(query);

        if (records.length === 0) {
            return res.status(400).json({ success: false, message: 'Tidak ada payroll yang siap dikirim. Pastikan sudah di-finalize.' });
        }

        const result = await sendBulkPayslips(records, generatePayslipPDF);

        // Audit Log
        await new PayrollLog({
            action: 'SEND_EMAILS',
            performedBy: req.user.name,
            period: { month: targetMonth, year: targetYear },
            entitiesCount: result.sent,
            details: `Sent ${result.sent} emails. Failed: ${result.failed}.`
        }).save();

        res.json({
            success: true,
            message: `Email blast selesai: ${result.sent} terkirim, ${result.failed} gagal, ${result.skipped} dilewati.`,
            data: result
        });
    } catch (error) {
        console.error('Email blast error:', error.message);
        res.status(500).json({ success: false, message: 'Gagal mengirim email blast.' });
    }
});

// --- Export Bank Transfer File ---
app.get('/api/payroll/export-bank', authMiddleware, requireRole('admin', 'hrd'), async (req, res) => {
    try {
        const { month, year, format, ids } = req.query;
        const targetMonth = month !== undefined ? parseInt(month) : new Date().getMonth();
        const targetYear = year !== undefined ? parseInt(year) : new Date().getFullYear();

        let idArray = [];
        if (ids) {
            idArray = ids.split(',').filter(id => id.trim().length > 0);
        }

        const result = await generateBankTransferCSV(targetMonth, targetYear, format || 'bca', idArray);

        if (!result.content || result.content.split('\n').length <= 2) {
            return res.status(400).json({ success: false, message: 'Tidak ada data payroll yang tersedia untuk diekspor (pastikan sudah di-Finalized atau pilih baris tertentu).' });
        }

        // Audit Log
        await new PayrollLog({
            action: 'EXPORT_BANK',
            performedBy: req.user.name,
            period: { month: targetMonth, year: targetYear },
            details: `Exported bank file in ${format || 'bca'} format.`
        }).save();

        const contentType = (format || 'mandiri') === 'mandiri' ? 'text/plain' : 'text/csv';
        res.set({
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${result.filename}"`,
        });
        res.send(result.content);
    } catch (error) {
        console.error('Bank export error:', error.message);
        res.status(500).json({ success: false, message: 'Gagal export file bank.' });
    }
});

// ============================================================
// ENDPOINT: Payroll Settings (PROTECTED - Admin/HRD)
// ============================================================
app.get('/api/settings/payroll', authMiddleware, requireRole('admin', 'hrd'), async (req, res) => {
    try {
        let settings = await PayrollSettings.findOne();

        // If no settings exist yet, create default one
        if (!settings) {
            settings = await PayrollSettings.create({});
        }

        res.json({
            success: true,
            settings: {
                LATE_PENALTY_PER_DAY: settings.latePenaltyPerDay || 50000,
                OVERTIME_RATE_PER_HOUR: settings.overtimeRatePerHour || 30000,
                MEAL_ALLOWANCE_PER_DAY: settings.mealAllowancePerDay || 25000,
                TRANSPORT_ALLOWANCE_PER_DAY: settings.transportAllowancePerDay || 20000,
            },
            fullSettings: settings,
            defaults: RATES
        });
    } catch (error) {
        console.error('Fetch payroll settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payroll settings.' });
    }
});


app.put('/api/settings/payroll', authMiddleware, requireRole('admin', 'hrd'), async (req, res) => {
    try {
        const { key, value, settings } = req.body;

        const updateData = { updatedAt: new Date(), updatedBy: req.user.email };

        if (settings) {
            // Bulk update all settings
            if (settings.LATE_PENALTY_PER_DAY !== undefined) updateData.latePenaltyPerDay = settings.LATE_PENALTY_PER_DAY;
            if (settings.OVERTIME_RATE_PER_HOUR !== undefined) updateData.overtimeRatePerHour = settings.OVERTIME_RATE_PER_HOUR;
            if (settings.MEAL_ALLOWANCE_PER_DAY !== undefined) updateData.mealAllowancePerDay = settings.MEAL_ALLOWANCE_PER_DAY;
            if (settings.TRANSPORT_ALLOWANCE_PER_DAY !== undefined) updateData.transportAllowancePerDay = settings.TRANSPORT_ALLOWANCE_PER_DAY;
        } else if (key) {
            // Legacy single key update
            if (key === 'LATE_PENALTY_PER_DAY') updateData.latePenaltyPerDay = value;
            else if (key === 'OVERTIME_RATE_PER_HOUR') updateData.overtimeRatePerHour = value;
            else if (key === 'MEAL_ALLOWANCE_PER_DAY') updateData.mealAllowancePerDay = value;
            else if (key === 'TRANSPORT_ALLOWANCE_PER_DAY') updateData.transportAllowancePerDay = value;
            else {
                return res.status(400).json({ success: false, message: 'Setting key tidak dikenal.' });
            }
        } else {
            return res.status(400).json({ success: false, message: 'Data setting tidak valid.' });
        }

        await PayrollSettings.findOneAndUpdate(
            {}, // Single record
            { $set: updateData },
            { upsert: true, new: true }
        );

        res.json({ success: true, message: 'Pengaturan payroll berhasil diperbarui.' });
    } catch (error) {
        console.error('Update payroll settings error:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui settings.' });
    }
});







// --- Cron Job Status ---
app.get('/api/payroll/cron-status', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const status = getCronStatus();
        res.json({ success: true, data: status });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil status cron.' });
    }
});

// Export for Vercel Serverless Functions
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;