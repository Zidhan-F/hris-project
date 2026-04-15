# HRIS Project

Human Resources Information System (HRIS) berbasis EMS dengan monorepo React + Express + MongoDB.

## Ringkasan

Proyek ini terdiri dari:
- `client/`: Frontend React dengan Vite, Google OAuth, peta Leaflet, dan fitur absensi.
- `server/`: Backend Express dengan MongoDB, Mongoose, Google OAuth verification, absensi, riwayat, dan ringkasan hari ini.
- `docker-compose.yml`: Konfigurasi MongoDB, backend, dan frontend untuk pengembangan container.

## Fitur Utama

- Login Google OAuth
- Absensi kehadiran dengan lokasi GPS
- Riwayat absensi dan ringkasan kehadiran harian
- Dashboard karyawan dengan manajemen profil
- Request jenis cuti, izin, sakit, lembur, reimburse, dan lain-lain
- Backend MongoDB + Express + Mongoose
- Frontend React + Vite + Leaflet

## Struktur Proyek

- `client/` - Frontend
- `server/` - Backend
- `docker-compose.yml` - Layanan MongoDB, backend, frontend
- `package.json` - Skrip build monorepo

## Persiapan Lingkungan

### 1. Clone repository

```bash
git clone https://github.com/Zidhan-F/hris-project.git
cd hris-project
```

### 2. Install dependencies

```bash
cd server
npm install
cd ../client
npm install
```

### 3. Konfigurasi environment

Buat file `.env` di `server/` dengan variabel berikut:

```env
PORT=5000
MONGO_URI=<mongodb_connection_string>
GOOGLE_CLIENT_ID=<your_google_oauth_client_id>
```

Jika menggunakan Docker Compose, file `.env` server akan dimuat secara otomatis.

## Menjalankan Aplikasi

### Pilihan 1: Docker Compose

```bash
docker-compose up --build
```

- Backend tersedia di `http://localhost:5000`
- Frontend tersedia di `http://localhost:5173`
- MongoDB tersedia di `mongodb://localhost:27018`

### Pilihan 2: Jalankan lokal manual

Backend:
```bash
cd server
npm run dev
```

Frontend:
```bash
cd client
npm run dev
```

## Build Produksi

Dari root proyek:

```bash
npm run build
```

Skrip ini akan membangun frontend dan memindahkan hasilnya ke direktori `dist`.

## Catatan

- Pastikan `GOOGLE_CLIENT_ID` dikonfigurasi untuk login OAuth Google.
- `MONGO_URI` harus menunjuk ke instance MongoDB yang dapat diakses.
- Frontend menggunakan `VITE_API_URL` untuk koneksi API jika diperlukan.

## Kontak

Jika membutuhkan bantuan, silakan lihat repository atau ajukan issue di GitHub.
