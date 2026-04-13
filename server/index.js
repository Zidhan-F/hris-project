const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { OAuth2Client } = require('google-auth-library');
const User = require('./models/User');
const Request = require('./models/Request');
const ical = require('node-ical');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Inisialisasi Google OAuth2 Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.use(cors());
app.use(express.json());

// 1. Koneksi Database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ DATABASE AKTIF: ' + process.env.MONGO_URI))
  .catch(err => console.log('❌ DATABASE ERROR:', err));

// 2. Definisi Model Attendance
const Attendance = mongoose.model('Attendance', new mongoose.Schema({
    email: String,
    name: String,
    profilePicture: String,
    latitude: Number,
    longitude: Number,
    type: { type: String, enum: ['clock_in', 'clock_out'], default: 'clock_in' },
    timestamp: { type: Date, default: Date.now }
}));

// Settings Model (office location)
const Settings = mongoose.model('Settings', new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    value: mongoose.Schema.Types.Mixed
}));

// ============================================================
// FUNGSI HELPER: Verifikasi Token JWT dari Google
// ============================================================
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

// ============================================================
// 3. ENDPOINT BARU: Verifikasi Google Login & Simpan User
// ============================================================
app.post('/api/auth/google', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Token tidak ditemukan!' });
        }

        // MEMBEDAH (decode) JWT Token dari Google
        console.log('🔍 Membedah token JWT dari Google...');
        const userData = await verifyGoogleToken(token);
        console.log('✅ Token valid! User:', userData.name, '(' + userData.email + ')');

        // Simpan atau Update user di database (upsert)
        // Jika user baru, kita tambahkan data contoh untuk profil
        const user = await User.findOneAndUpdate(
            { email: userData.email },
            {
                name: userData.name,
                email: userData.email,
                googleId: userData.googleId,
                profilePicture: userData.picture,
                $setOnInsert: {
                    phone: '0812-3456-7890',
                    address: 'Jl. Sudirman No. 123, Jakarta Selatan',
                    birthday: new Date('1995-05-20'),
                    gender: 'Male',
                    maritalStatus: 'Single',
                    employeeId: `EMS-${Math.floor(Math.random() * 900) + 100}`,
                    joinDate: new Date(),
                    employmentStatus: 'Full-time',
                    department: 'Technology',
                    manager: '',
                    teamMembers: [],
                    baseSalary: 5000000,
                    allowance: 0,
                    bankAccount: '-',
                    payrollStatus: 'Unpaid'
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log('📥 User tersimpan di MongoDB:', user.name);

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
                payrollStatus: user.payrollStatus
            }
        });

    } catch (error) {
        console.error('❌ Gagal verifikasi token:', error.message);
        res.status(401).json({
            success: false,
            message: 'Token tidak valid atau sudah kadaluarsa!',
        });
    }
});

// ============================================================
// 4. ENDPOINT: Simpan Data Absensi (dengan token asli)
// ============================================================
app.post('/api/attendance/submit', async (req, res) => {
    try {
        const { token, lat, lng, type } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Token diperlukan untuk absensi!' });
        }

        // Verifikasi token untuk mendapatkan email ASLI
        const userData = await verifyGoogleToken(token);
        console.log(`📍 Absensi dari: ${userData.name} (${userData.email})`);

        // MEMBUAT DATA BARU dengan email ASLI (bukan dummy!)
        const absenBaru = new Attendance({
            email: userData.email,       // ← Email asli dari Google!
            name: userData.name,         // ← Nama asli dari Google!
            profilePicture: userData.picture,
            latitude: lat,
            longitude: lng,
            type: type || 'clock_in'
        });

        // MENYIMPAN KE MONGODB
        await absenBaru.save();

        console.log("📥 SUKSES: Data absensi asli masuk ke MongoDB!");
        res.status(200).json({
            success: true,
            message: `Absensi ${userData.name} berhasil dicatat!`,
            attendance: {
                email: userData.email,
                name: userData.name,
                latitude: lat,
                longitude: lng,
                type: type || 'clock_in',
                timestamp: absenBaru.timestamp
            }
        });
    } catch (error) {
        console.error('❌ Error absensi:', error.message);
        res.status(500).json({ success: false, message: 'Gagal mencatat absensi.' });
    }
});

