# Product Requirements Document (PRD)
## EMS — Employee Management System
**Version:** 2.0 (Post-Refactoring)
**Last Updated:** 17 April 2026
**Author:** Zidhan F

---

## 1. Executive Summary

EMS (Employee Management System) adalah aplikasi web HRIS berbasis cloud yang dirancang untuk mengelola data karyawan, absensi, cuti, payroll, dan jadwal secara terpusat. Aplikasi ini menggunakan arsitektur **Single Page Application (SPA)** dengan autentikasi Google OAuth 2.0 dan geolocation-based attendance system.

---

## 2. Problem Statement

Perusahaan membutuhkan sistem terpadu untuk:
- Mengelola data karyawan secara digital
- Mencatat absensi berbasis lokasi GPS dengan verifikasi radius kantor
- Mengotomasi alur pengajuan cuti, izin, dan reimbursement
- Menyediakan laporan kehadiran bulanan yang akurat
- Mengelola payroll dengan transparansi penuh

---

## 3. Target Users & Roles

| Role | Akses | Deskripsi |
|------|-------|-----------|
| **Admin** | Full Access | Kelola semua data, settings, approval, payroll |
| **HRD** | Management | Kelola karyawan, approval, office settings |
| **Manager** | Supervisory | Lihat tim, approval cuti, attendance report |
| **Employee** | Self-service | Absensi, profil, cuti, payslip pribadi |

---

## 4. Core Features

### 4.1 Authentication & Authorization
- Login via **Google OAuth 2.0** (JWT verification)
- Role-based access control (RBAC) dengan 4 level
- Auto-registration untuk user baru dengan status **Probation** (3 bulan kontrak otomatis)
- Leave quota awal: **0 hari** (diatur oleh HRD/Admin)

### 4.2 Dashboard
- **Feed Tab**: On-leave today, recent activities, quick stats
- **My Info Tab**: 
  - Peta lokasi kantor (Leaflet/OpenStreetMap)
  - Verifikasi radius GPS real-time
  - Live camera preview untuk foto absensi
  - Clock In / Clock Out system
  - Riwayat absensi terbaru

### 4.3 Employee Management
- Daftar karyawan dengan search & filter
- Detail profil lengkap (Personal, Contract, Team, Attendance)
- Admin: Edit posisi, role, department, manager, team members
- Admin: Hapus karyawan
- ID karyawan otomatis (format: `EMS-XXX`)

### 4.4 Attendance System
- **Clock In/Out** berbasis:
  - GPS geolocation (radius kantor configurable)
  - Camera selfie verification
  - Waktu validasi (Clock In ≥ 08:00, Clock Out ≥ 17:00)
  - Hari kerja configurable
- **Personal Attendance**: Riwayat per bulan/tahun, statistik jam kerja
- **Monthly Report** (Admin/HRD/Manager): 
  - Tabel semua karyawan dengan foto profil
  - Days present, late days, total hours, work rate
  - Export ke **CSV**

### 4.5 Leave & Request Management
- 8 tipe request: Leave, Permit, Sick, Overtime, Reimbursement, Timesheet, Expense, Other
- Validasi otomatis terhadap jatah cuti
- Alur approval 3-pilihan: Approve, Reject, Return
- Riwayat lengkap dengan status tracking

### 4.6 Payroll Management
- **My Payslip**: Tampilan slip gaji dengan branding perusahaan, printable
- **Manage Payroll** (Admin/HRD): 
  - Edit gaji pokok, tunjangan, rekening bank
  - Status pembayaran (Paid/Unpaid)
  - Total pengeluaran seluruh karyawan
  - **Bulk Actions**: Finalize all, Mark all as Paid, Send PDF Emails via cron
- **Audit Logs**: Timestamps dan detail setiap aksi bulk payroll (who, when, what)

### 4.7 Schedule / Calendar
- Kalender bulanan dengan navigasi
- Integrasi hari libur nasional (via iCal)
- Deteksi weekend otomatis
- Highlight hari ini

### 4.8 Profile Management
- Edit informasi pribadi (nama, telepon, bio, alamat, dll)
- Tab Personal, Contract, Team
- Contract end date tracking dengan visual warning

### 4.9 Automation & Maintenance
- **Database Backup**: Sistem pencadangan database `ems_db` otomatis/manual ke storage lokal
- **Cron Jobs**:
  - Pengecekan status kehadiran harian (Attendance Reminder) pukul 08:30 WIB
  - Kalkulasi payroll otomatis setiap tanggal 25
  - Pengiriman email slip gaji massal otomatis

---

## 5. Non-Functional Requirements

| Aspek | Requirement |
|-------|-------------|
| **Performance** | Build production < 1 detik; Bundle JS < 500KB gzipped |
| **Security** | Helmet headers, CORS whitelist, Rate limiting, NoSQL injection protection |
| **Availability** | Support deployment ke cloud (Render, Vercel, Railway) |
| **Browser** | Chrome, Firefox, Edge, Safari (Mobile & Desktop) |
| **Responsiveness** | Responsive design untuk mobile & tablet |

---

## 6. Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite 8 |
| Styling | Vanilla CSS (custom design system) |
| Maps | Leaflet + react-leaflet + OpenStreetMap |
| Auth | Google OAuth 2.0 (@react-oauth/google) |
| HTTP | Axios (with interceptor) |
| Backend | Node.js + Express.js |
| Database | MongoDB (Dockerized) + Mongoose |
| Security | Helmet, express-rate-limit, CORS |
| Calendar | node-ical (holiday integration) |
| Automation | node-cron (attendance reminders, payroll calculation) |
| Container | Docker + Docker Compose |

---

## 7. Success Metrics

| Metric | Target |
|--------|--------|
| Login success rate | > 99% |
| Attendance accuracy | GPS radius ≤ configured distance |
| Page load time | < 2 detik |
| Build time | < 1 detik |
| Zero downtime deployment | Via cloud platform |
