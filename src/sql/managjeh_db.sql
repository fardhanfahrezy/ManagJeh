-- ====================================================================
-- 1. PEMBUATAN TABEL CATEGORIES & TRANSACTIONS
-- ====================================================================

-- Buat ENUM untuk tipe transaksi agar data konsisten secara rigid
CREATE TYPE transaction_type AS ENUM ('income', 'expense');

-- Buat Tabel Kategori (Masing-masing user memiliki kategorinya sendiri)
CREATE TABLE public.categories (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL,
    type        transaction_type NOT NULL,
    color_code  VARCHAR(7) NOT NULL DEFAULT '#3B82F6', -- Hex warna untuk grafik
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    
    -- Mencegah user membuat kategori dengan nama & tipe yang kembar
    CONSTRAINT unique_user_category UNIQUE (user_id, name, type)
);

-- Buat Tabel Transaksi Keuangan
CREATE TABLE public.transactions (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    amount      NUMERIC(15, 2) NOT NULL CHECK (amount > 0), -- Menggunakan NUMERIC untuk akurasi uang (bukan float)
    type        transaction_type NOT NULL,
    description TEXT,
    date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- 2. OTOMATISASI DUPLIKASI KATEGORI DASAR (TRIGGER & FUNCTION)
-- ====================================================================

-- Buat fungsi yang akan dijalankan otomatis saat user baru mendaftar
CREATE OR REPLACE FUNCTION public.handle_new_user_categories()
RETURNS TRIGGER AS $$
BEGIN
    -- Masukkan kategori default untuk pengeluaran (expense)
    INSERT INTO public.categories (user_id, name, type, color_code) 
    VALUES
        (NEW.id, 'Makanan & Minuman', 'expense', '#EF4444'),  -- Merah
        (NEW.id, 'Transportasi', 'expense', '#F59E0B'),       -- Oranye
        (NEW.id, 'Belanja Bulanan', 'expense', '#3B82F6'),    -- Biru
        (NEW.id, 'Hiburan & Rekreasi', 'expense', '#8B5CF6'), -- Ungu
        (NEW.id, 'Tagihan & Utilitas', 'expense', '#EC4899'); -- Pink

    -- Masukkan kategori default untuk pemasukan (income)
    INSERT INTO public.categories (user_id, name, type, color_code) 
    VALUES
        (NEW.id, 'Gaji Utama', 'income', '#10B981'),           -- Hijau
        (NEW.id, 'Investasi', 'income', '#06B6D4'),            -- Cyan
        (NEW.id, 'Sampingan (Freelance)', 'income', '#84CC16');-- Lemon

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang fungsi di atas sebagai TRIGGER pada tabel bawaan auth.users Supabase
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user_categories();

-- ====================================================================
-- 3. PENGETATAN KEAMANAN DATABASE (ROW LEVEL SECURITY - RLS)
-- ====================================================================

-- Aktifkan RLS pada kedua tabel
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Kebijakan Kategori: User hanya bisa mengelola kategorinya sendiri
CREATE POLICY "Users can manage their own categories" 
    ON public.categories 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Kebijakan Transaksi: User hanya bisa mengelola transaksinya sendiri
CREATE POLICY "Users can manage their own transactions" 
    ON public.transactions 
    FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id AND 
        EXISTS (
            SELECT 1 FROM public.categories c 
            WHERE c.id = category_id AND c.user_id = auth.uid()
        )
    );

-- Membuat fungsi kalkulasi ringkasan keuangan
CREATE OR REPLACE FUNCTION get_financial_summary(user_id_param UUID)
RETURNS json AS $$
DECLARE
    total_balance   NUMERIC;
    monthly_income  NUMERIC;
    monthly_expense NUMERIC;
BEGIN
    -- 1. Hitung Total Saldo (Semua Pemasukan - Semua Pengeluaran sepanjang waktu)
    SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)
    INTO total_balance
    FROM public.transactions
    WHERE user_id = user_id_param;

    -- 2. Hitung Total Pemasukan Bulan Berjalan
    SELECT COALESCE(SUM(amount), 0)
    INTO monthly_income
    FROM public.transactions
    WHERE user_id = user_id_param 
      AND type = 'income' 
      AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE);

    -- 3. Hitung Total Pengeluaran Bulan Berjalan
    SELECT COALESCE(SUM(amount), 0)
    INTO monthly_expense
    FROM public.transactions
    WHERE user_id = user_id_param 
      AND type = 'expense' 
      AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE);

    -- Kembalikan hasil kalkulasi sebagai JSON
    RETURN json_build_object(
        'total_balance', total_balance,
        'monthly_income', monthly_income,
        'monthly_expense', monthly_expense
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 1. FONDASI BUDGETING (Pembaruan Tabel Kategori)
-- ==============================================================================
-- Menambahkan batas anggaran. Nilai 0 berarti tidak ada batas.
ALTER TABLE public.categories 
    ADD COLUMN budget_limit NUMERIC(15, 2) DEFAULT 0;

-- ==============================================================================
-- 2. FONDASI RECURRING TRANSACTIONS (Tabel Baru)
-- ==============================================================================
CREATE TABLE public.recurring_schedules (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id   UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    amount        NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    type          transaction_type NOT NULL,
    description   TEXT,
    frequency     VARCHAR(20) DEFAULT 'monthly', -- Opsi masa depan: weekly, yearly
    next_run_date DATE NOT NULL,
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS untuk tabel berulang
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own recurring" 
    ON public.recurring_schedules 
    FOR ALL 
    USING (auth.uid() = user_id);

-- ==============================================================================
-- 3. FONDASI NET WORTH TRACKER (Fungsi SQL Agregasi Kumulatif)
-- ==============================================================================
-- Menghitung akumulasi saldo dari awal waktu pengguna mendaftar hingga bulan ini
CREATE OR REPLACE FUNCTION get_monthly_net_worth(user_id_param UUID)
RETURNS TABLE(month_year TEXT, cumulative_balance NUMERIC) AS $$
BEGIN
    RETURN QUERY
    WITH monthly_flows AS (
        SELECT 
            to_char(date_trunc('month', date), 'YYYY-MM') AS m_year,
            SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net_flow
        FROM public.transactions
        WHERE user_id = user_id_param
        GROUP BY 1
    )
    SELECT 
        m_year,
        -- Window Function untuk menjumlahkan metrik bulan-bulan sebelumnya (Kumulatif)
        SUM(net_flow) OVER (ORDER BY m_year ASC) AS cumulative_balance
    FROM monthly_flows
    ORDER BY m_year ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Aktifkan ekstensi pg_cron (Wajib untuk otomasi basis data)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Buat fungsi pemrosesan transaksi berulang
CREATE OR REPLACE FUNCTION process_recurring_transactions()
RETURNS void AS $$
BEGIN
    -- A. Masukkan data ke tabel transaksi berdasarkan jadwal yang sudah jatuh tempo
    INSERT INTO public.transactions (user_id, category_id, amount, type, description, date)
    SELECT 
        user_id, 
        category_id, 
        amount, 
        type, 
        COALESCE(description, 'Transaksi') || ' (Otomatis)', 
        CURRENT_TIMESTAMP
    FROM public.recurring_schedules
    WHERE is_active = true 
      AND next_run_date <= CURRENT_DATE;

    -- B. Perbarui tanggal jatuh tempo ke bulan berikutnya (Untuk frekuensi bulanan)
    UPDATE public.recurring_schedules
    SET next_run_date = next_run_date + INTERVAL '1 month'
    WHERE is_active = true 
      AND next_run_date <= CURRENT_DATE 
      AND frequency = 'monthly';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Daftarkan fungsi ke Cron Job (Berjalan setiap jam 00:00)
SELECT cron.schedule(
    'daily_recurring_processor', -- Nama Job
    '0 0 * * *',                 -- Jadwal eksekusi (Format Cron)
    'SELECT process_recurring_transactions();'
);

-- Hapus job lama terlebih dahulu untuk menghindari redundansi
SELECT cron.unschedule('daily_recurring_processor');

-- Buat ulang fungsi dengan penanganan Zona Waktu Asia/Jakarta (WIB)
CREATE OR REPLACE FUNCTION public.process_recurring_transactions()
RETURNS void AS $$
DECLARE
    current_wib_date DATE;
BEGIN
    -- Mengonversi waktu server UTC ke tanggal lokal WIB
    current_wib_date := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::DATE;

    -- 1. Injeksi transaksi yang jatuh tempo hari ini
    INSERT INTO public.transactions (user_id, category_id, amount, type, description, date)
    SELECT 
        user_id, 
        category_id, 
        amount, 
        type, 
        COALESCE(description, 'Transaksi') || ' (Otomatis Bulanan)', 
        (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') -- Timestamp lokal
    FROM public.recurring_schedules
    WHERE is_active = true 
      AND next_run_date <= current_wib_date;

    -- 2. Majukan jadwal ke bulan berikutnya secara presisi
    UPDATE public.recurring_schedules
    SET next_run_date = next_run_date + INTERVAL '1 month'
    WHERE is_active = true 
      AND next_run_date <= current_wib_date 
      AND frequency = 'monthly';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Jadwalkan kembali cron untuk berjalan setiap jam 00:00 WIB (17:00 UTC)
SELECT cron.schedule(
    'daily_recurring_processor',
    '0 17 * * *', -- Jam 17:00 UTC sama dengan Jam 00:00 WIB
    'SELECT public.process_recurring_transactions();'
);

-- ==============================================================================
-- AUDIT & PENGUNCIAN KEAMANAN (RLS HARDENING)
-- ==============================================================================

-- 1. Pastikan RLS aktif secara mutlak pada tabel kategori
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 2. Hapus kebijakan kategori yang lama jika longgar 
DROP POLICY IF EXISTS "Users can manage their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can view their own categories" ON public.categories;

-- 3. Buat kebijakan tunggal yang ketat dan granular (ALL OPERATIONS)
CREATE POLICY "Strict user isolation for categories" 
    ON public.categories 
    FOR ALL 
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Tambahkan indeks performa pada kolom pencarian (Optimasi Query Speed)
CREATE INDEX IF NOT EXISTS idx_categories_user_type ON public.categories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_recurring_user_active ON public.recurring_schedules(user_id, is_active);

-- ==============================================================================
-- 1. PILAR MULTI-ACCOUNT & MULTI-CURRENCY
-- ==============================================================================

-- Buat tipe akun yang diizinkan
DO $$ 
BEGIN
    CREATE TYPE account_sub_type AS ENUM ('cash', 'bank', 'e-wallet', 'crypto', 'investment');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Buat tabel akun baru
CREATE TABLE IF NOT EXISTS public.accounts (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    type       account_sub_type DEFAULT 'bank',
    currency   VARCHAR(3) DEFAULT 'IDR',
    balance    NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aktifkan RLS untuk tabel akun
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Strict user isolation for accounts" 
    ON public.accounts 
    FOR ALL 
    TO authenticated
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- Memperbarui tabel transaksi agar terhubung ke akun dan mendukung transfer antar-rekening
-- Serta penambahan kolom 'deleted_at' untuk fitur SOFT DELETE
ALTER TABLE public.transactions 
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS transfer_to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ==============================================================================
-- 2. PILAR KEAMANAN: AUDIT LOG SYSTEM
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action     VARCHAR(100) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id  UUID,
    old_data   JSONB,
    new_data   JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view their own audit logs" 
    ON public.audit_logs 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

-- Trigger Otomatis untuk mencatat log audit saat transaksi dihapus secara soft-delete
CREATE OR REPLACE FUNCTION log_transaction_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
        VALUES (OLD.user_id, 'SOFT_DELETE_TRANSACTION', 'transactions', OLD.id, to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_audit_soft_delete
    AFTER UPDATE ON public.transactions
    FOR EACH ROW 
    EXECUTE FUNCTION log_transaction_soft_delete();

-- ==============================================================================
-- 3. PILAR INTELIGENSI: ALGORITMA PREDIKTIF AI (BURN RATE CALCULATOR)
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_budget_predictive_analysis(user_id_param UUID)
RETURNS TABLE(
    category_name       TEXT,
    budget_limit        NUMERIC,
    current_spent       NUMERIC,
    days_elapsed        INT,
    days_in_month       INT,
    burn_rate_per_day   NUMERIC,
    projected_end_spent NUMERIC,
    is_anomaly          BOOLEAN,
    ai_warning_message  TEXT
) AS $$
DECLARE
    start_of_month   TIMESTAMPTZ;
    current_time_wib TIMESTAMPTZ;
    total_days       INT;
    elapsed_days     INT;
BEGIN
    current_time_wib := NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta';
    start_of_month   := date_trunc('month', current_time_wib);
    total_days       := EXTRACT(DAY FROM (date_trunc('month', current_time_wib) + INTERVAL '1 month' - INTERVAL '1 day'));
    elapsed_days     := EXTRACT(DAY FROM current_time_wib);
    
    IF elapsed_days = 0 THEN 
        elapsed_days := 1; 
    END IF;

    RETURN QUERY
    WITH current_month_expenses AS (
        SELECT 
            c.name AS cat_name,
            c.budget_limit AS limit_amt,
            SUM(t.amount) AS spent_amt
        FROM public.transactions t
        JOIN public.categories c ON t.category_id = c.id
        WHERE t.user_id = user_id_param 
          AND t.deleted_at IS NULL 
          AND t.type = 'expense'
          AND t.date >= start_of_month
          AND c.budget_limit > 0
        GROUP BY c.name, c.budget_limit
    )
    SELECT 
        cat_name::TEXT,
        limit_amt::NUMERIC,
        spent_amt::NUMERIC,
        elapsed_days::INT,
        total_days::INT,
        (spent_amt / elapsed_days)::NUMERIC AS burn_rate_per_day,
        ((spent_amt / elapsed_days) * total_days)::NUMERIC AS projected_end_spent,
        (((spent_amt / elapsed_days) * total_days) > limit_amt)::BOOLEAN AS is_anomaly,
        CASE 
            WHEN ((spent_amt / elapsed_days) * total_days) > limit_amt THEN
                'Peringatan Kritis! Berdasarkan kecepatan belanja Anda saat ini (' || 
                to_char((spent_amt / elapsed_days), 'FM999,999,999') || '/hari), anggaran kategori ' || 
                cat_name || ' diproyeksikan akan membengkak hingga ' || 
                to_char(((spent_amt / elapsed_days) * total_days), 'FM999,999,999') || 
                ' di akhir bulan. Kurangi pengeluaran segera!'
            WHEN (spent_amt / limit_amt) >= 0.5 AND elapsed_days <= (total_days * 0.3) THEN
                'Anomali Terdeteksi: Anda telah menghabiskan lebih dari 50% anggaran ' || cat_name || 
                ' sebelum tanggal 10 bulan ini. Kecepatan belanja terlalu tinggi.'
            ELSE
                'Anggaran aman. Pola konsumsi Anda untuk kategori ' || cat_name || ' terpantau stabil.'
        END::TEXT AS ai_warning_message
    FROM current_month_expenses;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_account_balance(acct_id UUID, amt NUMERIC) 
RETURNS void AS $$
BEGIN
    UPDATE public.accounts 
    SET balance = balance + amt 
    WHERE id = acct_id;
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_account_balance(acct_id UUID, amt NUMERIC) 
RETURNS void AS $$
BEGIN
    UPDATE public.accounts 
    SET balance = balance - amt 
    WHERE id = acct_id;
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Tambahkan kolom account_id ke tabel recurring_schedules agar terhubung ke akun dompet
ALTER TABLE public.recurring_schedules 
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- 2. Bersihkan dan paksa Supabase memuat ulang cache skema relasi
NOTIFY pydantic_supabase_admin_pgrst, 'reload schema';

-- Menambahkan tipe 'debt' secara aman ke dalam ENUM yang sudah ada
ALTER TYPE account_sub_type ADD VALUE IF NOT EXISTS 'debt';

-- Memaksa Supabase mereset cache skema agar API langsung mendeteksi tipe baru
NOTIFY pydantic_supabase_admin_pgrst, 'reload schema';

-- 1. Modifikasi tabel akun agar mendukung kuantitas aset non-fiat (Kripto & Emas)
ALTER TABLE public.accounts 
    ADD COLUMN IF NOT EXISTS asset_ticker VARCHAR(10) DEFAULT 'IDR', -- 'IDR', 'BTC', 'XAU' (Emas)
    ADD COLUMN IF NOT EXISTS asset_quantity NUMERIC(20, 8) DEFAULT 0.00000000;

-- 2. Modifikasi tabel transaksi untuk menangkap biaya admin bank dan pajak (PPN)
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS admin_fee NUMERIC(15, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15, 2) DEFAULT 0.00;

-- 3. Reset cache skema Supabase agar kolom baru langsung dikenali
NOTIFY pydantic_supabase_admin_pgrst, 'reload schema';

-- 1. Evaluasi dan hapus kolom over-engineering pada tabel Accounts
ALTER TABLE public.accounts 
    DROP COLUMN IF EXISTS asset_ticker,
    DROP COLUMN IF EXISTS asset_quantity;

-- 2. Evaluasi dan hapus kolom over-engineering pada tabel Transactions
ALTER TABLE public.transactions
    DROP COLUMN IF EXISTS admin_fee,
    DROP COLUMN IF EXISTS tax_amount;

-- 3. Sinkronisasi paksa cache PostgREST agar API Supabase sejalan dengan UI
NOTIFY pydantic_supabase_admin_pgrst, 'reload schema';

-- 1. Buat fungsi eksekusi jadwal transaksi
CREATE OR REPLACE FUNCTION process_recurring_schedules()
RETURNS void AS $$
DECLARE
    schedule RECORD;
BEGIN
    FOR schedule IN 
        SELECT * FROM public.recurring_schedules 
        WHERE next_run_date <= CURRENT_DATE
    LOOP
        -- Insert ke tabel transaksi
        INSERT INTO public.transactions (user_id, category_id, account_id, amount, type, description, date)
        VALUES (
            schedule.user_id, schedule.category_id, schedule.account_id, 
            schedule.amount, schedule.type, 
            CONCAT('[Otomatis] ', schedule.description), CURRENT_DATE
        );

        -- Update logika mutasi saldo menggunakan RPC yang sudah ada
        IF schedule.type = 'expense' THEN
            PERFORM decrement_account_balance(schedule.account_id, schedule.amount);
        ELSIF schedule.type = 'income' THEN
            PERFORM increment_account_balance(schedule.account_id, schedule.amount);
        END IF;

        -- Update next_run_date ke bulan berikutnya
        UPDATE public.recurring_schedules
        SET next_run_date = next_run_date + INTERVAL '1 month'
        WHERE id = schedule.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 2. Aktifkan pg_cron dan jadwalkan fungsi berjalan setiap jam 00:01 pagi
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'process_recurring_jobs', 
    '1 0 * * *', 
    $$SELECT process_recurring_schedules();$$
);

-- Mengatur nilai default kolom user_id menjadi ID pengguna dari session yang aktif
ALTER TABLE public.transactions        ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.accounts            ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.categories          ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.recurring_schedules ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Memaksa Supabase memperbarui cache API
NOTIFY pydantic_supabase_admin_pgrst, 'reload schema';

-- Buat fungsi trigger untuk memperbarui saldo akun
CREATE OR REPLACE FUNCTION update_balance_after_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type = 'expense' THEN
        UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'income' THEN
        UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'transfer' THEN
        -- Kurangi saldo akun asal
        UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
        -- Tambah saldo akun tujuan
        UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.transfer_to_account_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Pasang trigger pada tabel transactions (setiap INSERT akan memicu fungsi di atas)
DROP TRIGGER IF EXISTS trigger_update_balance ON public.transactions;

CREATE TRIGGER trigger_update_balance
    AFTER INSERT ON public.transactions
    FOR EACH ROW 
    EXECUTE FUNCTION update_balance_after_transaction();

-- 1. Tambahkan 'transfer' ke daftar ENUM tipe transaksi
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'transfer';

-- 2. Izinkan Supabase mengisi user_id secara otomatis (Zero-Trust Security)
ALTER TABLE public.transactions        ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.accounts            ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.categories          ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.recurring_schedules ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 3. Paksa Supabase mereset cache API agar perubahan langsung aktif
NOTIFY pydantic_supabase_admin_pgrst, 'reload schema';

-- 1. Menghapus batasan NOT NULL pada kolom category_id
ALTER TABLE public.transactions ALTER COLUMN category_id DROP NOT NULL;

-- 2. Memaksa pembaruan cache skema agar API merespons perubahan secara instan
NOTIFY pydantic_supabase_admin_pgrst, 'reload schema';

-- Mengaktifkan fitur realtime untuk tabel transactions
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- Membuat Materialized View untuk statistik dasbor
CREATE MATERIALIZED VIEW mv_dashboard_stats AS
SELECT 
    (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE type != 'debt') AS total_assets,
    (SELECT COALESCE(SUM(ABS(balance)), 0) FROM accounts WHERE type = 'debt') AS total_liabilities,
    (
        (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE type != 'debt') - 
        (SELECT COALESCE(SUM(ABS(balance)), 0) FROM accounts WHERE type = 'debt')
    ) AS net_worth;

-- Membuat fungsi untuk me-refresh secara manual (atau via pg_cron nanti)
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- 1. Buat fungsi pembaruan (Refresh)
CREATE OR REPLACE FUNCTION trigger_refresh_dashboard_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Memperbarui view secara efisien di belakang layar
    REFRESH MATERIALIZED VIEW mv_dashboard_stats;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Pasang pelatuk (Trigger) pada tabel transaksi
DROP TRIGGER IF EXISTS refresh_stats_on_transaction ON transactions;

CREATE TRIGGER refresh_stats_on_transaction
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_dashboard_stats();

-- 3. Pasang pelatuk (Trigger) pada tabel akun (jika ada mutasi saldo/akun baru)
DROP TRIGGER IF EXISTS refresh_stats_on_account ON accounts;

CREATE TRIGGER refresh_stats_on_account
    AFTER INSERT OR UPDATE OR DELETE ON accounts
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_dashboard_stats();

-- 1. Hapus semua trigger dan fungsi yang menyebabkan error
DROP TRIGGER IF EXISTS refresh_stats_on_transaction ON transactions;
DROP TRIGGER IF EXISTS refresh_stats_on_account ON accounts;
DROP FUNCTION IF EXISTS trigger_refresh_dashboard_stats();
DROP FUNCTION IF EXISTS refresh_dashboard_stats();
DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_stats;

-- 2. Ganti dengan View Standar yang jauh lebih aman (Mendukung Multi-User)
CREATE OR REPLACE VIEW user_dashboard_stats AS
SELECT 
    user_id,
    COALESCE(SUM(CASE WHEN type != 'debt' THEN balance ELSE 0 END), 0) AS total_assets,
    COALESCE(SUM(CASE WHEN type = 'debt' THEN ABS(balance) ELSE 0 END), 0) AS total_liabilities,
    (
        COALESCE(SUM(CASE WHEN type != 'debt' THEN balance ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN type = 'debt' THEN ABS(balance) ELSE 0 END), 0)
    ) AS net_worth
FROM accounts
GROUP BY user_id;

-- 3. Paksa Supabase mereset API agar mengenali View baru ini
NOTIFY pydantic_supabase_admin_pgrst, 'reload schema';

-- 1. Buat Tabel Anggota Dompet (Kolaborator)
CREATE TABLE public.account_members (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role       VARCHAR(20) DEFAULT 'member', -- 'owner' atau 'member'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(account_id, user_id) -- Cegah 1 orang diundang 2 kali ke dompet yang sama
);

-- 2. Otomatisasi: Jadikan pembuat akun sebagai 'owner' (Pemilik)
CREATE OR REPLACE FUNCTION auto_add_account_owner()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.account_members (account_id, user_id, role)
    VALUES (NEW.id, NEW.user_id, 'owner');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_add_owner ON public.accounts;

CREATE TRIGGER trigger_auto_add_owner
    AFTER INSERT ON public.accounts
    FOR EACH ROW 
    EXECUTE FUNCTION auto_add_account_owner();

-- 3. PEROMBAKAN KEAMANAN (RLS) UNTUK KOLABORASI
-- Hapus RLS akun dan transaksi yang lama (jika ada)
DROP POLICY IF EXISTS "Users can view their own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;

-- Buat RLS Kolaboratif untuk Akun: Bisa diakses jika user adalah anggota
CREATE POLICY "Collaborative Account Access" 
    ON public.accounts
    FOR ALL 
    USING (id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid()));

-- Buat RLS Kolaboratif untuk Transaksi: Bisa diakses jika transaksi berada di dompet yang di-share
CREATE POLICY "Collaborative Transaction Access" 
    ON public.transactions
    FOR ALL 
    USING (account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid()));

-- RLS untuk tabel anggota (bisa melihat anggota lain di dompet yang sama)
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View co-members" 
    ON public.account_members
    FOR SELECT 
    USING (account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid()));

-- 4. Beri akses ke RPC (Fungsi untuk mengundang via Email)
-- Supabase tidak bisa langsung mencari email demi privasi, jadi kita buat fungsi aman
CREATE OR REPLACE FUNCTION invite_user_to_wallet(wallet_id UUID, invitee_email TEXT)
RETURNS void AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Cari ID user berdasarkan email
    SELECT id INTO target_user_id FROM auth.users WHERE email = invitee_email;
  
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Pengguna dengan email tersebut tidak ditemukan atau belum terdaftar.';
    END IF;

    -- Masukkan ke tabel kolaborator
    INSERT INTO public.account_members (account_id, user_id, role)
    VALUES (wallet_id, target_user_id, 'member');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Hapus policy RLS yang rusak
DROP POLICY IF EXISTS "Collaborative Account Access" ON public.accounts;
DROP POLICY IF EXISTS "Collaborative Transaction Access" ON public.transactions;
DROP POLICY IF EXISTS "View co-members" ON public.account_members;

-- 2. Buat fungsi helper (pembantu) yang aman untuk mengecek akses (Bypass rekursi)
CREATE OR REPLACE FUNCTION is_account_member(target_account_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.account_members 
        WHERE account_id = target_account_id 
          AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Terapkan RLS baru menggunakan fungsi helper tersebut
CREATE POLICY "Collaborative Account Access" 
    ON public.accounts
    FOR ALL 
    USING (user_id = auth.uid() OR is_account_member(id));

CREATE POLICY "Collaborative Transaction Access" 
    ON public.transactions
    FOR ALL 
    USING (user_id = auth.uid() OR is_account_member(account_id));

CREATE POLICY "View co-members" 
    ON public.account_members
    FOR SELECT 
    USING (user_id = auth.uid() OR is_account_member(account_id));

-- 4. Paksa Supabase mereset API
NOTIFY pydantic_supabase_admin_pgrst, 'reload schema';

-- 1. Buat Bucket publik bernama 'receipts'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Izinkan pengguna login untuk mengunggah foto
CREATE POLICY "Authenticated users can upload receipts" 
    ON storage.objects 
    FOR INSERT 
    WITH CHECK (
        bucket_id = 'receipts' AND 
        auth.role() = 'authenticated'
    );

-- 3. Izinkan foto dibaca oleh publik (agar AI bisa melihatnya)
CREATE POLICY "Public can view receipts" 
    ON storage.objects 
    FOR SELECT 
    USING (bucket_id = 'receipts');


-- Hapus trigger lama
DROP TRIGGER IF EXISTS trigger_update_balance ON public.transactions;

CREATE OR REPLACE FUNCTION update_balance_after_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. REVERT STATE LAMA (Jika operasi adalah UPDATE atau DELETE)
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        IF OLD.type = 'expense' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
        ELSIF OLD.type = 'income' THEN
            UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
        ELSIF OLD.type = 'transfer' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
            UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.transfer_to_account_id;
        END IF;
    END IF;

    -- 2. APPLY STATE BARU (Jika operasi adalah INSERT, atau UPDATE yang bukan soft delete)
    IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NULL)) THEN
        IF NEW.type = 'expense' THEN
            UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
        ELSIF NEW.type = 'income' THEN
            UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
        ELSIF NEW.type = 'transfer' THEN
            UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
            UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.transfer_to_account_id;
        END IF;
    END IF;

    IF (TG_OP = 'DELETE') THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Memicu trigger pada semua siklus modifikasi data
