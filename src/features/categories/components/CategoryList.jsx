// src/features/categories/components/CategoryList.jsx
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import ModalConfirm from '../../../components/ModalConfirm';

export const CategoryList = ({ categories, deleteMutation }) => {
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, name: '' });

  const confirmDelete = () => {
    if (deleteModal.id) {
      deleteMutation.mutate(deleteModal.id, {
        onSuccess: () => setDeleteModal({ isOpen: false, id: null, name: '' }),
        onError: () => setDeleteModal({ isOpen: false, id: null, name: '' }),
      });
    }
  };

  return (
    <div>
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Daftar Aktif</h4>
      <ul className="space-y-2">
        {categories.map((cat) => (
          <li key={cat.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color_code }} />
              <div>
                <p className="text-sm font-bold text-slate-900 leading-tight">{cat.name}</p>
                {cat.budget_limit > 0 && (
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Limit: Rp {Number(cat.budget_limit).toLocaleString('id-ID')}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDeleteModal({ isOpen: true, id: cat.id, name: cat.name })}
              className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors outline-none"
              title="Hapus Kategori"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
        {categories.length === 0 && (
          <p className="text-xs text-slate-400 italic text-center py-4">Belum ada kategori terdaftar.</p>
        )}
      </ul>

      <ModalConfirm
        isOpen={deleteModal.isOpen}
        title="Hapus Kategori"
        message={`Yakin ingin menghapus kategori "${deleteModal.name}"? Jika sudah digunakan pada transaksi, penghapusan akan dibatalkan server.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: null, name: '' })}
        confirmText="Ya, Hapus"
        danger={true}
      />
    </div>
  );
};