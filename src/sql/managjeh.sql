-- ====================================================================
-- 1. EKSTENSI & TIPE DATA (ENUM)
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer', 'otomasi');
CREATE TYPE account_sub_type AS ENUM ('cash', 'bank', 'e-wallet', 'crypto', 'investment', 'debt');

-- ====================================================================
-- 2. PEMBUATAN TABEL UTAMA (Struktur Akhir)
-- ====================================================================

CREATE TABLE public.accounts (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    type       account_sub_type DEFAULT 'bank',
    currency   VARCHAR(3) DEFAULT 'IDR',
    balance    NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.categories (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name         VARCHAR(50) NOT NULL,
    type         transaction_type NOT NULL,
    color_code   VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    budget_limit NUMERIC(15, 2) DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_category UNIQUE (user_id, name, type)
);

CREATE TABLE public.transactions (
    id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id             UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    transfer_to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    category_id            UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
    amount                 NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    type                   transaction_type NOT NULL,
    description            TEXT,
    date                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    deleted_at             TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE public.recurring_schedules (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id    UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    category_id   UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    amount        NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    type          transaction_type NOT NULL,
    description   TEXT,
    frequency     VARCHAR(20) DEFAULT 'monthly', 
    next_run_date DATE NOT NULL,
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.account_members (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role       VARCHAR(20) DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, user_id)
);

CREATE TABLE public.audit_logs (
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

-- ====================================================================
-- 3. INDEKS UNTUK OPTIMASI PERFORMA
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_categories_user_type ON public.categories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_recurring_user_active ON public.recurring_schedules(user_id, is_active);

-- ====================================================================
-- 4. FUNGSI HELPER & LOGIKA INTI
-- ====================================================================

-- Helper untuk RLS (Bypass rekursi)
CREATE OR REPLACE FUNCTION is_account_member(target_account_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.account_members 
        WHERE account_id = target_account_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Fungsi penambahan dan pengurangan saldo 
CREATE OR REPLACE FUNCTION increment_account_balance(acct_id UUID, amt NUMERIC) 
RETURNS void AS $$
BEGIN
    UPDATE public.accounts SET balance = balance + amt WHERE id = acct_id;
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_account_balance(acct_id UUID, amt NUMERIC) 
RETURNS void AS $$
BEGIN
    UPDATE public.accounts SET balance = balance - amt WHERE id = acct_id;
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 5. PENGATURAN KEAMANAN (ROW LEVEL SECURITY - RLS)
-- ====================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

-- Categories Policy
CREATE POLICY "Strict user isolation for categories" 
    ON public.categories FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Accounts Policy
CREATE POLICY "Collaborative Account Access" 
    ON public.accounts FOR ALL 
    USING (user_id = auth.uid() OR is_account_member(id));

-- Transactions Policies (Principle of Least Privilege)
CREATE POLICY "Members can view community transactions" 
    ON public.transactions FOR SELECT 
    USING (user_id = auth.uid() OR is_account_member(account_id));

CREATE POLICY "Only admins/owners can write community transactions" 
    ON public.transactions FOR INSERT 
    WITH CHECK (user_id = auth.uid() OR has_write_access(account_id));

CREATE POLICY "Only admins/owners can update community transactions" 
    ON public.transactions FOR UPDATE 
    USING (user_id = auth.uid() OR has_write_access(account_id));

-- Recurring Schedules Policy
CREATE POLICY "Users manage their own recurring" 
    ON public.recurring_schedules FOR ALL USING (auth.uid() = user_id);

-- Audit Logs Policy
CREATE POLICY "Users can only view their own audit logs" 
    ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Account Members Policy
CREATE POLICY "View co-members" 
    ON public.account_members FOR SELECT 
    USING (user_id = auth.uid() OR is_account_member(account_id));

-- ====================================================================
-- 6. TRIGGERS
-- ====================================================================

-- A. Otomatisasi Kategori User Baru
CREATE OR REPLACE FUNCTION public.handle_new_user_categories()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.categories (user_id, name, type, color_code) VALUES
        (NEW.id, 'Makanan & Minuman', 'expense', '#EF4444'),
        (NEW.id, 'Transportasi', 'expense', '#F59E0B'),
        (NEW.id, 'Belanja Bulanan', 'expense', '#3B82F6'),
        (NEW.id, 'Hiburan & Rekreasi', 'expense', '#8B5CF6'),
        (NEW.id, 'Tagihan & Utilitas', 'expense', '#EC4899'),
        (NEW.id, 'Gaji Utama', 'income', '#10B981'),
        (NEW.id, 'Investasi', 'income', '#06B6D4'),
        (NEW.id, 'Sampingan (Freelance)', 'income', '#84CC16');

    INSERT INTO public.categories (user_id, name, type, color_code, budget_limit) VALUES
        (NEW.id, 'Tagihan Internet / WiFi', 'otomasi', '#3b82f6', 0),
        (NEW.id, 'Langganan Streaming', 'otomasi', '#ef4444', 0),
        (NEW.id, 'Cicilan / KPR', 'otomasi', '#f59e0b', 0),
        (NEW.id, 'Asuransi Kesehatan', 'otomasi', '#10b981', 0),
        (NEW.id, 'Investasi Rutin', 'otomasi', '#8b5cf6', 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_categories();

-- B. Update Saldo Akun setelah Transaksi
CREATE OR REPLACE FUNCTION update_balance_after_transaction()
RETURNS TRIGGER AS $$
BEGIN
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

CREATE TRIGGER trigger_update_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION update_balance_after_transaction();

-- C. Jadikan pembuat akun sebagai 'owner'
CREATE OR REPLACE FUNCTION auto_add_account_owner()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.account_members (account_id, user_id, role)
    VALUES (NEW.id, NEW.user_id, 'owner');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_auto_add_owner
    AFTER INSERT ON public.accounts FOR EACH ROW EXECUTE FUNCTION auto_add_account_owner();

-- D. Audit Log untuk Soft Delete
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

CREATE TRIGGER trigger_audit_soft_delete
    AFTER UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION log_transaction_soft_delete();

-- ====================================================================
-- 7. ANALITIK, VIEW, & FUNGSI LAPORAN
-- ====================================================================

CREATE OR REPLACE VIEW user_dashboard_stats WITH (security_invoker = on) AS
SELECT 
    user_id,
    COALESCE(SUM(CASE WHEN type != 'debt' THEN balance ELSE 0 END), 0) AS total_assets,
    COALESCE(SUM(CASE WHEN type = 'debt' THEN ABS(balance) ELSE 0 END), 0) AS total_liabilities,
    (
        COALESCE(SUM(CASE WHEN type != 'debt' THEN balance ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN type = 'debt' THEN ABS(balance) ELSE 0 END), 0)
    ) AS net_worth
FROM accounts GROUP BY user_id;

CREATE OR REPLACE FUNCTION get_financial_summary(user_id_param UUID)
RETURNS json AS $$
DECLARE
    total_balance NUMERIC; monthly_income NUMERIC; monthly_expense NUMERIC;
BEGIN
    SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) INTO total_balance
    FROM public.transactions WHERE user_id = user_id_param AND deleted_at IS NULL;

    SELECT COALESCE(SUM(amount), 0) INTO monthly_income
    FROM public.transactions
    WHERE user_id = user_id_param AND type = 'income' AND deleted_at IS NULL 
    AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE);

    SELECT COALESCE(SUM(amount), 0) INTO monthly_expense
    FROM public.transactions
    WHERE user_id = user_id_param AND type = 'expense' AND deleted_at IS NULL 
    AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE);

    RETURN json_build_object(
        'total_balance', total_balance,
        'monthly_income', monthly_income,
        'monthly_expense', monthly_expense
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_monthly_net_worth(user_id_param UUID)
RETURNS TABLE(month_year TEXT, cumulative_balance NUMERIC) AS $$
BEGIN
    RETURN QUERY
    WITH monthly_flows AS (
        SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS m_year,
               SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net_flow
        FROM public.transactions
        WHERE user_id = user_id_param AND deleted_at IS NULL
        GROUP BY 1
    )
    SELECT m_year, SUM(net_flow) OVER (ORDER BY m_year ASC) AS cumulative_balance
    FROM monthly_flows ORDER BY m_year ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_budget_predictive_analysis(user_id_param UUID)
RETURNS TABLE(
    category_name TEXT, budget_limit NUMERIC, current_spent NUMERIC,
    days_elapsed INT, days_in_month INT, burn_rate_per_day NUMERIC,
    projected_end_spent NUMERIC, is_anomaly BOOLEAN, ai_warning_message TEXT
) AS $$
DECLARE
    start_of_month TIMESTAMPTZ; current_time_wib TIMESTAMPTZ;
    total_days INT; elapsed_days INT;
BEGIN
    current_time_wib := NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta';
    start_of_month   := date_trunc('month', current_time_wib);
    total_days       := EXTRACT(DAY FROM (date_trunc('month', current_time_wib) + INTERVAL '1 month' - INTERVAL '1 day'));
    elapsed_days     := EXTRACT(DAY FROM current_time_wib);
    IF elapsed_days = 0 THEN elapsed_days := 1; END IF;

    RETURN QUERY
    WITH current_month_expenses AS (
        SELECT c.name AS cat_name, c.budget_limit AS limit_amt, SUM(t.amount) AS spent_amt
        FROM public.transactions t
        JOIN public.categories c ON t.category_id = c.id
        WHERE t.user_id = user_id_param AND t.deleted_at IS NULL 
          AND t.type = 'expense' AND t.date >= start_of_month AND c.budget_limit > 0
        GROUP BY c.name, c.budget_limit
    )
    SELECT 
        cat_name::TEXT, limit_amt::NUMERIC, spent_amt::NUMERIC,
        elapsed_days::INT, total_days::INT,
        (spent_amt / elapsed_days)::NUMERIC AS burn_rate_per_day,
        ((spent_amt / elapsed_days) * total_days)::NUMERIC AS projected_end_spent,
        (((spent_amt / elapsed_days) * total_days) > limit_amt)::BOOLEAN AS is_anomaly,
        CASE 
            WHEN ((spent_amt / elapsed_days) * total_days) > limit_amt THEN
                'Peringatan Kritis! Anggaran kategori ' || cat_name || ' diproyeksikan akan membengkak.'
            WHEN (spent_amt / limit_amt) >= 0.5 AND elapsed_days <= (total_days * 0.3) THEN
                'Anomali Terdeteksi: Anda telah menghabiskan > 50% anggaran ' || cat_name || ' terlalu cepat.'
            ELSE
                'Anggaran aman. Pola konsumsi Anda stabil.'
        END::TEXT AS ai_warning_message
    FROM current_month_expenses;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 8. SISTEM OTOMASI & CRON JOB
-- ====================================================================

CREATE OR REPLACE FUNCTION process_recurring_schedules()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    sched RECORD; new_next_date DATE;
BEGIN
    FOR sched IN 
        SELECT * FROM recurring_schedules WHERE is_active = true AND next_run_date <= CURRENT_DATE
    LOOP
        INSERT INTO transactions (user_id, account_id, category_id, amount, type, description, date) 
        VALUES (sched.user_id, sched.account_id, sched.category_id, sched.amount, sched.type, 
                COALESCE(sched.description, 'Tanpa Catatan') || ' (Otomatis)', CURRENT_DATE);

        CASE sched.frequency
            WHEN 'daily' THEN new_next_date := sched.next_run_date + INTERVAL '1 day';
            WHEN 'weekly' THEN new_next_date := sched.next_run_date + INTERVAL '1 week';
            WHEN 'monthly' THEN new_next_date := sched.next_run_date + INTERVAL '1 month';
            WHEN 'yearly' THEN new_next_date := sched.next_run_date + INTERVAL '1 year';
            ELSE new_next_date := sched.next_run_date + INTERVAL '1 month';
        END CASE;

        WHILE new_next_date <= CURRENT_DATE LOOP
            CASE sched.frequency
                WHEN 'daily' THEN new_next_date := new_next_date + INTERVAL '1 day';
                WHEN 'weekly' THEN new_next_date := new_next_date + INTERVAL '1 week';
                WHEN 'monthly' THEN new_next_date := new_next_date + INTERVAL '1 month';
                WHEN 'yearly' THEN new_next_date := new_next_date + INTERVAL '1 year';
            END CASE;
        END LOOP;

        UPDATE recurring_schedules SET next_run_date = new_next_date, updated_at = NOW() WHERE id = sched.id;
    END LOOP;
END;
$$;

SELECT cron.schedule('eksekusi-otomasi-harian-eazytah', '0 17 * * *', 'SELECT process_recurring_schedules();');

-- ====================================================================
-- 9. PENGATURAN LAINNYA (Undangan Wallet, Storage, Realtime)
-- ====================================================================

CREATE OR REPLACE FUNCTION invite_user_to_wallet(wallet_id UUID, invitee_email TEXT)
RETURNS void AS $$
DECLARE target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id FROM auth.users WHERE email = invitee_email;
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Pengguna dengan email tersebut tidak ditemukan.';
    END IF;
    INSERT INTO public.account_members (account_id, user_id, role) VALUES (wallet_id, target_user_id, 'member');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Storage Setup
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Authenticated users can upload receipts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts' AND auth.role() = 'authenticated');
CREATE POLICY "Public can view receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');

-- Realtime Configuration
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- Paksa Reload Skema untuk PostgREST Supabase
NOTIFY pydantic_supabase_admin_pgrst, 'reload schema';

-- ====================================================================
-- PATCH 1: HAPUS DEAD CODE YANG BERBAHAYA
-- ====================================================================
-- Karena mutasi saldo sudah diurus oleh Trigger 'update_balance_after_transaction',
-- fungsi manual ini harus dimusnahkan agar tidak bisa dipanggil via API.
DROP FUNCTION IF EXISTS public.increment_account_balance(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.decrement_account_balance(UUID, NUMERIC);

-- ====================================================================
-- PATCH 2: AMANKAN FUNGSI UNDANGAN DOMPET (Otorisasi Akses)
-- ====================================================================
CREATE OR REPLACE FUNCTION invite_user_to_wallet(wallet_id UUID, invitee_email TEXT)
RETURNS void AS $$
DECLARE target_user_id UUID;
BEGIN
    -- SECURITY GATE: Pastikan pemanggil adalah 'owner' atau 'admin' dari dompet tersebut
    IF NOT has_write_access(wallet_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki izin untuk mengundang pengguna ke dompet ini.';
    END IF;

    SELECT id INTO target_user_id FROM auth.users WHERE email = invitee_email;
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Pengguna dengan email tersebut tidak ditemukan.';
    END IF;
    
    INSERT INTO public.account_members (account_id, user_id, role) 
    VALUES (wallet_id, target_user_id, 'member');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ====================================================================
-- PATCH 3: CABUT SECURITY DEFINER DARI FUNGSI ANALITIK
-- ====================================================================
-- Mengubah fungsi menjadi SECURITY INVOKER (default jika definer dihapus).
-- Ini memaksa fungsi untuk tunduk pada aturan RLS pengguna yang sedang login.

CREATE OR REPLACE FUNCTION get_financial_summary(user_id_param UUID)
RETURNS json AS $$
DECLARE
    total_balance NUMERIC; monthly_income NUMERIC; monthly_expense NUMERIC;
BEGIN
    -- Tambahan Keamanan Ekstra (Hardcoded Check)
    IF user_id_param != auth.uid() THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak dapat melihat ringkasan keuangan orang lain.';
    END IF;

    SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) INTO total_balance
    FROM public.transactions WHERE user_id = user_id_param AND deleted_at IS NULL;

    SELECT COALESCE(SUM(amount), 0) INTO monthly_income
    FROM public.transactions
    WHERE user_id = user_id_param AND type = 'income' AND deleted_at IS NULL 
    AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE);

    SELECT COALESCE(SUM(amount), 0) INTO monthly_expense
    FROM public.transactions
    WHERE user_id = user_id_param AND type = 'expense' AND deleted_at IS NULL 
    AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE);

    RETURN json_build_object(
        'total_balance', total_balance,
        'monthly_income', monthly_income,
        'monthly_expense', monthly_expense
    );
END;
$$ LANGUAGE plpgsql; -- SECURITY DEFINER DIHAPUS

CREATE OR REPLACE FUNCTION get_monthly_net_worth(user_id_param UUID)
RETURNS TABLE(month_year TEXT, cumulative_balance NUMERIC) AS $$
BEGIN
    IF user_id_param != auth.uid() THEN
        RAISE EXCEPTION 'Akses Ditolak: Unauthorized Data Access.';
    END IF;

    RETURN QUERY
    WITH monthly_flows AS (
        SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS m_year,
               SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net_flow
        FROM public.transactions
        WHERE user_id = user_id_param AND deleted_at IS NULL
        GROUP BY 1
    )
    SELECT m_year, SUM(net_flow) OVER (ORDER BY m_year ASC) AS cumulative_balance
    FROM monthly_flows ORDER BY m_year ASC;
END;
$$ LANGUAGE plpgsql; -- SECURITY DEFINER DIHAPUS

CREATE OR REPLACE FUNCTION get_budget_predictive_analysis(user_id_param UUID)
RETURNS TABLE(
    category_name TEXT, budget_limit NUMERIC, current_spent NUMERIC,
    days_elapsed INT, days_in_month INT, burn_rate_per_day NUMERIC,
    projected_end_spent NUMERIC, is_anomaly BOOLEAN, ai_warning_message TEXT
) AS $$
DECLARE
    start_of_month TIMESTAMPTZ; current_time_wib TIMESTAMPTZ;
    total_days INT; elapsed_days INT;
BEGIN
    IF user_id_param != auth.uid() THEN
        RAISE EXCEPTION 'Akses Ditolak: Unauthorized Data Access.';
    END IF;

    current_time_wib := NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta';
    start_of_month   := date_trunc('month', current_time_wib);
    total_days       := EXTRACT(DAY FROM (date_trunc('month', current_time_wib) + INTERVAL '1 month' - INTERVAL '1 day'));
    elapsed_days     := EXTRACT(DAY FROM current_time_wib);
    IF elapsed_days = 0 THEN elapsed_days := 1; END IF;

    RETURN QUERY
    WITH current_month_expenses AS (
        SELECT c.name AS cat_name, c.budget_limit AS limit_amt, SUM(t.amount) AS spent_amt
        FROM public.transactions t
        JOIN public.categories c ON t.category_id = c.id
        WHERE t.user_id = user_id_param AND t.deleted_at IS NULL 
          AND t.type = 'expense' AND t.date >= start_of_month AND c.budget_limit > 0
        GROUP BY c.name, c.budget_limit
    )
    SELECT 
        cat_name::TEXT, limit_amt::NUMERIC, spent_amt::NUMERIC,
        elapsed_days::INT, total_days::INT,
        (spent_amt / elapsed_days)::NUMERIC AS burn_rate_per_day,
        ((spent_amt / elapsed_days) * total_days)::NUMERIC AS projected_end_spent,
        (((spent_amt / elapsed_days) * total_days) > limit_amt)::BOOLEAN AS is_anomaly,
        CASE 
            WHEN ((spent_amt / elapsed_days) * total_days) > limit_amt THEN
                'Peringatan Kritis! Anggaran kategori ' || cat_name || ' diproyeksikan akan membengkak.'
            WHEN (spent_amt / limit_amt) >= 0.5 AND elapsed_days <= (total_days * 0.3) THEN
                'Anomali Terdeteksi: Anda telah menghabiskan > 50% anggaran ' || cat_name || ' terlalu cepat.'
            ELSE
                'Anggaran aman. Pola konsumsi Anda stabil.'
        END::TEXT AS ai_warning_message
    FROM current_month_expenses;
END;
$$ LANGUAGE plpgsql; -- SECURITY DEFINER DIHAPUS

-- Flush Cache Skema
NOTIFY pydantic_supabase_admin_pgrst, 'reload schema';

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

-- 1. Hapus jadwal dengan nama yang salah
SELECT cron.unschedule('eksekusi-otomasi-harian-eazytah');

-- 2. Buat jadwal baru dengan nama yang benar
SELECT cron.schedule('eksekusi-otomasi-harian-managjeh', '0 17 * * *', 'SELECT process_recurring_schedules();');

-- Memperbaiki data lama yang kosong agar tidak error
UPDATE public.accounts SET type = 'bank' WHERE type IS NULL;

-- Mengunci kolom agar tidak bisa disisipkan nilai null di masa depan
ALTER TABLE public.accounts ALTER COLUMN type SET NOT NULL;

-- ====================================================================
-- 1. EKSTENSI & TIPE DATA (ENUM)
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer', 'otomasi');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_sub_type AS ENUM ('cash', 'bank', 'e-wallet', 'crypto', 'investment', 'debt');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ====================================================================
-- 2. PEMBUATAN TABEL UTAMA (Struktur Akhir)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.accounts (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    type       account_sub_type DEFAULT 'bank',
    currency   VARCHAR(3) DEFAULT 'IDR',
    balance    NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name         VARCHAR(50) NOT NULL,
    type         transaction_type NOT NULL,
    color_code   VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    budget_limit NUMERIC(15, 2) DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_category UNIQUE (user_id, name, type)
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id             UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    transfer_to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    category_id            UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
    amount                 NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    type                   transaction_type NOT NULL,
    description            TEXT,
    date                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    deleted_at             TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS public.recurring_schedules (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id    UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    category_id   UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    amount        NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    type          transaction_type NOT NULL,
    description   TEXT,
    frequency     VARCHAR(20) DEFAULT 'monthly', 
    next_run_date DATE NOT NULL,
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.account_members (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role       VARCHAR(20) DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, user_id)
);

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

-- ====================================================================
-- 3. INDEKS UNTUK OPTIMASI PERFORMA
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_categories_user_type ON public.categories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_recurring_user_active ON public.recurring_schedules(user_id, is_active);

-- ====================================================================
-- 4. FUNGSI HELPER & LOGIKA INTI
-- ====================================================================

-- Helper untuk RLS (Bypass rekursi)
CREATE OR REPLACE FUNCTION is_account_member(target_account_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.account_members 
        WHERE account_id = target_account_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- ====================================================================
-- 5. PENGATURAN KEAMANAN (ROW LEVEL SECURITY - RLS)
-- ====================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

-- Categories Policy
DROP POLICY IF EXISTS "Strict user isolation for categories" ON public.categories;
CREATE POLICY "Strict user isolation for categories" 
    ON public.categories FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Accounts Policy
DROP POLICY IF EXISTS "Collaborative Account Access" ON public.accounts;
CREATE POLICY "Collaborative Account Access" 
    ON public.accounts FOR ALL 
    USING (user_id = auth.uid() OR is_account_member(id));

-- Transactions Policies
DROP POLICY IF EXISTS "Members can view community transactions" ON public.transactions;
CREATE POLICY "Members can view community transactions" 
    ON public.transactions FOR SELECT 
    USING (user_id = auth.uid() OR is_account_member(account_id));

DROP POLICY IF EXISTS "Only admins/owners can write community transactions" ON public.transactions;
CREATE POLICY "Only admins/owners can write community transactions" 
    ON public.transactions FOR INSERT 
    WITH CHECK (user_id = auth.uid() OR has_write_access(account_id));

DROP POLICY IF EXISTS "Only admins/owners can update community transactions" ON public.transactions;
CREATE POLICY "Only admins/owners can update community transactions" 
    ON public.transactions FOR UPDATE 
    USING (user_id = auth.uid() OR has_write_access(account_id));

-- Recurring Schedules Policy
DROP POLICY IF EXISTS "Users manage their own recurring" ON public.recurring_schedules;
CREATE POLICY "Users manage their own recurring" 
    ON public.recurring_schedules FOR ALL USING (auth.uid() = user_id);

-- Audit Logs Policy
DROP POLICY IF EXISTS "Users can only view their own audit logs" ON public.audit_logs;
CREATE POLICY "Users can only view their own audit logs" 
    ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Account Members Policy
DROP POLICY IF EXISTS "View co-members" ON public.account_members;
CREATE POLICY "View co-members" 
    ON public.account_members FOR SELECT 
    USING (user_id = auth.uid() OR is_account_member(account_id));

-- ====================================================================
-- 6. TRIGGERS
-- ====================================================================

-- A. Otomatisasi Kategori User Baru
CREATE OR REPLACE FUNCTION public.handle_new_user_categories()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.categories (user_id, name, type, color_code) VALUES
        (NEW.id, 'Makanan & Minuman', 'expense', '#EF4444'),
        (NEW.id, 'Transportasi', 'expense', '#F59E0B'),
        (NEW.id, 'Belanja Bulanan', 'expense', '#3B82F6'),
        (NEW.id, 'Hiburan & Rekreasi', 'expense', '#8B5CF6'),
        (NEW.id, 'Tagihan & Utilitas', 'expense', '#EC4899'),
        (NEW.id, 'Gaji Utama', 'income', '#10B981'),
        (NEW.id, 'Investasi', 'income', '#06B6D4'),
        (NEW.id, 'Sampingan (Freelance)', 'income', '#84CC16');

    INSERT INTO public.categories (user_id, name, type, color_code, budget_limit) VALUES
        (NEW.id, 'Tagihan Internet / WiFi', 'otomasi', '#3b82f6', 0),
        (NEW.id, 'Langganan Streaming', 'otomasi', '#ef4444', 0),
        (NEW.id, 'Cicilan / KPR', 'otomasi', '#f59e0b', 0),
        (NEW.id, 'Asuransi Kesehatan', 'otomasi', '#10b981', 0),
        (NEW.id, 'Investasi Rutin', 'otomasi', '#8b5cf6', 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_categories();

-- B. Update Saldo Akun setelah Transaksi
CREATE OR REPLACE FUNCTION update_balance_after_transaction()
RETURNS TRIGGER AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trigger_update_balance ON public.transactions;
CREATE TRIGGER trigger_update_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION update_balance_after_transaction();

-- C. Jadikan pembuat akun sebagai 'owner'
CREATE OR REPLACE FUNCTION auto_add_account_owner()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.account_members (account_id, user_id, role)
    VALUES (NEW.id, NEW.user_id, 'owner');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_auto_add_owner ON public.accounts;
CREATE TRIGGER trigger_auto_add_owner
    AFTER INSERT ON public.accounts FOR EACH ROW EXECUTE FUNCTION auto_add_account_owner();

-- D. Audit Log untuk Soft Delete
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

DROP TRIGGER IF EXISTS trigger_audit_soft_delete ON public.transactions;
CREATE TRIGGER trigger_audit_soft_delete
    AFTER UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION log_transaction_soft_delete();

-- ====================================================================
-- 7. ANALITIK, VIEW, & FUNGSI LAPORAN (DENGAN HISTORICAL BASELINE)
-- ====================================================================

CREATE OR REPLACE VIEW user_dashboard_stats WITH (security_invoker = on) AS
SELECT 
    user_id,
    COALESCE(SUM(CASE WHEN type != 'debt' THEN balance ELSE 0 END), 0) AS total_assets,
    COALESCE(SUM(CASE WHEN type = 'debt' THEN ABS(balance) ELSE 0 END), 0) AS total_liabilities,
    (
        COALESCE(SUM(CASE WHEN type != 'debt' THEN balance ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN type = 'debt' THEN ABS(balance) ELSE 0 END), 0)
    ) AS net_worth
FROM accounts GROUP BY user_id;

-- Fungsi ringkasan keuangan (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION get_financial_summary(user_id_param UUID)
RETURNS json AS $$
DECLARE
    total_balance NUMERIC; monthly_income NUMERIC; monthly_expense NUMERIC;
BEGIN
    IF user_id_param != auth.uid() THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak dapat melihat ringkasan keuangan orang lain.';
    END IF;

    SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) INTO total_balance
    FROM public.transactions WHERE user_id = user_id_param AND deleted_at IS NULL;

    SELECT COALESCE(SUM(amount), 0) INTO monthly_income
    FROM public.transactions
    WHERE user_id = user_id_param AND type = 'income' AND deleted_at IS NULL 
    AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE);

    SELECT COALESCE(SUM(amount), 0) INTO monthly_expense
    FROM public.transactions
    WHERE user_id = user_id_param AND type = 'expense' AND deleted_at IS NULL 
    AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE);

    RETURN json_build_object(
        'total_balance', total_balance,
        'monthly_income', monthly_income,
        'monthly_expense', monthly_expense
    );
END;
$$ LANGUAGE plpgsql; -- SECURITY INVOKER (default)

-- Fungsi net worth bulanan (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION get_monthly_net_worth(user_id_param UUID)
RETURNS TABLE(month_year TEXT, cumulative_balance NUMERIC) AS $$
BEGIN
    IF user_id_param != auth.uid() THEN
        RAISE EXCEPTION 'Akses Ditolak: Unauthorized Data Access.';
    END IF;

    RETURN QUERY
    WITH monthly_flows AS (
        SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS m_year,
               SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net_flow
        FROM public.transactions
        WHERE user_id = user_id_param AND deleted_at IS NULL
        GROUP BY 1
    )
    SELECT m_year, SUM(net_flow) OVER (ORDER BY m_year ASC) AS cumulative_balance
    FROM monthly_flows ORDER BY m_year ASC;
END;
$$ LANGUAGE plpgsql;

-- AI Prediktif dengan Dynamic Threshold & Historical Baseline (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION get_budget_predictive_analysis(user_id_param UUID)
RETURNS TABLE(
    category_name TEXT, budget_limit NUMERIC, current_spent NUMERIC,
    days_elapsed INT, days_in_month INT, burn_rate_per_day NUMERIC,
    projected_end_spent NUMERIC, is_anomaly BOOLEAN, ai_warning_message TEXT
) AS $$
DECLARE
    start_of_month TIMESTAMPTZ; current_time_wib TIMESTAMPTZ;
    total_days INT; elapsed_days INT;
BEGIN
    IF user_id_param != auth.uid() THEN
        RAISE EXCEPTION 'Akses Ditolak: Unauthorized Data Access.';
    END IF;

    current_time_wib := NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta';
    start_of_month   := date_trunc('month', current_time_wib);
    total_days       := EXTRACT(DAY FROM (date_trunc('month', current_time_wib) + INTERVAL '1 month' - INTERVAL '1 day'));
    elapsed_days     := EXTRACT(DAY FROM current_time_wib);
    IF elapsed_days = 0 THEN elapsed_days := 1; END IF;

    RETURN QUERY
    WITH historical_totals AS (
        SELECT 
            c.id AS cat_id,
            COALESCE(SUM(t.amount), 0) AS total_historical_spent,
            (COUNT(DISTINCT date_trunc('month', t.date)) * c.budget_limit) AS total_historical_budget
        FROM public.categories c
        LEFT JOIN public.transactions t ON t.category_id = c.id
            AND t.user_id = user_id_param
            AND t.deleted_at IS NULL
            AND t.type = 'expense'
            AND t.date >= (start_of_month - INTERVAL '3 month')
            AND t.date < start_of_month
        WHERE c.user_id = user_id_param AND c.budget_limit > 0
        GROUP BY c.id, c.budget_limit
    ),
    current_month_expenses AS (
        SELECT c.id AS cat_id, c.name AS cat_name, c.budget_limit AS limit_amt, SUM(t.amount) AS spent_amt
        FROM public.transactions t
        JOIN public.categories c ON t.category_id = c.id
        WHERE t.user_id = user_id_param AND t.deleted_at IS NULL 
          AND t.type = 'expense' AND t.date >= start_of_month AND c.budget_limit > 0
        GROUP BY c.id, c.name, c.budget_limit
    )
    SELECT 
        cme.cat_name::TEXT, 
        cme.limit_amt::NUMERIC, 
        cme.spent_amt::NUMERIC,
        elapsed_days::INT, 
        total_days::INT,
        (cme.spent_amt / elapsed_days)::NUMERIC AS burn_rate_per_day,
        ((cme.spent_amt / elapsed_days) * total_days)::NUMERIC AS projected_end_spent,
        (((cme.spent_amt / elapsed_days) * total_days) > cme.limit_amt)::BOOLEAN AS is_anomaly,
        CASE 
            WHEN ((cme.spent_amt / elapsed_days) * total_days) > cme.limit_amt THEN
                'Peringatan Kritis! Anggaran kategori ' || cme.cat_name || ' diproyeksikan akan membengkak.'
            WHEN (cme.spent_amt / NULLIF(cme.limit_amt, 0)) >= 
                 COALESCE(NULLIF(ht.total_historical_spent / NULLIF(ht.total_historical_budget, 0), 0), 0.5) 
                 AND elapsed_days <= (total_days * 0.3) THEN
                'Anomali Terdeteksi: Anda telah menghabiskan > ' || 
                ROUND(COALESCE(ht.total_historical_spent / NULLIF(ht.total_historical_budget, 0), 0.5) * 100) || 
                '% anggaran ' || cme.cat_name || ' terlalu cepat berdasarkan pola historis.'
            ELSE
                'Anggaran aman. Pola konsumsi Anda stabil.'
        END::TEXT AS ai_warning_message
    FROM current_month_expenses cme
    LEFT JOIN historical_totals ht ON cme.cat_id = ht.cat_id;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 8. SISTEM OTOMASI & CRON JOB
-- ====================================================================

CREATE OR REPLACE FUNCTION process_recurring_schedules()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    sched RECORD; new_next_date DATE;
BEGIN
    FOR sched IN 
        SELECT * FROM recurring_schedules WHERE is_active = true AND next_run_date <= CURRENT_DATE
    LOOP
        INSERT INTO transactions (user_id, account_id, category_id, amount, type, description, date) 
        VALUES (sched.user_id, sched.account_id, sched.category_id, sched.amount, sched.type, 
                COALESCE(sched.description, 'Tanpa Catatan') || ' (Otomatis)', CURRENT_DATE);

        CASE sched.frequency
            WHEN 'daily' THEN new_next_date := sched.next_run_date + INTERVAL '1 day';
            WHEN 'weekly' THEN new_next_date := sched.next_run_date + INTERVAL '1 week';
            WHEN 'monthly' THEN new_next_date := sched.next_run_date + INTERVAL '1 month';
            WHEN 'yearly' THEN new_next_date := sched.next_run_date + INTERVAL '1 year';
            ELSE new_next_date := sched.next_run_date + INTERVAL '1 month';
        END CASE;

        WHILE new_next_date <= CURRENT_DATE LOOP
            CASE sched.frequency
                WHEN 'daily' THEN new_next_date := new_next_date + INTERVAL '1 day';
                WHEN 'weekly' THEN new_next_date := new_next_date + INTERVAL '1 week';
                WHEN 'monthly' THEN new_next_date := new_next_date + INTERVAL '1 month';
                WHEN 'yearly' THEN new_next_date := new_next_date + INTERVAL '1 year';
            END CASE;
        END LOOP;

        UPDATE recurring_schedules SET next_run_date = new_next_date, updated_at = NOW() WHERE id = sched.id;
    END LOOP;
END;
$$;

-- Hapus jadwal cron lama (abaikan jika tidak ada)
DO $$
BEGIN
    PERFORM cron.unschedule('eksekusi-otomasi-harian-managjeh');
EXCEPTION WHEN OTHERS THEN
    -- Job tidak ditemukan, tidak apa-apa
    NULL;
END $$;

-- Buat jadwal baru
SELECT cron.schedule('eksekusi-otomasi-harian-managjeh', '0 17 * * *', 'SELECT process_recurring_schedules();');
-- ====================================================================
-- 9. PENGATURAN LAINNYA (Undangan Wallet, Storage, Realtime)
-- ====================================================================

-- Undangan Wallet (aman dengan pengecekan hak akses)
CREATE OR REPLACE FUNCTION invite_user_to_wallet(wallet_id UUID, invitee_email TEXT)
RETURNS void AS $$
DECLARE target_user_id UUID;
BEGIN
    IF NOT has_write_access(wallet_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki izin untuk mengundang pengguna ke dompet ini.';
    END IF;

    SELECT id INTO target_user_id FROM auth.users WHERE email = invitee_email;
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Pengguna dengan email tersebut tidak ditemukan.';
    END IF;
    
    INSERT INTO public.account_members (account_id, user_id, role) 
    VALUES (wallet_id, target_user_id, 'member');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Storage Setup
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload receipts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Public can view receipts" ON storage.objects;
CREATE POLICY "Public can view receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');

-- Realtime Configuration (safe idempotent)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Tabel sudah terdaftar di publikasi
END $$;

-- ====================================================================
-- 10. SECURITY HARDENING: VALIDASI INPUT XSS & SANITASI
-- ====================================================================
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS valid_category_name_format;
ALTER TABLE public.categories ADD CONSTRAINT valid_category_name_format 
CHECK (
  name ~ '^[a-zA-Z0-9\s\-\_\.\,\(\)\&\/]+$'   -- ← mengizinkan & dan /
  AND length(name) > 0 
  AND length(name) <= 50
);

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS safe_transaction_description;
ALTER TABLE public.transactions ADD CONSTRAINT safe_transaction_description
CHECK (
  description IS NULL OR 
  (
    description NOT ILIKE '%<%' AND 
    description NOT ILIKE '%>%' AND 
    length(description) <= 500
  )
);

-- ====================================================================
-- 11. PATCH KEAMANAN TAMBAHAN & PEMBERSIHAN
-- ====================================================================
-- Hapus fungsi manual yang sudah tidak terpakai (sudah di-handle trigger)
DROP FUNCTION IF EXISTS public.increment_account_balance(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.decrement_account_balance(UUID, NUMERIC);

-- Policy tambahan untuk transaksi pribadi
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
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

-- Perbaikan data lama
UPDATE public.accounts SET type = 'bank' WHERE type IS NULL;
ALTER TABLE public.accounts ALTER COLUMN type SET NOT NULL;

-- Flush Cache Skema
NOTIFY pydantic_supabase_admin_pgrst, 'reload schema';

-- ====================================================================
-- MANAGJEH PRO - DATABASE SCHEMA FINAL (v2.0)
-- ====================================================================
-- Fitur:
--   - Multi-wallet dengan kolaborasi (owner/admin/member)
--   - Transaksi, transfer, soft delete + audit log lengkap
--   - Recurring transactions + pg_cron (setiap 5 menit)
--   - Row Level Security (RLS) ketat
--   - Trigger saldo akun (revert-apply pattern, aman untuk single-user)
--   - View & fungsi analitik (net worth, cash flow, AI predictive)
--   - Storage bucket untuk receipt scan
--   - Realtime Supabase
--   - Enum & check constraint untuk integritas data
-- ====================================================================

-- ====================================================================
-- 1. EKSTENSI & TIPE DATA (ENUM)
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer', 'otomasi');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_sub_type AS ENUM ('cash', 'bank', 'e-wallet', 'crypto', 'investment', 'debt');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE recurrence_frequency AS ENUM ('daily', 'weekly', 'monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ====================================================================
-- 2. PEMBUATAN TABEL UTAMA
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.accounts (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    type       account_sub_type DEFAULT 'bank',
    currency   VARCHAR(3) DEFAULT 'IDR',
    balance    NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name         VARCHAR(50) NOT NULL,
    type         transaction_type NOT NULL,
    color_code   VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    budget_limit NUMERIC(15, 2) DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_category UNIQUE (user_id, name, type)
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id             UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    transfer_to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    category_id            UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
    amount                 NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    type                   transaction_type NOT NULL,
    description            TEXT,
    date                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    deleted_at             TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS public.recurring_schedules (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id    UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    category_id   UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    amount        NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    type          transaction_type NOT NULL,
    description   TEXT,
    frequency     recurrence_frequency DEFAULT 'monthly',
    next_run_date DATE NOT NULL,
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.account_members (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role       VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, user_id)
);

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

-- ====================================================================
-- 3. INDEKS UNTUK OPTIMASI PERFORMA
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_categories_user_type ON public.categories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_recurring_user_active ON public.recurring_schedules(user_id, is_active);

-- ====================================================================
-- 4. FUNGSI HELPER & LOGIKA INTI
-- ====================================================================

-- Helper untuk RLS (Bypass rekursi)
CREATE OR REPLACE FUNCTION is_account_member(target_account_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.account_members 
        WHERE account_id = target_account_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- ====================================================================
-- 5. PENGATURAN KEAMANAN (ROW LEVEL SECURITY - RLS)
-- ====================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

-- Categories Policy
DROP POLICY IF EXISTS "Strict user isolation for categories" ON public.categories;
CREATE POLICY "Strict user isolation for categories" 
    ON public.categories FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Accounts Policy
DROP POLICY IF EXISTS "Collaborative Account Access" ON public.accounts;
CREATE POLICY "Collaborative Account Access" 
    ON public.accounts FOR ALL 
    USING (user_id = auth.uid() OR is_account_member(id));

-- Transactions Policies
DROP POLICY IF EXISTS "Members can view community transactions" ON public.transactions;
CREATE POLICY "Members can view community transactions" 
    ON public.transactions FOR SELECT 
    USING (user_id = auth.uid() OR is_account_member(account_id));

DROP POLICY IF EXISTS "Only admins/owners can write community transactions" ON public.transactions;
CREATE POLICY "Only admins/owners can write community transactions" 
    ON public.transactions FOR INSERT 
    WITH CHECK (user_id = auth.uid() OR has_write_access(account_id));

DROP POLICY IF EXISTS "Only admins/owners can update community transactions" ON public.transactions;
CREATE POLICY "Only admins/owners can update community transactions" 
    ON public.transactions FOR UPDATE 
    USING (user_id = auth.uid() OR has_write_access(account_id));

-- Recurring Schedules Policy
DROP POLICY IF EXISTS "Users manage their own recurring" ON public.recurring_schedules;
CREATE POLICY "Users manage their own recurring" 
    ON public.recurring_schedules FOR ALL USING (auth.uid() = user_id);

-- Audit Logs Policy
DROP POLICY IF EXISTS "Users can only view their own audit logs" ON public.audit_logs;
CREATE POLICY "Users can only view their own audit logs" 
    ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Account Members Policy
DROP POLICY IF EXISTS "View co-members" ON public.account_members;
CREATE POLICY "View co-members" 
    ON public.account_members FOR SELECT 
    USING (user_id = auth.uid() OR is_account_member(account_id));

-- ====================================================================
-- 6. TRIGGERS
-- ====================================================================

-- A. Otomatisasi Kategori User Baru
CREATE OR REPLACE FUNCTION public.handle_new_user_categories()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.categories (user_id, name, type, color_code) VALUES
        (NEW.id, 'Makanan & Minuman', 'expense', '#EF4444'),
        (NEW.id, 'Transportasi', 'expense', '#F59E0B'),
        (NEW.id, 'Belanja Bulanan', 'expense', '#3B82F6'),
        (NEW.id, 'Hiburan & Rekreasi', 'expense', '#8B5CF6'),
        (NEW.id, 'Tagihan & Utilitas', 'expense', '#EC4899'),
        (NEW.id, 'Gaji Utama', 'income', '#10B981'),
        (NEW.id, 'Investasi', 'income', '#06B6D4'),
        (NEW.id, 'Sampingan (Freelance)', 'income', '#84CC16');

    INSERT INTO public.categories (user_id, name, type, color_code, budget_limit) VALUES
        (NEW.id, 'Tagihan Internet / WiFi', 'otomasi', '#3b82f6', 0),
        (NEW.id, 'Langganan Streaming', 'otomasi', '#ef4444', 0),
        (NEW.id, 'Cicilan / KPR', 'otomasi', '#f59e0b', 0),
        (NEW.id, 'Asuransi Kesehatan', 'otomasi', '#10b981', 0),
        (NEW.id, 'Investasi Rutin', 'otomasi', '#8b5cf6', 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_categories();

-- B. Update Saldo Akun setelah Transaksi (Revert-Apply Pattern)
CREATE OR REPLACE FUNCTION update_balance_after_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Jika DELETE: kembalikan saldo seperti semula
    IF (TG_OP = 'DELETE') THEN
        IF OLD.type = 'expense' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
        ELSIF OLD.type = 'income' THEN
            UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
        ELSIF OLD.type = 'transfer' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
            UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.transfer_to_account_id;
        END IF;
        RETURN OLD;
    END IF;

    -- Jika UPDATE: revert lalu apply (jika bukan soft delete)
    IF (TG_OP = 'UPDATE') THEN
        -- Kembalikan efek OLD
        IF OLD.type = 'expense' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
        ELSIF OLD.type = 'income' THEN
            UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
        ELSIF OLD.type = 'transfer' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
            UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.transfer_to_account_id;
        END IF;

        -- Terapkan efek NEW (jika bukan soft delete)
        IF NEW.deleted_at IS NULL THEN
            IF NEW.type = 'expense' THEN
                UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
            ELSIF NEW.type = 'income' THEN
                UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
            ELSIF NEW.type = 'transfer' THEN
                UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
                UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.transfer_to_account_id;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    -- Jika INSERT (normal): terapkan efek NEW
    IF NEW.type = 'expense' THEN
        UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'income' THEN
        UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'transfer' THEN
        UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
        UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.transfer_to_account_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_balance ON public.transactions;
CREATE TRIGGER trigger_update_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION update_balance_after_transaction();

-- C. Jadikan pembuat akun sebagai 'owner'
CREATE OR REPLACE FUNCTION auto_add_account_owner()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.account_members (account_id, user_id, role)
    VALUES (NEW.id, NEW.user_id, 'owner');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_auto_add_owner ON public.accounts;
CREATE TRIGGER trigger_auto_add_owner
    AFTER INSERT ON public.accounts FOR EACH ROW EXECUTE FUNCTION auto_add_account_owner();

-- D. Audit Log Lengkap (INSERT, UPDATE, DELETE)
CREATE OR REPLACE FUNCTION log_all_transaction_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data)
        VALUES (NEW.user_id, 'INSERT', 'transactions', NEW.id, to_jsonb(NEW));
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
        VALUES (NEW.user_id, 'UPDATE', 'transactions', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data)
        VALUES (OLD.user_id, 'DELETE', 'transactions', OLD.id, to_jsonb(OLD));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_audit_all_transactions ON public.transactions;
CREATE TRIGGER trigger_audit_all_transactions
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION log_all_transaction_changes();

-- ====================================================================
-- 7. ANALITIK, VIEW, & FUNGSI LAPORAN
-- ====================================================================

CREATE OR REPLACE VIEW user_dashboard_stats WITH (security_invoker = on) AS
SELECT 
    user_id,
    COALESCE(SUM(CASE WHEN type != 'debt' THEN balance ELSE 0 END), 0) AS total_assets,
    COALESCE(SUM(CASE WHEN type = 'debt' THEN ABS(balance) ELSE 0 END), 0) AS total_liabilities,
    (
        COALESCE(SUM(CASE WHEN type != 'debt' THEN balance ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN type = 'debt' THEN ABS(balance) ELSE 0 END), 0)
    ) AS net_worth
FROM accounts GROUP BY user_id;

CREATE OR REPLACE FUNCTION get_financial_summary(user_id_param UUID)
RETURNS json AS $$
DECLARE
    total_balance NUMERIC; monthly_income NUMERIC; monthly_expense NUMERIC;
BEGIN
    IF user_id_param != auth.uid() THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak dapat melihat ringkasan keuangan orang lain.';
    END IF;

    SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) INTO total_balance
    FROM public.transactions WHERE user_id = user_id_param AND deleted_at IS NULL;

    SELECT COALESCE(SUM(amount), 0) INTO monthly_income
    FROM public.transactions
    WHERE user_id = user_id_param AND type = 'income' AND deleted_at IS NULL 
    AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE);

    SELECT COALESCE(SUM(amount), 0) INTO monthly_expense
    FROM public.transactions
    WHERE user_id = user_id_param AND type = 'expense' AND deleted_at IS NULL 
    AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE);

    RETURN json_build_object(
        'total_balance', total_balance,
        'monthly_income', monthly_income,
        'monthly_expense', monthly_expense
    );
END;
$$ LANGUAGE plpgsql; -- SECURITY INVOKER (default)

CREATE OR REPLACE FUNCTION get_monthly_net_worth(user_id_param UUID)
RETURNS TABLE(month_year TEXT, cumulative_balance NUMERIC) AS $$
BEGIN
    IF user_id_param != auth.uid() THEN
        RAISE EXCEPTION 'Akses Ditolak: Unauthorized Data Access.';
    END IF;

    RETURN QUERY
    WITH monthly_flows AS (
        SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS m_year,
               SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net_flow
        FROM public.transactions
        WHERE user_id = user_id_param AND deleted_at IS NULL
        GROUP BY 1
    )
    SELECT m_year, SUM(net_flow) OVER (ORDER BY m_year ASC) AS cumulative_balance
    FROM monthly_flows ORDER BY m_year ASC;
END;
$$ LANGUAGE plpgsql;

-- AI Prediktif dengan Dynamic Threshold & Historical Baseline (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION get_budget_predictive_analysis(user_id_param UUID)
RETURNS TABLE(
    category_name TEXT, budget_limit NUMERIC, current_spent NUMERIC,
    days_elapsed INT, days_in_month INT, burn_rate_per_day NUMERIC,
    projected_end_spent NUMERIC, is_anomaly BOOLEAN, ai_warning_message TEXT
) AS $$
DECLARE
    start_of_month TIMESTAMPTZ; current_time_wib TIMESTAMPTZ;
    total_days INT; elapsed_days INT;
BEGIN
    IF user_id_param != auth.uid() THEN
        RAISE EXCEPTION 'Akses Ditolak: Unauthorized Data Access.';
    END IF;

    current_time_wib := NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta';
    start_of_month   := date_trunc('month', current_time_wib);
    total_days       := EXTRACT(DAY FROM (date_trunc('month', current_time_wib) + INTERVAL '1 month' - INTERVAL '1 day'));
    elapsed_days     := EXTRACT(DAY FROM current_time_wib);
    IF elapsed_days = 0 THEN elapsed_days := 1; END IF;

    RETURN QUERY
    WITH historical_totals AS (
        SELECT 
            c.id AS cat_id,
            COALESCE(SUM(t.amount), 0) AS total_historical_spent,
            (COUNT(DISTINCT date_trunc('month', t.date)) * c.budget_limit) AS total_historical_budget
        FROM public.categories c
        LEFT JOIN public.transactions t ON t.category_id = c.id
            AND t.user_id = user_id_param
            AND t.deleted_at IS NULL
            AND t.type = 'expense'
            AND t.date >= (start_of_month - INTERVAL '3 month')
            AND t.date < start_of_month
        WHERE c.user_id = user_id_param AND c.budget_limit > 0
        GROUP BY c.id, c.budget_limit
    ),
    current_month_expenses AS (
        SELECT c.id AS cat_id, c.name AS cat_name, c.budget_limit AS limit_amt, SUM(t.amount) AS spent_amt
        FROM public.transactions t
        JOIN public.categories c ON t.category_id = c.id
        WHERE t.user_id = user_id_param AND t.deleted_at IS NULL 
          AND t.type = 'expense' AND t.date >= start_of_month AND c.budget_limit > 0
        GROUP BY c.id, c.name, c.budget_limit
    )
    SELECT 
        cme.cat_name::TEXT, 
        cme.limit_amt::NUMERIC, 
        cme.spent_amt::NUMERIC,
        elapsed_days::INT, 
        total_days::INT,
        (cme.spent_amt / elapsed_days)::NUMERIC AS burn_rate_per_day,
        ((cme.spent_amt / elapsed_days) * total_days)::NUMERIC AS projected_end_spent,
        (((cme.spent_amt / elapsed_days) * total_days) > cme.limit_amt)::BOOLEAN AS is_anomaly,
        CASE 
            WHEN ((cme.spent_amt / elapsed_days) * total_days) > cme.limit_amt THEN
                'Peringatan Kritis! Anggaran kategori ' || cme.cat_name || ' diproyeksikan akan membengkak.'
            WHEN (cme.spent_amt / NULLIF(cme.limit_amt, 0)) >= 
                 COALESCE(NULLIF(ht.total_historical_spent / NULLIF(ht.total_historical_budget, 0), 0), 0.5) 
                 AND elapsed_days <= (total_days * 0.3) THEN
                'Anomali Terdeteksi: Anda telah menghabiskan > ' || 
                ROUND(COALESCE(ht.total_historical_spent / NULLIF(ht.total_historical_budget, 0), 0.5) * 100) || 
                '% anggaran ' || cme.cat_name || ' terlalu cepat berdasarkan pola historis.'
            ELSE
                'Anggaran aman. Pola konsumsi Anda stabil.'
        END::TEXT AS ai_warning_message
    FROM current_month_expenses cme
    LEFT JOIN historical_totals ht ON cme.cat_id = ht.cat_id;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 8. SISTEM OTOMASI & CRON JOB (setiap 5 menit)
-- ====================================================================

CREATE OR REPLACE FUNCTION process_recurring_schedules()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    sched RECORD; new_next_date DATE;
BEGIN
    FOR sched IN 
        SELECT * FROM recurring_schedules WHERE is_active = true AND next_run_date <= CURRENT_DATE
    LOOP
        INSERT INTO transactions (user_id, account_id, category_id, amount, type, description, date) 
        VALUES (sched.user_id, sched.account_id, sched.category_id, sched.amount, sched.type, 
                COALESCE(sched.description, 'Tanpa Catatan') || ' (Otomatis)', CURRENT_DATE);

        CASE sched.frequency
            WHEN 'daily' THEN new_next_date := sched.next_run_date + INTERVAL '1 day';
            WHEN 'weekly' THEN new_next_date := sched.next_run_date + INTERVAL '1 week';
            WHEN 'monthly' THEN new_next_date := sched.next_run_date + INTERVAL '1 month';
            WHEN 'yearly' THEN new_next_date := sched.next_run_date + INTERVAL '1 year';
        END CASE;

        WHILE new_next_date <= CURRENT_DATE LOOP
            CASE sched.frequency
                WHEN 'daily' THEN new_next_date := new_next_date + INTERVAL '1 day';
                WHEN 'weekly' THEN new_next_date := new_next_date + INTERVAL '1 week';
                WHEN 'monthly' THEN new_next_date := new_next_date + INTERVAL '1 month';
                WHEN 'yearly' THEN new_next_date := new_next_date + INTERVAL '1 year';
            END CASE;
        END LOOP;

        UPDATE recurring_schedules SET next_run_date = new_next_date, updated_at = NOW() WHERE id = sched.id;
    END LOOP;
END;
$$;

-- Hapus jadwal cron lama (jika ada)
DO $$
BEGIN
    PERFORM cron.unschedule('eksekusi-otomasi-harian-managjeh');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Buat jadwal baru setiap 5 menit
SELECT cron.schedule('eksekusi-otomasi-5menit', '*/5 * * * *', 'SELECT process_recurring_schedules();');

-- ====================================================================
-- 9. PENGATURAN LAINNYA (Undangan Wallet, Storage, Realtime)
-- ====================================================================

-- Undangan Wallet (aman dengan pengecekan hak akses)
CREATE OR REPLACE FUNCTION invite_user_to_wallet(wallet_id UUID, invitee_email TEXT)
RETURNS void AS $$
DECLARE target_user_id UUID;
BEGIN
    IF NOT has_write_access(wallet_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki izin untuk mengundang pengguna ke dompet ini.';
    END IF;

    SELECT id INTO target_user_id FROM auth.users WHERE email = invitee_email;
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Pengguna dengan email tersebut tidak ditemukan.';
    END IF;
    
    INSERT INTO public.account_members (account_id, user_id, role) 
    VALUES (wallet_id, target_user_id, 'member');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Storage Setup
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload receipts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Public can view receipts" ON storage.objects;
CREATE POLICY "Public can view receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');

-- Realtime Configuration (safe idempotent)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ====================================================================
-- 10. PATCH KEAMANAN & PEMBERSIHAN
-- ====================================================================

-- Hapus fungsi manual yang sudah tidak terpakai (di-handle trigger)
DROP FUNCTION IF EXISTS public.increment_account_balance(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.decrement_account_balance(UUID, NUMERIC);

-- Policy tambahan untuk transaksi pribadi
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
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

-- Perbaikan data lama
UPDATE public.accounts SET type = 'bank' WHERE type IS NULL;
ALTER TABLE public.accounts ALTER COLUMN type SET NOT NULL;

-- Flush Cache Skema
NOTIFY pydantic_supabase_admin_pgrst, 'reload schema';

-- Cabut policy lama
DROP POLICY IF EXISTS "Members can view community transactions" ON public.transactions;

-- Buat policy baru yang memblokir data dengan deleted_at secara mutlak di lapisan database
CREATE POLICY "Members can view active community transactions only" 
    ON public.transactions FOR SELECT 
    USING (
      (user_id = auth.uid() OR is_account_member(account_id)) 
      AND deleted_at IS NULL
    );

BEGIN;

-- ==========================================
-- 1. HELPER: PUSAT ADJUSTMENT SALDO (DRY PRINCIPLE)
-- ==========================================
CREATE OR REPLACE FUNCTION public.adjust_balance(
    p_account_id UUID, 
    p_amount NUMERIC, 
    p_action_type VARCHAR -- 'ADD' atau 'SUBTRACT'
)
RETURNS VOID AS $$
BEGIN
    IF p_action_type = 'ADD' THEN
        UPDATE public.accounts 
        SET balance = balance + p_amount 
        WHERE id = p_account_id;
    ELSIF p_action_type = 'SUBTRACT' THEN
        UPDATE public.accounts 
        SET balance = balance - p_amount 
        WHERE id = p_account_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 2. HELPER: KOORDINATOR EVENT TRANSAKSI
-- ==========================================
CREATE OR REPLACE FUNCTION public.process_transaction_effect(
    p_type VARCHAR,
    p_account_id UUID,
    p_transfer_to_account_id UUID,
    p_amount NUMERIC,
    p_direction INT -- 1 untuk Apply (Normal), -1 untuk Rollback/Revert
)
RETURNS VOID AS $$
BEGIN
    -- INCOME
    IF p_type = 'income' THEN
        PERFORM public.adjust_balance(
            p_account_id, 
            p_amount, 
            CASE WHEN p_direction = 1 THEN 'ADD' ELSE 'SUBTRACT' END
        );
        
    -- EXPENSE
    ELSIF p_type = 'expense' THEN
        PERFORM public.adjust_balance(
            p_account_id, 
            p_amount, 
            CASE WHEN p_direction = 1 THEN 'SUBTRACT' ELSE 'ADD' END
        );
        
    -- TRANSFER
    ELSIF p_type = 'transfer' THEN
        -- Sisi Dompet Asal
        PERFORM public.adjust_balance(
            p_account_id, 
            p_amount, 
            CASE WHEN p_direction = 1 THEN 'SUBTRACT' ELSE 'ADD' END
        );
        -- Sisi Dompet Tujuan
        PERFORM public.adjust_balance(
            p_transfer_to_account_id, 
            p_amount, 
            CASE WHEN p_direction = 1 THEN 'ADD' ELSE 'SUBTRACT' END
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 3. TRIGGER UTAMA: MENJADI ULTRA-LEAN
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_balance_after_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Skenario A: DELETE Keras ATAU Soft Delete (UPDATE deleted_at dari NULL menjadi Berisi)
    IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
        PERFORM public.process_transaction_effect(OLD.type, OLD.account_id, OLD.transfer_to_account_id, OLD.amount, -1);
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    -- Skenario B: INSERT Baru ATAU Restore Data (UPDATE deleted_at dari Berisi menjadi NULL)
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL) THEN
        PERFORM public.process_transaction_effect(NEW.type, NEW.account_id, NEW.transfer_to_account_id, NEW.amount, 1);
        RETURN NEW;
    END IF;

    -- Skenario C: UPDATE Normal Nilai Mutasi (Amount, Type, atau Account bergeser)
    IF (TG_OP = 'UPDATE' AND NEW.deleted_at IS NULL AND OLD.deleted_at IS NULL) THEN
        -- 1. Matikan efek lama (-1)
        PERFORM public.process_transaction_effect(OLD.type, OLD.account_id, OLD.transfer_to_account_id, OLD.amount, -1);
        -- 2. Nyalakan efek baru (1)
        PERFORM public.process_transaction_effect(NEW.type, NEW.account_id, NEW.transfer_to_account_id, NEW.amount, 1);
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMIT;