import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { generateBuckets, findBucket } from '../lib/dateUtils';

export function useDashboardData(user, periodType, periodValue) {
  return useQuery({
    queryKey: ['dashboardData', user?.id, periodType, periodValue],
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      // Hitung startDate presisi
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      if (periodType === 'minggu') {
        startDate.setDate(startDate.getDate() - (periodValue * 7) + 1);
      } else if (periodType === 'bulan') {
        startDate.setMonth(startDate.getMonth() - periodValue + 1);
        startDate.setDate(1);
      } else if (periodType === 'tahun') {
        startDate.setFullYear(startDate.getFullYear() - periodValue + 1);
        startDate.setMonth(0, 1);
      }

      const [statsRes, accountsRes, insightsRes, recentTxRes, flowTxRes] = await Promise.all([
        supabase.from('user_dashboard_stats').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('accounts').select('*').eq('user_id', user.id).order('type', { ascending: true }),
        supabase.rpc('get_budget_predictive_analysis', { user_id_param: user.id }),
        supabase.from('transactions')
          .select(`id, amount, type, date, description, categories(name), accounts!transactions_account_id_fkey(name)`)
          .eq('user_id', user.id).is('deleted_at', null)
          .order('date', { ascending: false }).limit(5),
        supabase.from('transactions')
          .select('amount, type, date')
          .eq('user_id', user.id)
          .gte('date', startDate.toISOString())
          .is('deleted_at', null)
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (statsRes.error) throw statsRes.error;
      if (recentTxRes.error) throw recentTxRes.error;
      if (flowTxRes.error) throw flowTxRes.error;

      // Bucketing
      const buckets = generateBuckets(periodType, periodValue);
      (flowTxRes.data || []).forEach(tx => {
        if (tx.type === 'transfer') return;
        const match = findBucket(buckets, tx.date, periodType);
        if (match) {
          const amt = Number(tx.amount) || 0;
          if (tx.type === 'income') match.income += amt;
          if (tx.type === 'expense') match.expense += amt;
        }
      });

      return {
        stats: statsRes.data || { total_assets: 0, total_liabilities: 0, net_worth: 0 },
        accounts: accountsRes.data || [],
        aiInsights: insightsRes.data || [],
        recentTransactions: recentTxRes.data || [],
        cashFlow: buckets
      };
    }
  });
}