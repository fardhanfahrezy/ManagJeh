// src/features/categories/components/CategoryForm.jsx
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';

export const CategoryForm = ({ type, createMutation }) => {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [budget, setBudget] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!type) {
      showToast('Tipe kategori tidak valid.', 'error');
      return;
    }

    createMutation.mutate(
      {
        name: name.trim(),
        type: type,
        color_code: color,
        budget_limit: budget ? parseFloat(budget) : 0,
      },
      {
        onSuccess: () => {
          setName('');
          setBudget('');
          // Warna dipertahankan untuk mempercepat entri massal
        }
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tambah Baru</h4>
      <input
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama Kategori..."
        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900"
      />
      <div className="flex items-center gap-3 w-full">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="flex-shrink-0 h-10 w-12 p-0.5 border border-slate-300 rounded-xl cursor-pointer bg-white outline-none focus:ring-2 focus:ring-slate-900"
          title="Warna Kategori"
        />
        {type === 'expense' && (
          <input
            type="number"
            min="0"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Batas Anggaran (Opsional)"
            className="flex-1 min-w-0 px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900"
          />
        )}
      </div>
      <button
        type="submit"
        disabled={createMutation.isPending || !name.trim()}
        className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-slate-800 disabled:opacity-50 outline-none transition-colors flex items-center justify-center"
      >
        {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Simpan Kategori'}
      </button>
    </form>
  );
};