CREATE TRIGGER trigger_update_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION update_balance_after_transaction();


-- 1. Fungsi spesifik untuk mengecek hak akses tulis
CREATE OR REPLACE FUNCTION has_write_access(target_account_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.account_members 
        WHERE account_id = target_account_id 
        AND user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Hapus policy yang rentan
DROP POLICY IF EXISTS "Collaborative Transaction Access" ON public.transactions;

-- 3. Implementasi Principle of Least Privilege
CREATE POLICY "Members can view community transactions" 
    ON public.transactions FOR SELECT 
    USING (user_id = auth.uid() OR is_account_member(account_id));

CREATE POLICY "Only admins/owners can write community transactions" 
    ON public.transactions FOR INSERT 
    WITH CHECK (user_id = auth.uid() OR has_write_access(account_id));

CREATE POLICY "Only admins/owners can update community transactions" 
    ON public.transactions FOR UPDATE 
    USING (user_id = auth.uid() OR has_write_access(account_id));

-- ==============================================================================
-- 1. AKTIFKAN EKSTENSI CRON (Standar Supabase)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ==============================================================================
-- 2. BUAT FUNGSI LOGIKA EKSEKUSI (STORED PROCEDURE)
-- ==============================================================================
CREATE OR REPLACE FUNCTION process_recurring_schedules()
RETURNS void
LANGUAGE plpgsql
-- SECURITY DEFINER: Mengizinkan fungsi ini menembus RLS untuk memproses data semua user
SECURITY DEFINER
-- SET search_path: Best practice keamanan untuk mencegah hijacking path
SET search_path = public
AS $$
DECLARE
    sched RECORD;
    new_next_date DATE;
BEGIN
    -- Loop melalui semua jadwal yang berstatus AKTIF dan WAKTUNYA TIBA/TERLEWAT
    FOR sched IN 
        SELECT * FROM recurring_schedules 
        WHERE is_active = true 
          AND next_run_date <= CURRENT_DATE
    LOOP
        -- A. Sisipkan data ke tabel transaksi secara otomatis
        INSERT INTO transactions (
            user_id,
            account_id,
            category_id,
            amount,
            type,
            description,
            date
        ) VALUES (
            sched.user_id,
            sched.account_id,
            sched.category_id,
            sched.amount,
            sched.type,
            COALESCE(sched.description, 'Tanpa Catatan') || ' (Otomatis)',
            CURRENT_DATE
        );

        -- B. Kalkulasi penambahan interval berdasarkan frekuensi
        CASE sched.frequency
            WHEN 'daily' THEN new_next_date := sched.next_run_date + INTERVAL '1 day';
            WHEN 'weekly' THEN new_next_date := sched.next_run_date + INTERVAL '1 week';
            WHEN 'monthly' THEN new_next_date := sched.next_run_date + INTERVAL '1 month';
            WHEN 'yearly' THEN new_next_date := sched.next_run_date + INTERVAL '1 year';
            ELSE new_next_date := sched.next_run_date + INTERVAL '1 month'; -- Fallback aman
        END CASE;

        -- C. Catch-up Logic (Penting untuk keamanan finansial)
        -- Jika server mati/cron gagal berhari-hari, pastikan next_date maju melewati hari ini
        -- agar tagihan tidak ditagih berkali-kali di hari yang sama saat server hidup kembali.
        WHILE new_next_date <= CURRENT_DATE LOOP
            CASE sched.frequency
                WHEN 'daily' THEN new_next_date := new_next_date + INTERVAL '1 day';
                WHEN 'weekly' THEN new_next_date := new_next_date + INTERVAL '1 week';
                WHEN 'monthly' THEN new_next_date := new_next_date + INTERVAL '1 month';
                WHEN 'yearly' THEN new_next_date := new_next_date + INTERVAL '1 year';
            END CASE;
        END LOOP;

        -- D. Perbarui tanggal eksekusi berikutnya pada jadwal pengguna
        UPDATE recurring_schedules 
        SET next_run_date = new_next_date,
            updated_at = NOW()
        WHERE id = sched.id;
        
    END LOOP;
END;
$$;

-- ==============================================================================
-- 3. JADWALKAN CRON JOB (SETIAP MALAM)
-- ==============================================================================
-- Karena server Supabase menggunakan UTC (Zona Waktu Global), 
-- Pukul 17:00 UTC = Pukul 00:00 WIB (Waktu Indonesia Barat).
-- Script ini akan berjalan TEPAT pada pergantian hari di Indonesia.

SELECT cron.schedule(
    'eksekusi-otomasi-harian-eazytah', -- Nama unik job
    '0 17 * * *',                      -- Ekspresi Cron: Menit 0, Jam 17 UTC (Tengah malam WIB)
    'SELECT process_recurring_schedules();'
);

-- 0. Tambahkan nilai 'otomasi' ke dalam ENUM transaction_type
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'otomasi';

-- 1. Hapus kategori otomasi lama jika pernah ada (opsional, untuk reset)
DELETE FROM categories WHERE type = 'otomasi';

-- 2. Masukkan kategori default baru khusus Otomasi
INSERT INTO categories (name, type, color_code, budget_limit) VALUES
('Tagihan Internet / WiFi', 'otomasi', '#3b82f6', 0),
('Langganan Streaming (Netflix/Spotify)', 'otomasi', '#ef4444', 0),
('Cicilan / KPR', 'otomasi', '#f59e0b', 0),
('Asuransi Kesehatan', 'otomasi', '#10b981', 0),
('Investasi Rutin (Reksadana/Saham)', 'otomasi', '#8b5cf6', 0);

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'otomasi';

CREATE OR REPLACE FUNCTION public.handle_new_user_categories()
RETURNS TRIGGER AS $$
BEGIN
    -- Masukkan kategori default pengeluaran
    INSERT INTO public.categories (user_id, name, type, color_code) 
    VALUES
        (NEW.id, 'Makanan & Minuman', 'expense', '#EF4444'),
        (NEW.id, 'Transportasi', 'expense', '#F59E0B'),
        (NEW.id, 'Belanja Bulanan', 'expense', '#3B82F6'),
        (NEW.id, 'Hiburan & Rekreasi', 'expense', '#8B5CF6'),
        (NEW.id, 'Tagihan & Utilitas', 'expense', '#EC4899');

    -- Masukkan kategori default pemasukan
    INSERT INTO public.categories (user_id, name, type, color_code) 
    VALUES
        (NEW.id, 'Gaji Utama', 'income', '#10B981'),
        (NEW.id, 'Investasi', 'income', '#06B6D4'),
        (NEW.id, 'Sampingan (Freelance)', 'income', '#84CC16');

    -- TIPE BARU: Masukkan kategori default otomasi
    INSERT INTO public.categories (user_id, name, type, color_code, budget_limit) 
    VALUES
        (NEW.id, 'Tagihan Internet / WiFi', 'otomasi', '#3b82f6', 0),
        (NEW.id, 'Langganan Streaming', 'otomasi', '#ef4444', 0),
        (NEW.id, 'Cicilan / KPR', 'otomasi', '#f59e0b', 0),
        (NEW.id, 'Asuransi Kesehatan', 'otomasi', '#10b981', 0),
        (NEW.id, 'Investasi Rutin', 'otomasi', '#8b5cf6', 0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;