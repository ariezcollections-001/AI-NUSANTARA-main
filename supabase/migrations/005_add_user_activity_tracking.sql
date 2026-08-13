-- =============================================================================
-- 005: USER ACTIVITY TRACKING (real-time presence untuk LIVE MONITOR founder)
--  - last_seen  : di-update oleh client (dashboard layout) tiap user saat online.
--    LIVE MONITOR founder menghitung "user aktif" dari kolom ini (>= 5 menit).
--  - is_banned  : DISIMPAN di founder_config.key_value 'banned_users' (JSON
--    array) sebagai source-of-truth middleware AI. Pada route
--    /api/founder/users, is_banned dihitung & disematkan ke tiap baris akun
--    agar manajemen banned selaras dengan total akun terdaftar. Kolom boolean
--    di tabel users sengaja TIDAK ditambah agar tidak ada dua sumber kebenaran.
-- =============================================================================

-- 1) Tambahkan kolom jika belum ada (idempoten)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
-- (kolom boolean is_banned sengaja tidak ditambah — dikelola via founder_config.banned_users)

-- 2) Backfill last_seen dari auth.users.last_sign_in_at untuk user yang belum tercatat aktif
UPDATE public.users u
SET last_seen = au.last_sign_in_at
FROM auth.users au
WHERE u.last_seen IS NULL
  AND u.id = au.id
  AND au.last_sign_in_at IS NOT NULL;

-- 3) Index suport live query (online dalam 5 menit)
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON public.users (last_seen DESC);

-- CATATAN: daftar akun yang diblokir (is_banned) disimpan di
--          founder_config.key_value 'banned_users' (JSON array) sebagai
--          source-of-truth middleware AI. Pada route /api/founder/users,
--          is_banned dihitung & disematkan ke tiap baris akun sehingga
--          manajemen banned selaras dengan daftar total akun terdaftar.
--          Kolom boolean is_banned sengaja TIDAK ditambahkan agar tidak ada
--          dua sumber kebenaran yang dapat drift.
