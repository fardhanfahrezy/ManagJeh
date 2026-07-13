// src/components/Kategori.jsx
import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useCategoryMutations } from '../features/categories/hooks/useCategoryMutations';
import { CategoryForm } from '../features/categories/components/CategoryForm';
import { CategoryList } from '../features/categories/components/CategoryList';

export default function Kategori({ isOpen, onClose, type, categories }) {
  const { createMutation, deleteMutation, getTitle } = useCategoryMutations(type);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-900">Kelola Kategori {getTitle()}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 outline-none transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body Terpisah secara Modular */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <CategoryForm type={type} createMutation={createMutation} />
          <CategoryList categories={filteredCategories} deleteMutation={deleteMutation} />
        </div>
        
      </div>
    </div>
  );
}