// ============================================================
// 5. ENDPOINT: Ambil Riwayat Absensi User (dengan Filter)
// ============================================================
app.get('/api/attendance/history', async (req, res) => {
    try {
        const { email, month, year } = req.query;
        console.log('🔍 Mengambil riwayat untuk:', email, { month, year });
        
        let query = { email: { $regex: new RegExp("^" + email + "$", "i") } };

        if (month !== undefined && year !== undefined) {
            const start = new Date(year, month, 1);
            const end = new Date(year, parseInt(month) + 1, 0, 23, 59, 59);
            query.timestamp = { $gte: start, $lte: end };
        }

        const records = await Attendance.find(query)
            .sort({ timestamp: -1 })
            .limit(100);
            
        console.log(`✅ Ditemukan ${records.length} rekaman.`);
        res.status(200).json({ success: true, records });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil riwayat.' });
    }
});

// ============================================================
// 5.5 ENDPOINT: Ambil Ringkasan Absensi Hari Ini (Dashboard)
// ============================================================
app.get('/api/attendance/summary/today', async (req, res) => {
    try {
        const today = new Date();
        const start = new Date(today.setHours(0, 0, 0, 0));
        const end = new Date(today.setHours(23, 59, 59, 999));

        // 1. Total Karyawan Terdaftar
        const totalStaff = await User.countDocuments({});

        // 2. Karyawan yang Absen Masuk Hari Ini (Unique)
        // Dihitung hadir jika sudah clock_in DAN (masih sebelum jam 7 malam ATAU sudah clock_out)
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

        // 3. Karyawan Terlambat (Absen Masuk >= 09:30 AM)
        const lateThreshold = new Date(new Date().setHours(9, 30, 0, 0));
        const lateRecords = await Attendance.distinct('email', {
            type: 'clock_in',
            timestamp: { $gte: lateThreshold } // Jika jam >= 9:30 hari ini
        });
        const lateCount = lateRecords.length;

        res.status(200).json({
            success: true,
            totalStaff,
            presentCount,
            lateCount
        });
    } catch (error) {
        console.error('Error fetching attendance summary:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil ringkasan absensi.' });
    }
});

// ============================================================
// 5.6 ENDPOINT: Ambil Laporan Bulanan (Semua Karyawan)
// ============================================================
app.get('/api/attendance/summary/monthly', async (req, res) => {
    try {
        const { month, year } = req.query; // 0-11, 202X
        const start = new Date(year, month, 1);
        const end = new Date(year, parseInt(month) + 1, 0, 23, 59, 59);

        // 1. Ambil Semua User
        const users = await User.find({}).sort({ name: 1 });
        
        // 2. Ambil Semua Absensi bulan ini
        const attendance = await Attendance.find({
            timestamp: { $gte: start, $lte: end }
        });

        const lateThresholdMinutes = 9 * 60 + 30; // 09:30

        const reports = users.map(user => {
            const userAtt = attendance.filter(a => a.email.toLowerCase() === user.email.toLowerCase());
            
            // Group by date
            const days = {};
            userAtt.forEach(a => {
                const dKey = new Date(a.timestamp).toDateString();
                if (!days[dKey]) days[dKey] = { in: null, out: null };
                if (a.type === 'clock_in') days[dKey].in = a.timestamp;
                if (a.type === 'clock_out') days[dKey].out = a.timestamp;
            });

            let totalHours = 0;
            let daysPresent = 0;
            let lateDays = 0;

            const now = new Date();
            const todayStr = now.toDateString();

            Object.entries(days).forEach(([dateStr, times]) => {
                const isToday = dateStr === todayStr;
                const isPast7PM = now.getHours() >= 19;
                
                let isValid = false;
                if (times.in && times.out) {
                    isValid = true;
                    totalHours += Math.abs(new Date(times.out) - new Date(times.in)) / (1000 * 60 * 60);
                } else if (times.in && isToday && !isPast7PM) {
                    isValid = true;
                }

                if (isValid) {
                    daysPresent++;
                    const inTime = new Date(times.in);
                    if (inTime.getHours() * 60 + inTime.getMinutes() >= lateThresholdMinutes) {
                        lateDays++;
                    }
                }
            });

            return {
                id: user._id,
                name: user.name,
                email: user.email,
                position: user.position || 'Employee',
                daysPresent,
                lateDays,
                totalHours: totalHours.toFixed(1),
                attendanceRate: ((daysPresent / 22) * 100).toFixed(0) // Default 22 work days
            };
        });

        res.json({ success: true, reports });
    } catch (error) {
        console.error('Error fetching monthly report:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil laporan bulanan.' });
    }
});

// ============================================================
// 6. ENDPOINT: Ambil Daftar Semua Karyawan (Employees)
// ============================================================
app.get('/api/employees', async (req, res) => {
    try {
        const employees = await User.find({}).sort({ name: 1 });
        res.status(200).json({ success: true, employees });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil daftar karyawan.' });
    }
});

// Admin Update Employee Details (with bidirectional team sync)
app.put('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { position, department, role, employeeId, employmentStatus, manager, teamMembers } = req.body;
        
        // 1. Ambil data lama sebelum diupdate untuk perbandingan
        const oldEmployee = await User.findById(id);
        if (!oldEmployee) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });

        // 2. Jalankan update utama
        const updatedEmployee = await User.findByIdAndUpdate(
            id,
            { position, department, role, employeeId, employmentStatus, manager, teamMembers },
            { new: true }
        );

        // 3. LOGIKA SINKRONISASI 360°
        
        // A. Jika Seseorang DIJADIKAN member tim (Manajer berubah)
        if (manager !== oldEmployee.manager) {
            // Hapus dari manajer lama (jika ada)
            if (oldEmployee.manager) {
                await User.findOneAndUpdate(
                    { name: oldEmployee.manager },
                    { $pull: { teamMembers: { email: updatedEmployee.email } } }
                );
            }
            // Tambahkan ke manajer baru (jika ada)
            if (manager) {
                await User.findOneAndUpdate(
                    { name: manager },
                    { $addToSet: { teamMembers: { 
                        name: updatedEmployee.name, 
                        email: updatedEmployee.email, 
                        position: updatedEmployee.position 
                    } } }
                );
            }
        }

        // B. Jika seorang Manajer menambah/menghapus member tim secara langsung
        if (JSON.stringify(teamMembers) !== JSON.stringify(oldEmployee.teamMembers)) {
            const oldEmails = (oldEmployee.teamMembers || []).map(m => m.email);
            const newEmails = (teamMembers || []).map(m => m.email);

            // Member yang baru ditambahkan -> Set managernya ke user ini
            const addedMembers = newEmails.filter(email => !oldEmails.includes(email));
            if (addedMembers.length > 0) {
                await User.updateMany(
                    { email: { $in: addedMembers } },
                    { manager: updatedEmployee.name }
                );
            }

            // Member yang dihapus -> Kosongkan managernya (jika managernya masih user ini)
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
        console.error('❌ Gagal update karyawan:', error.message);
        res.status(500).json({ success: false, message: 'Gagal memperbarui data karyawan.' });
    }
});

// Admin Delete Employee
app.delete('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedUser = await User.findByIdAndDelete(id);
        
        if (!deletedUser) {
            return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
        }
        
        res.status(200).json({ success: true, message: 'Karyawan berhasil dihapus!' });
    } catch (error) {
        console.error('❌ Gagal hapus karyawan:', error.message);
        res.status(500).json({ success: false, message: 'Gagal menghapus karyawan.' });
    }
});

// Admin/Manager: Update Employee Payroll & Role
app.put('/api/employees/:id/payroll', async (req, res) => {
    try {
        const { id } = req.params;
        const { baseSalary, allowance, role, bankAccount, payrollStatus } = req.body;
        
        const updateData = { 
            baseSalary: Number(baseSalary), 
            allowance: Number(allowance) 
        };
        if (role) updateData.role = role;
        if (bankAccount !== undefined) updateData.bankAccount = bankAccount;
        if (payrollStatus) updateData.payrollStatus = payrollStatus;

        const updatedUser = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
        }

        res.status(200).json({ success: true, message: 'Payroll berhasil diperbarui!', user: updatedUser });
    } catch (error) {
        console.error('❌ Gagal update payroll:', error.message);
        res.status(500).json({ success: false, message: 'Gagal memperbarui payroll.' });
    }
});

// ============================================================
// 8. ENDPOINT: Update Profil User
// ============================================================
app.put('/api/users/profile', async (req, res) => {
    try {
        const { email, name, bio, phone, address, birthday, gender, maritalStatus } = req.body;
        console.log('📩 Menerima update profil untuk:', email);
        console.log('📦 Data:', { name, bio, phone, address, birthday, gender, maritalStatus });
        
        const updatedUser = await User.findOneAndUpdate(
            { email: { $regex: new RegExp("^" + email + "$", "i") } }, // Case-insensitive match
            { name, bio, phone, address, birthday, gender, maritalStatus },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
        }

        res.status(200).json({ success: true, message: 'Profil berhasil diperbarui!', user: updatedUser });
    } catch (error) {
        console.error('❌ Gagal update profil:', error.message);
        res.status(500).json({ success: false, message: 'Gagal memperbarui profil.' });
    }
});

