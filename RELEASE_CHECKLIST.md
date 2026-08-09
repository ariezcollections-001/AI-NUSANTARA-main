# Release Checklist

Checklist singkat sebelum melakukan deploy setiap versi baru.

## Cara Penggunaan

1. Salin checklist di bawah ke dalam issue/PR release atau gunakan langsung.
2. Centang setiap item setelah diverifikasi.
3. Semua item **harus** tercentang sebelum deploy.
4. Jika ada item yang gagal, perbaiki terlebih dahulu sebelum melanjutkan.

---

## Checklist Pre-Release

### Versi: ______________
### Tanggal Rilis: ______________
### Status: draft / ready / deployed

---

### Fitur

- [ ] Fitur baru sudah diimplementasikan sesuai spesifikasi
- [ ] Fitur lama tidak rusak (regression test)
- [ ] Semua alur utama (happy path) sudah diuji
- [ ] Alur error/edge case sudah diuji
- [ ] Smoke test end-to-end berjalan sukses

### UI

- [ ] Tampilan sudah dicek di desktop
- [ ] Tampilan sudah dicek di mobile/responsive
- [ ] Tidak ada error konsol (console error)
- [ ] Loading state dan empty state sudah ditangani
- [ ] Pesan error ditampilkan dengan jelas ke pengguna

### API

- [ ] Semua endpoint API berfungsi dengan benar
- [ ] Response status code sudah sesuai (200, 400, 401, 403, 404, 500)
- [ ] Validasi input sudah diterapkan
- [ ] Autentikasi & otorisasi sudah dicek
- [ ] Webhook/notifikasi berfungsi (jika ada)

### Environment

- [ ] Environment variables sudah disiapkan di semua environment (dev/staging/prod)
- [ ] Konfigurasi database/migrasi sudah dijalankan
- [ ] Secret/key tidak bocor ke repository
- [ ] Build produksi berhasil (tanpa error)
- [ ] Konfigurasi deployment (Vercel/dll) sudah sesuai

### Rollback

- [ ] Rollback plan tersedia dan terdokumentasi
- [ ] Versi sebelumnya sudah ditandai (tag/git commit)
- [ ] Prosedur rollback sudah diuji/dipahami
- [ ] Backup database tersedia (jika ada perubahan skema)
- [ ] Tim mengetahui cara melakukan rollback

---

## Approval

- [ ] Semua checklist di atas sudah tercentang
- [ ] Disetujui untuk deploy

Nama Reviewer: ______________
Tanggal: ______________

---

## Setelah Deploy

- [ ] Deploy berhasil (status: deployed)
- [ ] Monitoring aktif (log, error tracking)
- [ ] CHANGELOG.md sudah diperbarui dengan status deployed
- [ ] Tag versi sudah dibuat di git