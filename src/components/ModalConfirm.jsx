export default function ModalConfirm({ isOpen, title, message, onConfirm, onCancel, confirmText = "Ya, Hapus", danger = true }) {
  if (!isOpen) return null;

  return (
    // Tambahkan onClick={onCancel} di backdrop gelap ini
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-opacity animate-in fade-in duration-200"
      onClick={onCancel} 
    >
      {/* Tambahkan e.stopPropagation() agar klik di dalam kotak putih TIDAK menutup modal */}
      <div 
        className="bg-white p-6 rounded-3xl shadow-xl max-w-sm w-full animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()} 
      >
        {title && <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>}
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">{message}</p>
        
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-colors outline-none focus:ring-2 focus:ring-slate-200"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-bold text-white rounded-xl transition-all outline-none focus:ring-4 ${
              danger ? 'bg-red-600 hover:bg-red-700 focus:ring-red-200' : 'bg-slate-900 hover:bg-slate-800 focus:ring-slate-200'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}