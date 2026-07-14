import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { QUERY_KEYS } from '../../../lib/queryKeys';

export const useTransactionMasterData = (userId) => {
  return useQuery({
    queryKey: QUERY_KEYS.masterData(userId),
    enabled: !!userId,
    queryFn: async () => {
      const [acctsRes, catsRes] = await Promise.all([
        supabase.from('accounts').select('id, name, balance, type').order('type', { ascending: true }),
        supabase.from('categories').select('id, name, type, color_code, budget_limit').order('name')
      ]);
      
      if (acctsRes.error) throw acctsRes.error;
      if (catsRes.error) throw catsRes.error;
      
      return { accounts: acctsRes.data, categories: catsRes.data };
    }
  });
};