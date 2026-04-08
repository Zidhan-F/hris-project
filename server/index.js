const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { OAuth2Client } = require('google-auth-library');
const User = require('./models/User');

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
        const user = await User.findOneAndUpdate(
            { email: userData.email },
            {
                name: userData.name,
                email: userData.email,
                googleId: userData.googleId,
                profilePicture: userData.picture,
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
// 5. ENDPOINT: Ambil Riwayat Absensi User
// ============================================================
app.get('/api/attendance/history', async (req, res) => {
    try {
        const { email } = req.query;
        const records = await Attendance.find({ email })
            .sort({ timestamp: -1 })
            .limit(10);
        res.status(200).json({ success: true, records });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil riwayat.' });
    }
});

app.listen(PORT, () => console.log(`🚀 Server nyala di port ${PORT}`));