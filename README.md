# Aplikasi Absensi Karyawan (Android - React Native & Expo)

Aplikasi mobile presensi dan absensi karyawan berbasis Android dengan antarmuka (UI) yang bersih, sederhana, modern, dan intuitif.

---

## 🌟 Fitur Utama

1. **Role Akun (Admin / HRD vs Karyawan)**
   - **👑 Role Admin / HRD**:
     - Memantau rekap absensi seluruh staf secara *real-time*.
     - Menyetujui (**Approve**) atau menolak (**Reject**) permohonan izin/sakit/cuti karyawan langsung dari aplikasi.
     - Mengatur titik koordinat dan radius toleransi kantor.
     - Mereset kunci perangkat (device binding) karyawan yang berganti ponsel.
   - **👤 Role Karyawan**:
     - Melakukan absensi masuk & pulang dengan validasi lokasi GPS dan kamera selfie.
     - Melihat riwayat presensi pribadi.
     - Mengajukan permohonan izin/sakit/cuti beserta upload surat keterangan.

2. **Keamanan Berlapis Anti-Kecurangan & Anti-Titip Absen**
   - **🔒 Kunci Perangkat (Device Binding / 1 Akun = 1 HP)**: Setiap akun karyawan otomatis terikat ke ID perangkat ponselnya saat pertama kali digunakan. Akun tidak dapat dipakai absen di HP orang lain (titip absen ditolak otomatis).
   - **🛡️ Deteksi Fake GPS (Anti-Mock Location)**: Sistem otomatis mendeteksi apakah koordinat berasal dari aplikasi pemalsu lokasi (*mock provider*) dan langsung menolak absensi jika terdeteksi.
   - **📸 Live Camera Only**: Pemilihan foto dari galeri dinonaktifkan untuk presensi harian, mewajibkan tangkapan kamera langsung saat itu juga.
   - **👑 Reset Kunci Perangkat oleh Admin**: Admin/HRD memiliki fitur di panel untuk mereset kunci perangkat jika karyawan berganti ponsel baru.

3. **Autentikasi & Login Otomatis (Tanpa Perlu Pilih Peran)**
   - Layar login sederhana dan langsung: pengguna cukup memasukkan **NIP** dan **Kata Sandi**.
   - Sistem otomatis mendeteksi peran akun:
     - NIP diawali `ADMIN` $\rightarrow$ otomatis masuk ke **Panel Admin / HRD**.
     - NIP karyawan $\rightarrow$ otomatis masuk ke **Menu Absensi Karyawan**.
   - Sesi login tersimpan secara aman di memori lokal ponsel.
   - Tombol **Keluar (Logout)** di header navigasi dan menu Pengaturan.

2. **Presensi Masuk & Pulang Otomatis (Check-in & Check-out)**
   - Pencatatan jam dan tanggal otomatis dengan tampilan jam digital *real-time*.
   - Deteksi status otomatis: **Tepat Waktu** vs **Terlambat** berdasarkan batas jam kantor yang dikonfigurasi.
   - Status pulang: **Selesai** vs **Pulang Cepat**.
   - Input catatan atau laporan ringkas pekerjaan harian.

2. **Validasi Lokasi GPS & Radius Kantor**
   - Mendeteksi koordinat GPS dan alamat presisi karyawan menggunakan `expo-location`.
   - Menggunakan rumus *Haversine* untuk menghitung jarak real-time (dalam meter) antara karyawan dan titik kantor.
   - Indikator status jelas: **Dalam Radius Kantor** (Hijau) atau **Di Luar Radius Kantor** (Merah).
   - Tombol **Refresh Lokasi** sekali klik.

3. **Foto Selfie Kehadiran (Verifikasi Wajah)**
   - Integrasi kamera depan menggunakan `expo-image-picker` untuk foto selfie bukti kehadiran.
   - Pratinjau foto langsung sebelum melakukan absensi.
   - Opsi foto ulang atau memilih dari galeri saat uji coba.

4. **Riwayat Absensi & Rekap Statistik**
   - Ringkasan statistik bulanan: **Total Masuk**, **Tepat Waktu**, dan **Terlambat**.
   - Filter riwayat: Semua, Masuk, dan Pulang.
   - Modal detail lengkap tiap presensi: menampilkan foto selfie, koordinat & alamat, jarak ke kantor, serta opsi hapus.

5. **Pengajuan Izin & Cuti**
   - Formulir permohonan izin: **Izin**, **Sakit**, **Cuti**, atau **Dinas Luar**.
   - Pemilihan rentang tanggal permohonan dan alasan lengkap.
   - Unggah atau foto surat dokter / bukti pendukung langsung dari aplikasi.
   - Daftar riwayat pengajuan izin lengkap dengan status persetujuan.

6. **Pengaturan Fleksibel (Profil & Titik Kantor)**
   - Edit nama lengkap, NIP, jabatan, dan departemen karyawan.
   - **Fitur 1-Klik**: *"Gunakan Lokasi Saya Sekarang Sebagai Titik Kantor"* — sangat memudahkan pengujian di mana pun Anda berada tanpa perlu mencari koordinat peta secara manual.
   - Pengaturan toleransi radius kehadiran (default 100 meter) dan jam kerja.
   - Fitur reset data simulasi.

---

## 🚀 Cara Menjalankan Aplikasi di HP Android

### Langkah 1: Pasang Aplikasi Expo Go di HP Android
Unduh aplikasi **Expo Go** secara gratis di Google Play Store pada ponsel Android Anda.

### Langkah 2: Jalankan Dev Server di Komputer
Buka terminal di folder proyek (`d:\Android\Project-absensi`) lalu jalankan perintah:
```bash
npx expo start
```

### Langkah 3: Scan QR Code
1. Pastikan HP Android dan komputer Anda terhubung ke jaringan Wi-Fi yang sama (atau gunakan mode tunnel `npx expo start --tunnel`).
2. Buka aplikasi **Expo Go** di HP Android, pilih menu **Scan QR Code**, dan arahkan kamera ke barcode yang muncul di terminal komputer Anda.
3. Aplikasi akan langsung terkompilasi dan berjalan di HP Android Anda!

---

## 📦 Cara Membangun APK (Build Standalone APK)

Untuk membuat file `.apk` mandiri yang dapat diinstal langsung di HP tanpa Expo Go:

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
2. Login akun Expo:
   ```bash
   eas login
   ```
3. Konfigurasi build APK:
   ```bash
   eas build:configure
   ```
4. Build APK Android:
   ```bash
   eas build --platform android --profile preview
   ```
Setelah selesai, link download file `.apk` akan langsung diberikan oleh EAS.