// ============================================================
// 9. ENDPOINT: Request & Approval System
// ============================================================

// Submit New Request
app.post('/api/requests', async (req, res) => {
    try {
        const { email, name, type, startDate, endDate, reason, amount } = req.body;
        const newRequest = new Request({
            email, name, type, startDate, endDate, reason, amount
        });
        await newRequest.save();
        res.status(201).json({ success: true, message: 'Request submitted successfully!', request: newRequest });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to submit request.' });
    }
});

// Get Personal Requests
app.get('/api/requests', async (req, res) => {
    try {
        const { email } = req.query;
        const requests = await Request.find({ email: { $regex: new RegExp("^" + email + "$", "i") } }).sort({ timestamp: -1 });
        res.status(200).json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch personal requests.' });
    }
});

// Get All Pending Requests (for HRD/Manager) with Profile Pictures
app.get('/api/requests/pending', async (req, res) => {
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

// Get All Active Approved Leaves (for Dashboard)
app.get('/api/requests/active-leave', async (req, res) => {
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
        console.error('Error fetching active leaves:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch active leaves.' });
    }
});

// Get Recent Leave Requests for Feed
app.get('/api/requests/recent', async (req, res) => {
    try {
        // Fetch the 10 most recent leave requests and join with User collection to get the latest profile picture
        const recentRequests = await Request.aggregate([
            { $match: { type: { $in: ['Leave', 'Sick', 'Permit'] } } },
            { $sort: { timestamp: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users', // The collection name for the User model (usually lowercase plural)
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
        console.error('Error fetching recent activities:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch recent activities.' });
    }
});


// ============================================================
// 10. ENDPOINT: Schedule & Google Calendar
// ============================================================
app.get('/api/schedule/holidays', async (req, res) => {
    try {
        const iCalUrl = 'https://calendar.google.com/calendar/ical/id.indonesian%23holiday%40group.v.calendar.google.com/public/basic.ics';
        
        ical.fromURL(iCalUrl, {}, function (err, data) {
            if (err) {
                console.error('Error fetching iCal data:', err);
                return res.status(500).json({ success: false, message: 'Failed to fetch calendar data' });
            }
            
            const holidays = [];
            const currentYear = new Date().getFullYear();

            for (let k in data) {
                if (data.hasOwnProperty(k)) {
                    const ev = data[k];
                    if (data[k].type === 'VEVENT') {
                        const eventDate = new Date(ev.start);
                        // Fix for timezone shift: Add 12 hours to ensure all-day events fall on the correct UTC date
                        eventDate.setHours(eventDate.getHours() + 12);
                        
                        // Filter for current year to reduce payload size
                        if (eventDate.getFullYear() === currentYear || eventDate.getFullYear() === currentYear + 1) {
                            holidays.push({
                                date: eventDate.toISOString().split('T')[0], // format: YYYY-MM-DD
                                summary: ev.summary
                            });
                        }
                    }
                }
            }

            res.status(200).json({ success: true, holidays });
        });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ success: false, message: 'Server error parsing schedule' });
    }
});


// Update Request Status (Approve/Reject)
app.put('/api/requests/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const { id } = req.params;
        const updatedRequest = await Request.findByIdAndUpdate(id, { status }, { new: true });
        if (!updatedRequest) return res.status(404).json({ success: false, message: 'Request not found.' });
        res.status(200).json({ success: true, message: `Request ${status}!`, request: updatedRequest });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update request status.' });
    }
});
// ============================================================
// OFFICE SETTINGS ENDPOINTS
// ============================================================
app.get('/api/settings/office', async (req, res) => {
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

app.put('/api/settings/office', async (req, res) => {
    try {
        const { lat, lng, radius, name } = req.body;
        const setting = await Settings.findOneAndUpdate(
            { key: 'office_location' },
            { value: { lat: parseFloat(lat), lng: parseFloat(lng), radius: parseInt(radius) || 100, name: name || 'EMS Office' } },
            { upsert: true, new: true }
        );
        res.json({ success: true, message: 'Lokasi kantor diperbarui!', data: setting.value });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update settings.' });
    }
});

// GET & PUT Work Days
app.get('/api/settings/workdays', async (req, res) => {
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

app.put('/api/settings/workdays', async (req, res) => {
    try {
        const { days } = req.body; // Array of strings
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

// Export for Vercel Serverless Functions
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => console.log(`🚀 Server nyala di port ${PORT}`));
}

module.exports = app;