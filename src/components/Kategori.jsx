import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import ModalConfirm from './ModalConfirm';

export default function Kategori({ isOpen, onClose, type, categories }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3B82F6');
  const [newCatBudget, setNewCatBudget] = useState('');
  const [catMessage, setCatMessage] = useState({ type: '', text: '' });
  const [deleteCatModal, setDeleteCatModal] = useState({ isOpen: false, id: null, name: '' });

  // Memoisasi filtered categories untuk performa
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  // === DYNAMIC TITLE LOGIC ===
  const getTitle = () => {
    if (type === 'expense') return 'Pengeluaran';
    if (type === 'income') return 'Pemasukan';
    if (type === 'otomasi') return 'Otomasi';
    return 'Entitas';
  };

  // Mutasi untuk menambah kategori
  const createCategoryMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('categories').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      // Segarkan data master (akun & kategori) di semua komponen
      queryClient.invalidateQueries({ queryKey: ['masterData', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['masterDataOtomasi', user?.id] });
      setCatMessage({ type: 'success', text: 'Kategori berhasil ditambahkan.' });
      setNewCatName('');
      setNewCatBudget('');
      setTimeout(() => setCatMessage({ type: '', text: '' }), 3000);
    },
    onError: (err) => {
      setCatMessage({
        type: 'error',
        text: err.code === '23505' ? `Kategori "${newCatName}" sudah ada untuk tipe ${getTitle()}.` : err.message,
      });
    },
  });

  // Mutasi untuk menghapus kategori
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masterData'] });
      queryClient.invalidateQueries({ queryKey: ['masterDataOtomasi'] });
      setDeleteCatModal({ isOpen: false, id: null, name: '' });
    },
    onError: () => {
      setCatMessage({ type: 'error', text: 'Gagal: Kategori sedang digunakan pada transaksi.' });
      setDeleteCatModal({ isOpen: false, id: null, name: '' });
      setTimeout(() => setCatMessage({ type: '', text: '' }), 3000);
    },
  });

  const handleCreateCategory = (e) => {
    e.preventDefault();
    const numericBudget = newCatBudget ? parseFloat(newCatBudget) : 0;
    
    // Cegah submission jika tipe kosong/undefined
    if (!type) {
      setCatMessage({ type: 'error', text: 'Tipe kategori (type prop) tidak valid.' });
      return;
    }

    createCategoryMutation.mutate({
      name: newCatName.trim(),
      type: type,
      color_code: newCatColor,
      budget_limit: numericBudget,
    });
  };

  const requestDeleteCat = (id, name) => setDeleteCatModal({ isOpen: true, id, name });

  const executeDeleteCat = () => {
    if (deleteCatModal.id) deleteCategoryMutation.mutate(deleteCatModal.id);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-900">
            Kelola Kategori {getTitle()}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 outline-none transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Modal */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {catMessage.text && (
            <div
              className={`p-3 rounded-xl flex items-start gap-2 text-xs font-bold border ${
                catMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {catMessage.type === 'success' ? (
                <CheckCircle size={16} className="mt-0.5" />
              ) : (
                <AlertCircle size={16} className="mt-0.5" />
              )}
              <span>{catMessage.text}</span>
            </div>
          )}

          {/* Form Tambah Cepat */}
          <form onSubmit={handleCreateCategory} className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tambah Baru</h4>
            <div>
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Nama Kategori..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center gap-3 w-full">
              <input
                type="color"
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                className="flex-shrink-0 h-10 w-12 p-0.5 border border-slate-300 rounded-xl cursor-pointer bg-white outline-none focus:ring-2 focus:ring-slate-900"
                title="Warna Kategori"
              />
              {type === 'expense' && (
                <input
                  type="number"
                  min="0"
                  value={newCatBudget}
                  onChange={(e) => setNewCatBudget(e.target.value)}
                  placeholder="Batas Anggaran (Opsional)"
                  className="flex-1 min-w-0 px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={createCategoryMutation.isPending || !newCatName.trim()}
              className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-slate-800 disabled:opacity-50 outline-none transition-colors flex items-center justify-center"
            >
              {createCategoryMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                'Simpan Kategori'
              )}
            </button>
          </form>

          {/* Daftar Kategori Berjalan */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Daftar Aktif</h4>
            <ul className="space-y-2">
              {filteredCategories.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color_code }}
                      ></div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 leading-tight">
                          {cat.name}
                        </p>
                        {cat.budget_limit > 0 && (
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            Limit: Rp {Number(cat.budget_limit).toLocaleString('id-ID')}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => requestDeleteCat(cat.id, cat.name)}
                      className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors outline-none"
                      title="Hapus Kategori"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              {filteredCategories.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  Belum ada kategori terdaftar.
                </p>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Modal Hapus Kategori */}
      <ModalConfirm
        isOpen={deleteCatModal.isOpen}
        title="Hapus Kategori"
        message={`Yakin ingin menghapus kategori "${deleteCatModal.name}"? Jika sudah digunakan pada transaksi, penghapusan akan dibatalkan.`}
        onConfirm={executeDeleteCat}
        onCancel={() => setDeleteCatModal({ isOpen: false, id: null, name: '' })}
        confirmText="Ya, Hapus"
        danger={true}
      />
    </div>
  );
}