# Penjelasan Lengkap Seluruh File Proyek
## EMS — Employee Management System (HRIS)
**Last Updated:** 17 April 2026

---

## Daftar Isi

1. [Root Files](#1-root-files)
2. [Server — Backend](#2-server--backend)
3. [Client — Frontend](#3-client--frontend)
4. [Utils](#4-utils)
5. [Components — Views](#5-components--views)
6. [Components — Modals](#6-components--modals)

---

## 1. Root Files

### `.gitignore`
File konfigurasi Git yang menentukan file/folder mana yang **tidak boleh di-commit** ke repository. Contoh: `node_modules/`, `.env`, `dist/`, folder build.

### `README.md`
Dokumentasi utama proyek yang ditampilkan di halaman GitHub. Berisi deskripsi proyek, cara setup, dan cara menjalankan development server.

---

## 2. Server — Backend

### 📄 [server/package.json](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/server/package.json)

**Fungsi:** Manajemen dependensi dan script untuk backend Node.js.

| Field | Nilai | Penjelasan |
|-------|-------|------------|
| `main` | `index.js` | File utama yang dijalankan saat `node index.js` |
| `type` | `commonjs` | Menggunakan `require()` bukan `import` |
| `scripts.start` | `node index.js` | Perintah untuk production |
| `scripts.dev` | `npx nodemon -L index.js` | Auto-restart saat ada perubahan kode |

**Dependencies & Fungsinya:**

| Package | Versi | Fungsi |
|---------|-------|--------|
| `express` | 5.2.1 | Framework web server utama. Menangani routing HTTP |
| `mongoose` | 9.4.1 | ODM (Object Document Mapper) untuk MongoDB. Mendefinisikan schema dan query database |
| `cors` | 2.8.6 | Mengizinkan request cross-origin (frontend di port 5173 → backend di port 5000) |
| `dotenv` | 17.4.0 | Memuat variabel environment dari file `.env` |
| `helmet` | 8.1.0 | Menambahkan HTTP security headers (perlindungan XSS, clickjacking, MIME sniffing) |
| `express-rate-limit` | 7.5.0 | Membatasi jumlah request per IP (anti brute-force & DDoS) |
| `google-auth-library` | 10.6.2 | Verifikasi JWT token dari Google OAuth 2.0 |
| `mongodb` | 7.1.1 | Driver MongoDB low-level (diperlukan oleh Mongoose) |
| `node-ical` | 0.26.0 | Parser format iCalendar untuk mengambil data hari libur nasional |
| `nodemon` | 3.1.0 | Development tool: auto-restart server saat file berubah |

---

### 📄 [server/.env](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/server/.env)

**Fungsi:** Menyimpan konfigurasi sensitif yang TIDAK boleh masuk ke Git.

| Variable | Contoh | Fungsi |
|----------|--------|--------|
| `PORT` | `5000` | Port server Express |
| `MONGO_URI` | `mongodb+srv://...` | Connection string ke MongoDB Atlas |
| `GOOGLE_CLIENT_ID` | `512607...` | Client ID dari Google Cloud Console untuk OAuth |
| `FRONTEND_URL` | `http://localhost:5173` | URL frontend yang diizinkan CORS di production |
| `ALLOW_OPEN_REGISTRATION` | `true` | Jika `true`, user baru bisa langsung daftar via Google. Jika tidak di-set, hanya user yang sudah ada di database yang bisa login |
| `NODE_ENV` | `production` | Jika `production`, server akan enforce HTTPS redirect |

---

### 📄 [server/models/User.js](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/server/models/User.js) — 35 baris

**Fungsi:** Mendefinisikan **schema (struktur data)** collection `users` di MongoDB menggunakan Mongoose.

**Penjelasan per bagian:**

```
Baris 3-33: mongoose.Schema — Definisi semua field user
```

| Kategori | Fields | Penjelasan |
|----------|--------|------------|
| **Identitas** | `name`, `email` (unique), `googleId`, `profilePicture` | Data dari Google OAuth. `email` adalah primary identifier unik |
| **Role & Posisi** | `role` (enum 4 level), `position` | Menentukan level akses: `employee` → `hrd` → `manager` → `admin` |
| **Info Pribadi** | `bio`, `phone`, `address`, `birthday`, `gender`, `maritalStatus` | Data personal yang bisa diisi sendiri oleh user |
| **Kontrak** | `employeeId`, `joinDate`, `employmentStatus`, `contractEnd` | Info ketenagakerjaan. User baru otomatis `Probation` dengan kontrak 3 bulan |
| **Tim** | `department`, `manager`, `teamMembers` | Struktur organisasi. `teamMembers` = array of `{ name, position, email }` |
| **Payroll** | `baseSalary`, `allowance`, `bankAccount`, `payrollStatus` | Data gaji. Default gaji pokok: Rp 5.000.000 |
| **Lainnya** | `leaveQuota`, `createdAt` | Jatah cuti (default: 0 untuk user baru) dan timestamp pembuatan |

```
Baris 35: module.exports — Export model agar bisa dipakai di index.js
```

---

### 📄 [server/models/Request.js](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/server/models/Request.js) — 24 baris

**Fungsi:** Mendefinisikan schema untuk collection `requests` — menyimpan semua pengajuan cuti, izin, reimburse, dll.

| Field | Type | Penjelasan |
|-------|------|------------|
| `email` + `name` | String (required) | Identitas pemohon |
| `type` | Enum 8 tipe | `Leave`, `Permit`, `Sick`, `Overtime`, `Reimbursement`, `Timesheet`, `Expense`, `Other` |
| `startDate` + `endDate` | Date | Periode permohonan |
| `reason` | String (required) | Alasan pengajuan |
| `amount` | Number | Khusus untuk Reimbursement/Expense (nominal rupiah) |
| `status` | Enum 4 status | `Pending` → `Approved` / `Rejected` / `Returned`. Default: `Pending` |
| `timestamp` | Date | Waktu pengajuan dibuat (auto-generate) |

---

### 📄 [server/models/PayrollLog.js](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/server/models/PayrollLog.js)

**Fungsi:** Model untuk menyimpan audit trail aksi payroll massal.

| Field | Type | Penjelasan |
|-------|------|------------|
| `action` | String | Jenis aksi: `FINALIZE_ALL`, `MARK_PAID_ALL`, `SEND_EMAILS` |
| `performedBy` | String | Email admin pelaksana |
| `affectedCount` | Number | Jumlah karyawan yang diproses |
| `details` | Object | Data tambahan (tanggal, filter, dll) |
| `timestamp` | Date | Waktu pencatatan |

---

### 📄 [server/services/cronJobs.js](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/server/services/cronJobs.js)

**Fungsi:** Engine otomatisasi latar belakang menggunakan `node-cron`.

**Tugas yang dijadwalkan:**
1. **Attendance Reminder**: Setiap Senin-Jumat pukul 08:30 WIB. Mengecek karyawan yang belum absen dan siap mengirim notifikasi.
2. **Monthly Payroll**: Setiap tanggal 25 pukul 00:00 WIB. Melakukan kalkulasi gaji massal.
3. **Email Blast**: Setiap tanggal 25 pukul 08:00 WIB. Mengirimkan PDF slip gaji ke email karyawan secara otomatis.

---

### 📄 [server/services/payrollEngine.js](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/server/services/payrollEngine.js)

**Fungsi:** Logika inti kalkulasi gaji. Menghitung THP berdasarkan gaji pokok, tunjangan, dan potongan jika ada.

---

### 📄 [scripts/backup.ps1](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/scripts/backup.ps1)

**Fungsi:** Skrip otomasi PowerShell untuk melakukan backup database MongoDB dari dalam container Docker ke sistem file lokal pengguna.

---

### 📄 [server/index.js](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/server/index.js) — 1056 baris

**Fungsi:** File utama backend. Berisi **semua middleware, endpoint API, business logic, dan inline model definitions**. Ini adalah "otak" server.

#### Struktur File (Section by Section):

---

**Baris 1-11 — Import Dependencies**
```
Memuat semua package: express, mongoose, cors, dotenv, helmet, rate-limit, google-auth-library, models, node-ical.
```

**Baris 12-17 — Inisialisasi**
```
- dotenv.config() → Memuat file .env
- app = express() → Membuat instance Express
- PORT = 5000 (default)
- googleClient → Instance OAuth2Client untuk verifikasi token Google
```

**Baris 19-76 — Security Middleware**

| Middleware | Baris | Fungsi |
|------------|-------|--------|
| **Helmet** | 24 | Menambahkan 15+ HTTP headers keamanan secara otomatis |
| **CORS** | 27-45 | Hanya mengizinkan request dari `localhost:5173`, `localhost:3000`, dan `FRONTEND_URL`. Request dari domain lain akan ditolak |
| **Body Parser** | 48 | Parse request body JSON, limit 10MB (mencegah serangan payload besar) |
| **Rate Limiter (General)** | 51-57 | Maks 200 request per IP per 15 menit untuk semua `/api/*` |
| **Rate Limiter (Auth)** | 59-63 | Maks 20 request per IP per 15 menit untuk `/api/auth/*` (anti brute-force login) |
| **HTTPS Enforcer** | 69-76 | Di production, redirect semua HTTP → HTTPS |

**Baris 78-101 — Database & Inline Models**

| Item | Baris | Penjelasan |
|------|-------|------------|
| **MongoDB Connect** | 81-83 | Koneksi ke MongoDB Atlas menggunakan URI dari `.env`. Menampilkan ✅ atau ❌ di console |
| **Attendance Model** | 88-96 | Schema inline (bukan file terpisah): email, name, profilePicture, latitude, longitude, type (`clock_in`/`clock_out`), timestamp |
| **Settings Model** | 98-101 | Schema key-value generik untuk menyimpan pengaturan aplikasi (lokasi kantor, hari kerja) |

**Baris 103-170 — Security Helpers & Middleware**

| Fungsi | Baris | Penjelasan |
|--------|-------|------------|
| `escapeRegex(str)` | 108-111 | Menghapus karakter regex khusus dari string input. Mencegah **ReDoS** dan **NoSQL Injection** |
| `emailQuery(email)` | 114-117 | Membuat query MongoDB yang aman untuk pencarian email (case-insensitive, injection-proof) |
| `verifyGoogleToken(token)` | 124-137 | Memverifikasi JWT token dari Google dan mengekstrak payload (googleId, email, name, picture) |
| `authMiddleware` | 140-160 | **Middleware utama autentikasi.** Setiap request yang dilindungi harus melewati ini. Mengecek header `Authorization: Bearer <token>`, verifikasi token Google, cari user di database, lalu attach `req.user` |
| `requireRole(...roles)` | 163-170 | **Middleware otorisasi.** Mengecek apakah `req.user.role` termasuk dalam daftar role yang diizinkan. Contoh: `requireRole('admin', 'hrd')` |

**Baris 172-237 — Input Validators**

4 fungsi validasi yang mengecek data sebelum disimpan ke database:

| Validator | Baris | Yang Divalidasi |
|-----------|-------|-----------------|
| `validatePayrollInput` | 175-196 | Gaji (0–1M), tunjangan (0–500jt), role valid, status valid, quota (0–365) |
| `validateEmployeeInput` | 198-213 | Role valid, employment status, posisi max 100 char, department max 100 char |
| `validateRequestInput` | 215-227 | Type dari 8 enum, reason wajib max 1000 char, amount valid |
| `validateProfileInput` | 229-237 | Nama 2–100 char, bio max 250, phone max 30, address max 500, gender valid |

**Baris 239-333 — Endpoint: Google Login**

```
POST /api/auth/google
```

Alur:
1. Terima JWT token dari frontend
2. Verifikasi token via Google API
3. Cek apakah user sudah ada di database
4. Jika user baru & `ALLOW_OPEN_REGISTRATION=true` → buat user baru (upsert) dengan default:
   - Role: `employee`
   - Status: `Probation`
   - Contract End: 3 bulan dari sekarang
   - Leave Quota: 0
   - Gaji: Rp 5.000.000
5. Return data user lengkap ke frontend

**Baris 335-465 — Endpoints: Attendance**

| Endpoint | Method | Baris | Penjelasan |
|----------|--------|-------|------------|
| `/api/attendance/submit` | POST | 338-378 | Catat absensi baru. Menggunakan data dari `req.user` (bukan body) untuk mencegah spoofing. Validasi koordinat GPS dan tipe |
| `/api/attendance/history` | GET | 384-409 | Ambil riwayat absensi. Employee hanya bisa lihat milik sendiri. Admin/Manager/HRD bisa lihat semua |
| `/api/attendance/summary/today` | GET | 414-465 | Hitung total staff, jumlah hadir, dan jumlah terlambat hari ini. Terlambat = clock in setelah 09:30 WIB |
| `/api/attendance/summary/monthly` | GET | 470-554 | Laporan bulanan: hitung days present, late, total hours, attendance rate per karyawan. Termasuk `profilePicture` |

**Baris 556-780 — Endpoints: Employees**

| Endpoint | Method | Baris | Penjelasan |
|----------|--------|-------|------------|
| `/api/employees` | GET | 559-590 | Daftar semua karyawan. **Employee** mendapat data terbatas (tanpa gaji, bankAccount). **Admin/HRD/Manager** mendapat data lengkap |
| `/api/employees/:id` | PUT | ~600-680 | Update data karyawan (posisi, role, department, manager, team, dll). Hanya Admin/Manager/HRD |
| `/api/employees/:id` | DELETE | ~685-720 | Hapus karyawan. Hanya Admin |
| `/api/employees/:id/payroll` | PUT | ~725-780 | Update data payroll (gaji, tunjangan, rekening, status). Hanya Admin/HRD |

**Baris 782-950 — Endpoints: Requests**

| Endpoint | Method | Penjelasan |
|----------|--------|------------|
| `/api/requests` | POST | Buat request baru (cuti, izin, dll). Validasi input, link ke email user |
| `/api/requests` | GET | Ambil daftar request milik sendiri |
| `/api/requests/pending` | GET | Daftar request yang menunggu approval (Admin/HRD/Manager) |
| `/api/requests/:id/status` | PUT | Ubah status request: Approve, Reject, atau Return. Jika Leave di-approve → kurangi leaveQuota user |
| `/api/requests/recent` | GET | Aktivitas terbaru untuk dashboard feed |
| `/api/requests/active-leave` | GET | Siapa yang sedang cuti hari ini (status Approved + tanggal sekarang di antara startDate-endDate) |

**Baris 952-1050 — Endpoints: Settings & Schedule**

| Endpoint | Penjelasan |
|----------|------------|
| `GET /api/settings/office` | Ambil lokasi kantor (nama, lat, lng, radius) dari Settings collection |
| `PUT /api/settings/office` | Update lokasi kantor. Hanya Admin/HRD |
| `GET /api/settings/workdays` | Ambil daftar hari kerja (default: Senin-Jumat) |
| `PUT /api/settings/workdays` | Update hari kerja |
| `GET /api/schedule/holidays` | Ambil hari libur nasional Indonesia via iCal feed dari Google Calendar |

**Baris 1200-1450 — Endpoints: Payroll Advanced & Logging**

| Endpoint | Method | Penjelasan |
|----------|--------|------------|
| `/api/payroll/finalize-all` | PUT | Finalisasi status gaji semua karyawan untuk bulan berjalan |
| `/api/payroll/mark-all-paid` | PUT | Mengubah status payroll semua karyawan menjadi `Paid` sekaligus. Mencatat ke Audit Log |
| `/api/payroll/logs` | GET | Mengambil semua histori aksi payroll untuk kebutuhan audit HRD |

**Baris 1452-1460 — Server Start & Cron Init**
```js
app.listen(PORT) → Start server
if (process.env.ENABLE_CRON) initCronJobs() → Menjalankan sistem otomasi jika diaktifkan
```

---

## 4. Root & Infrastructure

### 📄 [docker-compose.yml](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/docker-compose.yml)

**Fungsi:** Orkestrasi multi-container. Menjalankan 3 layanan sekaligus:
1. **ems-frontend**: React app di port 5173.
2. **ems-backend**: Express API di port 5000.
3. **ems-mongodb**: Database NoSQL lokal dengan volume persistence (data tidak hilang saat container mati).

---

### 📄 [Dockerfile](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/Dockerfile)

**Fungsi:** Blueprint untuk membuat image container frontend/backend. Menggunakan multi-stage build untuk optimasi ukuran image.

---

## 3. Client — Frontend

### 📄 [client/package.json](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/package.json)

**Fungsi:** Manajemen dependensi frontend.

| Script | Perintah | Fungsi |
|--------|----------|--------|
| `dev` | `vite` | Jalankan dev server di `localhost:5173` |
| `build` | `vite build` | Build production bundle ke folder `dist/` |
| `preview` | `vite preview` | Preview hasil build di local |

**Runtime Dependencies:**

| Package | Fungsi |
|---------|--------|
| `react` + `react-dom` (19.x) | Library UI utama. Mengelola virtual DOM dan component lifecycle |
| `@react-oauth/google` | Tombol "Sign in with Google" dan OAuth flow |
| `axios` (1.x) | HTTP client untuk berkomunikasi dengan backend API |
| `leaflet` + `react-leaflet` | Library peta interaktif. Menampilkan lokasi kantor dan posisi user |
| `framer-motion` | Library animasi (tersedia tapi belum banyak digunakan) |

---

### 📄 [client/vite.config.js](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/vite.config.js) — 16 baris

**Fungsi:** Konfigurasi Vite build tool.

| Setting | Nilai | Penjelasan |
|---------|-------|------------|
| `plugins` | `[react()]` | Aktifkan plugin React (JSX transform, Fast Refresh) |
| `server.watch.usePolling` | `true` | Gunakan polling untuk file watching (diperlukan untuk Docker/WSL) |
| `server.host` | `true` | Expose server ke semua network interfaces (bukan hanya localhost) |
| `server.strictPort` | `true` | Gagal jika port 5173 sudah dipakai (tidak auto-switch) |
| `server.port` | `5173` | Port development server |

---

### 📄 [client/index.html](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/index.html)

**Fungsi:** Template HTML utama. Vite meng-inject bundle JavaScript ke dalam file ini. Berisi:
- `<div id="root">` — Mount point untuk React app
- Link ke Google Material Icons (CDN)
- Link ke Leaflet CSS (CDN)
- Meta tags untuk viewport dan encoding

---

### 📄 [client/src/main.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/main.jsx) — 15 baris

**Fungsi:** **Entry point** aplikasi React. File pertama yang dieksekusi oleh browser.

**Apa yang dilakukan:**
1. `ReactDOM.createRoot()` — Membuat React root dan me-mount ke `<div id="root">`
2. `<React.StrictMode>` — Mode development yang mendeteksi masalah potensial
3. `<GoogleOAuthProvider>` — Membungkus seluruh app dengan konteks Google OAuth. Menyediakan `clientId` dari environment variable (`VITE_GOOGLE_CLIENT_ID`)
4. `<App />` — Render komponen utama

**Flow:** `index.html` → `main.jsx` → `<GoogleOAuthProvider>` → `<App />`

---

### 📄 [client/src/index.css](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/index.css)

**Fungsi:** CSS reset dasar dan styling global paling dasar (font default, box-sizing, margin reset).

---

### 📄 [client/src/App.css](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/App.css)

**Fungsi:** **Design system lengkap** untuk seluruh aplikasi. File CSS terbesar yang berisi:

| Kategori | Contoh Class | Fungsi |
|----------|-------------|--------|
| **Login** | `.login-page`, `.login-card` | Halaman login dengan glassmorphism effect |
| **Layout** | `.dashboard-page`, `.sidebar`, `.top-navbar` | Struktur utama (sidebar + navbar + content) |
| **Dashboard** | `.welcome-banner`, `.stat-card`, `.feed-card` | Banner welcome, statistik cards, feed items |
| **Profile** | `.profile-container`, `.profile-header-card` | Layout profil karyawan dengan tabs |
| **Employee** | `.employee-grid`, `.employee-card` | Grid daftar karyawan dengan hover effects |
| **Attendance** | `.att-card-daily`, `.camera-card`, `.location-card` | Kartu absensi harian, preview kamera, peta |
| **Payroll** | `.payslip-card`, `.payslip-header` | Slip gaji dengan branding perusahaan |
| **Leave** | `.request-grid`, `.approval-card` | Grid request type, kartu approval |
| **Schedule** | `.schedule-calendar-grid`, `.calendar-day-cell` | Grid kalender bulanan |
| **Modals** | `.modal-overlay`, `.modal-content` | Dialog overlay dengan animasi |
| **Animations** | `.animate-fadeInUp`, `.animate-fadeInScale` | Animasi masuk untuk halaman dan komponen |
| **Responsive** | `@media` queries | Adaptasi layout untuk mobile dan tablet |

---

### 📄 [client/src/App.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/App.jsx) — ~300 baris

**Fungsi:** **Koordinator utama** aplikasi. Setelah refactoring, file ini HANYA berisi:

| Bagian | Baris (approx) | Penjelasan |
|--------|----------------|------------|
| **Imports** | 1-27 | Import semua 16 komponen, utils, axios, dan React hooks |
| **State Declarations** | 30-100 | Semua `useState` untuk data aplikasi (~40 state variables) |
| **useEffect Hooks** | 102-200 | Timer, geolocation watching, camera stream, data fetching triggers |
| **Data Fetching Functions** | 200-280 | `fetchHistory()`, `fetchEmployees()`, `fetchRequests()`, dll. Semua komunikasi API |
| **Event Handlers** | 280-400 | `handleClock()`, `handleLoginSuccess()`, `handleSaveEmployee()`, dll |
| **Render** | 400-530 | Conditional rendering berdasarkan `activeMenu` + passing props ke child components |

**Arsitektur State:**

```
App.jsx (Coordinator)
├── user state ────────→ TopNavbar, Dashboard, ProfileView, EmployeeView
├── activeMenu state ──→ Determines which View to render
├── employees[] ───────→ EmployeeView, PayrollView
├── requests[] ────────→ LeaveView
├── history[] ─────────→ Dashboard (clock history)
├── officeSettings ────→ Dashboard (map), OfficeSettingsModal
└── modal states ──────→ 5 Modal components (open/close)
```

**Kenapa state tetap di App.jsx?**
- Menghindari **prop drilling** yang terlalu dalam
- Tidak perlu Context API untuk skala ini
- Meminimalisir risiko bug saat refactoring
- Semua data flow tetap **unidirectional** (atas → bawah)

---

## 4. Utils

### 📄 [client/src/utils/helpers.js](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/utils/helpers.js) — 140 baris

**Fungsi:** **Shared utilities** — konstanta, fungsi format, dan business logic yang dipakai oleh banyak komponen.

#### Constants (Baris 1-43)

| Export | Tipe | Penjelasan |
|--------|------|------------|
| `DEFAULT_OFFICE` | Object | Koordinat default kantor: `{ lat: -6.1528, lng: 106.7909, radius: 100, name: 'EMS Office' }`. Digunakan sebelum data dari database dimuat |
| Leaflet Icon Fix | Setup | Baris 7-12: Memperbaiki bug Leaflet dimana marker icon tidak tampil saat menggunakan bundler (Vite/Webpack). Mengarahkan URL icon ke CDN |
| `API_URL` | String | Base URL backend API. Membaca dari `VITE_API_URL` env var, fallback ke `http://localhost:5000` |
| `WELCOME_MESSAGES` | Array | 7 pesan motivasi bergantian yang ditampilkan di dashboard banner setiap 8 detik |
| `MENU_ITEMS` | Array | Definisi menu sidebar: id, label, ikon Material Icons, submenu untuk Attendance |

#### Functions (Baris 45-139)

| Fungsi | Baris | Parameter | Return | Penjelasan |
|--------|-------|-----------|--------|------------|
| `getDistanceMeters()` | 46-52 | `lat1, lng1, lat2, lng2` | Number (meter) | **Rumus Haversine** — menghitung jarak antara 2 titik GPS di permukaan bumi. Digunakan untuk mengecek apakah user berada dalam radius kantor |
| `getRequestIcon()` | 54-66 | `type` (string) | `{ icon, color }` | Mengembalikan nama Material Icon dan warna hex berdasarkan tipe request (Leave=biru, Sick=merah, dll) |
| `formatTime()` | 69 | `Date` | `"14:30:45"` | Format waktu Indonesia (HH:MM:SS) |
| `formatDate()` | 70 | `Date` | `"Kamis, 17 April 2026"` | Format tanggal lengkap Indonesia |
| `formatTimestamp()` | 71 | timestamp | `"17 Apr 2026, 14:30"` | Format timestamp ringkas |
| `getInitials()` | 72 | `"John Doe"` | `"JD"` | Ambil inisial dari nama (maks 2 huruf). Digunakan sebagai placeholder jika tidak ada foto profil |
| `formatCurrency()` | 73 | `5000000` | `"Rp 5.000.000"` | Format angka ke mata uang Rupiah Indonesia |
| `safeISO()` | 76-83 | Date/string/null | `"2026-04-17"` atau `""` | Konversi tanggal ke format ISO (YYYY-MM-DD) **tanpa crash**. Menangani `null`, string invalid, dan error |
| `getGreeting()` | 85-91 | `currentTime` | `"Good Morning,"` | Sapaan berdasarkan jam: <10=Morning, <15=Afternoon, <18=Evening, else=Night |
| `groupAttendanceByDay()` | 94-139 | `records[], currentTime` | Array of day objects | **Fungsi terpenting.** Mengelompokkan record absensi mentah (clock_in + clock_out individual) menjadi rangkuman per hari. Menghitung: jam kerja total, status on-time (sebelum 09:30), validity (in+out lengkap, atau hari ini yang masih aktif) |

---

## 5. Components — Views

### 📄 [LoginPage.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/LoginPage.jsx) — 30 baris

**Fungsi:** Halaman login yang ditampilkan saat `user === null`.

**Yang ditampilkan:**
- Brand bar EMS di atas
- Card login dengan logo, pesan welcome
- Tombol **"Sign in with Google"** (dari `@react-oauth/google`)
- Loading spinner saat proses autentikasi
- Status message (error/success)

**Props:** `loading`, `statusMsg`, `handleLoginSuccess`, `handleLoginError`

---

### 📄 [Sidebar.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/Sidebar.jsx) — 37 baris

**Fungsi:** Navigation sidebar di sisi kiri. Bisa dibuka/tutup (slide animation).

**Yang ditampilkan:**
- Logo EMS + nama perusahaan
- Tombol close (hamburger)
- 6 menu items dari `MENU_ITEMS` constant
- Submenu expandable (untuk Attendance → Personal, Schedule, Report)
- Active state highlighting

**Logika khusus:**
- Menu "Monthly Report" (`att-report`) disembunyikan untuk role `employee`
- Submenu di-expand/collapse dengan animasi rotate icon

**Props:** `sidebarOpen`, `sidebarClosing`, `closeSidebar`, `activeMenu`, `activeSubMenu`, `expandedMenu`, `user`, `handleMenuClick`, `handleSubMenuClick`

---

### 📄 [TopNavbar.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/TopNavbar.jsx) — 23 baris

**Fungsi:** Header bar di atas. Selalu ditampilkan saat user login.

**Yang ditampilkan:**
- Tombol hamburger (muncul saat sidebar tertutup)
- Tombol search (UI only)
- Tombol notifikasi (UI only)
- Avatar user (foto Google atau inisial fallback)

**Interaksi:** Klik avatar → `handleLogout()` (logout dari aplikasi)

---

### 📄 [Dashboard.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/Dashboard.jsx) — ~170 baris

**Fungsi:** Halaman utama setelah login. **Komponen terbesar dan terpenting.**

**Terdiri dari 2 tab:**

#### Tab 1: Feed
| Elemen | Penjelasan |
|--------|------------|
| Welcome Banner | Foto, nama, sapaan, pesan motivasi bergantian, posisi & role, badges department/lokasi |
| Stats Grid | Total Staff, Present Today (dengan persentase), Late Arrivals. Hanya admin/manager/hrd yang lihat present & late |
| On Leave Today | Daftar karyawan yang sedang cuti hari ini. Foto profil + tipe cuti + tanggal |
| Recent Activities | Link "View More" → navigasi ke halaman Leave |

#### Tab 2: My Info
| Elemen | Penjelasan |
|--------|------------|
| Location Card | **Peta Leaflet** menampilkan lokasi kantor (lingkaran radius) dan posisi user (marker). Badge jarak real-time (hijau jika dalam radius, kuning jika di luar) |
| Camera Card | Preview **live camera** dari webcam/kamera depan. Status: Loading/Active/Blocked |
| Clock Card | **Jam digital real-time** + tanggal. Tombol Clock In (hijau) dan Clock Out (merah). Disabled jika GPS/kamera belum aktif |
| History Card | 5 entri absensi terakhir dalam tabel (waktu, tipe, koordinat) |

**Sub-component internal:** `RecenterMap` — menggeser peta ke posisi user saat koordinat berubah.

---

### 📄 [ProfileView.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/ProfileView.jsx) — ~80 baris

**Fungsi:** Halaman profil user sendiri.

**3 Tab:**

| Tab | Konten |
|-----|--------|
| **Personal** | Bio, Employee ID, Role, Email, Phone, Gender, Marital Status, Birthday, Contract End, Leave Quota, Address |
| **Contract** | Employee ID, Employment Status (Probation/Full-time/Contract), Join Date, Contract End (merah jika expired) |
| **Team** | Manager name, daftar Team Members dengan avatar inisial |

**Tombol:** "Edit Profile" → membuka `EditProfileModal`

---

### 📄 [EmployeeView.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/EmployeeView.jsx) — ~150 baris

**Fungsi:** Daftar dan detail karyawan.

**2 Mode:**

#### Mode 1: List (default)
- Search bar (filter by nama/posisi)
- Grid kartu karyawan: foto, nama, posisi, department, employee ID, contract end
- Karyawan role `employee` tidak bisa klik untuk lihat detail (restricted)

#### Mode 2: Detail (saat klik karyawan)
- Sama seperti ProfileView tapi untuk karyawan lain
- **Tab tambahan: Attendance** (hanya Admin/Manager/HRD) — riwayat absensi bulan ini
- Tombol "Edit Details" → membuka `EditEmployeeModal`
- Tombol "Back to List"

**API call langsung:** Saat tab Attendance di-klik, langsung fetch `GET /api/attendance/history` untuk karyawan tersebut.

---

### 📄 [PayrollView.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/PayrollView.jsx) — ~120 baris

**Fungsi:** Modul payroll/penggajian.

**2 Tab:**

#### Tab 1: My Payslip
- **Summary card** biru gradient: estimasi gaji bersih bulan ini
- **Payslip card** formal: branding perusahaan, data karyawan, gaji pokok, tunjangan, total THP
- Tombol **Print** (memanggil `window.print()`)
- Status badge: PAID / UNPAID

#### Tab 2: Manage Payroll (Admin/HRD only)
- **Stats grid**: Total employees, total gaji pokok, total tunjangan, total pengeluaran semua karyawan
- **Tabel**: Semua karyawan dengan foto, nama, posisi, rekening, total gaji, status
- Tombol edit per baris → membuka `EditPayrollModal`

---

### 📄 [LeaveView.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/LeaveView.jsx) — ~100 baris

**Fungsi:** Modul cuti dan permohonan.

**3 Tab:**

| Tab | Konten | Akses |
|-----|--------|-------|
| **New Request** | Grid 8 tipe request (Leave, Permit, Sick, dll) — klik membuka `RequestModal` | Semua |
| **My History** | Tabel riwayat request sendiri (type, date, reason, status badge) | Semua |
| **Approvals** | Kartu pending request dari bawahan. 3 aksi: Approve, Reject, Return. Badge counter | Admin/Manager/HRD |

---

### 📄 [AttendancePersonal.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/AttendancePersonal.jsx) — ~90 baris

**Fungsi:** Riwayat absensi personal per bulan.

**Yang ditampilkan:**
- **Filter** bulan & tahun (dropdown)
- **Stats cards**: Total Hours, Days Present, On Time Rate (%)
- **Daily cards**: Per hari menampilkan clock in time, clock out time, total work hours
- Data diproses menggunakan `groupAttendanceByDay()` dari helpers.js

---

### 📄 [AttendanceReport.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/AttendanceReport.jsx) — ~76 baris

**Fungsi:** Laporan kehadiran bulanan seluruh karyawan. **Hanya Admin/Manager/HRD.**

**Yang ditampilkan:**
- **Filter** bulan & tahun
- **Tombol Export CSV** — download laporan dalam format CSV
- **Tabel**: Foto profil + nama, days present, late days, total hours, work rate (progress bar visual)

**Fitur Export:** Membuat Blob CSV secara client-side dan trigger download via invisible `<a>` tag.

---

### 📄 [ScheduleView.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/ScheduleView.jsx) — ~80 baris

**Fungsi:** Kalender jadwal perusahaan.

**Yang ditampilkan:**
- **Header**: Nama bulan + tahun, tombol navigasi (prev/next/today)
- **Weekday header**: Mon–Sun
- **Calendar grid**: Setiap sel menampilkan nomor hari + status:
  - **Work day**: Kosong (hari kerja normal)
  - **Weekend**: Tag "Weekend" (Sabtu/Minggu)
  - **Holiday**: Tag nama hari libur (dari iCal feed)
  - **Today**: Badge "TODAY" dengan highlight khusus

**Logika kalender:** Menghitung leading empty cells, days in month, trailing empty cells secara dinamis.

---

## 6. Components — Modals

### 📄 [EditProfileModal.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/modals/EditProfileModal.jsx) — ~50 baris

**Fungsi:** Modal form untuk mengedit profil sendiri.

**Fields:** Name, Phone, Gender (dropdown), Birthday (date picker), Marital Status (dropdown), Bio (textarea max 250), Address (textarea)

**Aksi:** Submit → `PUT /api/users/profile` → update user state

---

### 📄 [RequestModal.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/modals/RequestModal.jsx) — ~55 baris

**Fungsi:** Modal form untuk mengajukan request (cuti, izin, dll).

**Logika dinamis:**
- Jika tipe **Leave**: Tampilkan sisa jatah cuti + validasi durasi vs quota
- Jika **Leave/Sick/Permit**: Tampilkan field End Date + kalkulasi durasi otomatis
- Jika **Reimbursement/Expense**: Tampilkan field Amount
- Semua tipe: Field Reason (wajib)

**Aksi:** Submit → `POST /api/requests` → refresh daftar request

---

### 📄 [EditEmployeeModal.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/modals/EditEmployeeModal.jsx) — ~100 baris

**Fungsi:** Modal admin untuk mengelola data karyawan. **Paling kompleks.**

**Fields:**
- Position, Department, Role (dropdown 4 level), Employment Status, Employee ID
- Reporting Manager (dropdown dari daftar karyawan lain)
- Leave Quota, Contract End Date
- **Team Members section**: Add/remove dari dropdown, tampil sebagai tags

**Aksi:**
- **Save** → `PUT /api/employees/:id` → update employee + sync ke user state jika edit diri sendiri
- **Delete** → `DELETE /api/employees/:id` (dengan konfirmasi)

---

### 📄 [OfficeSettingsModal.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/modals/OfficeSettingsModal.jsx) — ~70 baris

**Fungsi:** Modal admin untuk mengatur lokasi kantor dan hari kerja.

**Section 1 - Lokasi:**
- Office Name, Latitude, Longitude, Radius (meter)
- Tip: "Buka Google Maps, klik kanan → salin koordinat"

**Section 2 - Hari Kerja:**
- 7 checkbox (Monday–Sunday)
- Setiap toggle langsung auto-save ke `PUT /api/settings/workdays`

**Aksi:** Submit → `PUT /api/settings/office` → update officeSettings state (peta langsung berubah)

---

### 📄 [EditPayrollModal.jsx](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/client/src/components/modals/EditPayrollModal.jsx) — ~45 baris

**Fungsi:** Modal admin untuk mengedit data payroll karyawan.

**Fields:**
- Basic Salary (IDR), Allowance/Bonus (IDR)
- Payroll Status (Paid/Unpaid dropdown)
- Bank Account Number

**Preview:** Menampilkan kalkulasi total THP (Take Home Pay) real-time saat mengedit nilai.

**Aksi:** Submit → `PUT /api/employees/:id/payroll` → update employee + refresh tabel payroll
