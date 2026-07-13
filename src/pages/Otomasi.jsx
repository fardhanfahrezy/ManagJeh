// src/pages/Otomasi.jsx:
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, CalendarClock, Trash2, Repeat, CheckCircle, AlertCircle } from 'lucide-react';
import ModalConfirm from '../components/ModalConfirm';
import { formatIDR } from '../lib/utils';

// ==============================================================================
// SKELETON: Otomasi
// ==============================================================================
const OtomasiSkeleton = () => (
  <div className="max-w-4xl mx-auto space-y-8 px-4 pb-12 animate-pulse w-full">
    <div className="space-y-3">
      <div className="h-8 bg-slate-200 rounded-xl w-64"></div>
      <div className="h-4 bg-slate-200 rounded-lg w-80"></div>
    </div>
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="divide-y divide-slate-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3"><div className="h-3 w-3 bg-slate-200 rounded-full"></div><div className="h-5 w-32 bg-slate-200 rounded-lg"></div></div>
              <div className="h-4 w-48 bg-slate-100 rounded"></div>
              <div className="flex gap-2"><div className="h-6 w-32 bg-slate-100 rounded-md"></div><div className="h-6 w-24 bg-slate-100 rounded-md"></div></div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right space-y-2"><div className="h-3 w-16 bg-slate-100 rounded ml-auto"></div><div className="h-6 w-28 bg-slate-200 rounded-lg"></div></div>
              <div className="flex gap-2"><div className="h-10 w-10 bg-slate-100 rounded-xl"></div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default function Otomasi() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, description: '' });

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recurring_schedules')
        .select(`
          id, amount, type, description, frequency, next_run_date,
          accounts (name, type),
          categories (name)
        `)
        .order('next_run_date', { ascending: true });

      if (error) throw error;
      setSchedules(data || []);
    } catch (err) {
      console.error('Gagal mengambil jadwal otomatis:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const requestDelete = (id, description) => {
    setDeleteModal({ isOpen: true, id, description });
  };

  const executeDelete = async () => {
    const { id } = deleteModal;
    if (!id) return;

    try {
      const { error } = await supabase.from('recurring_schedules').delete().eq('id', id);
      if (error) throw error;

      setSchedules(prev => prev.filter(schedule => schedule.id !== id));
      showActionMessage('success', 'Jadwal otomatis berhasil dihapus.');
    } catch (err) {
      showActionMessage('error', err.message || 'Gagal menghapus jadwal.');
    } finally {
      setDeleteModal({ isOpen: false, id: null, description: '' });
    }
  };

  const showActionMessage = (type, text) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage({ type: '', text: '' }), 4000);
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return <OtomasiSkeleton />;

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <CalendarClock size={28} /> Control Panel Otomasi
        </h1>
        <p className="text-sm text-slate-500 mt-1">Kelola tagihan, langganan, dan pemasukan yang tereksekusi secara otomatis oleh server setiap bulan.</p>
      </div>

      {actionMessage.text && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm font-medium border ${actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {actionMessage.type === 'success' ? <CheckCircle size={18} className="flex-shrink-0" /> : <AlertCircle size={18} className="flex-shrink-0" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Jadwal Eksekusi</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Detail & Akun</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-right">Nominal</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                      <Repeat size={14} className="text-blue-500" />
                      {formatDate(schedule.next_run_date)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 capitalize">Siklus: {schedule.frequency}</div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{schedule.description || schedule.categories?.name || 'Tanpa Deskripsi'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Dompet: {schedule.accounts?.name || 'Akun Terhapus'}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-black tracking-tight ${schedule.type === 'expense' ? 'text-slate-900' : 'text-emerald-600'}`}>
                      {schedule.type === 'expense' ? '-' : '+'}{formatIDR(schedule.amount)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => requestDelete(schedule.id, schedule.description || schedule.categories?.name)} 
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2.5 rounded-xl transition-colors outline-none focus:ring-2 focus:ring-red-200 cursor-pointer"
                      title="Hapus jadwal otomatis"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-400 italic">
                    Belum ada tugas otomatisasi yang dijadwalkan. Tambahkan melalui menu Transaksi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalConfirm
        isOpen={deleteModal.isOpen}
        title="Hapus Jadwal Otomatisasi"
        message={`Anda yakin ingin menghapus jadwal untuk "${deleteModal.description}"? Server akan berhenti mengeksekusi transaksi ini di masa depan.`}
        onConfirm={executeDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: null, description: '' })}
        confirmText="Ya, Hapus"
        danger={true}
      />
    </div>
  );
}