-- Opsional: hapus RPC login lama (username staff) jika pernah dipasang.
-- Jalankan sekali di SQL Editor bila fungsi ini masih ada di project Anda.

drop function if exists public.resolve_login_email_by_staff_username(text);

notify pgrst, 'reload schema';
