// src/features/categories/hooks/useCategoryMutations.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';

export const useCategoryMutations = (type) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();

  const getTitle = () => {
    if (type === 'expense') return 'Pengeluaran';
    if (type === 'income') return 'Pemasukan';
    if (type === 'otomasi') return 'Otomasi';
    return 'Entitas';
  };

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('categories').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masterData', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['masterDataOtomasi', user?.id] });
      showToast('Kategori berhasil ditambahkan.', 'success');
    },
    onError: (err) => {
      const errorMsg = err.code === '23505' 
        ? `Kategori sudah ada untuk tipe ${getTitle()}.` 
        : err.message;
      showToast(errorMsg, 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masterData', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['masterDataOtomasi', user?.id] });
      showToast('Kategori berhasil dihapus.', 'success');
    },
    onError: () => {
      showToast('Gagal: Kategori sedang digunakan pada transaksi aktif.', 'error');
    },
  });

  return { createMutation, deleteMutation, getTitle };
};