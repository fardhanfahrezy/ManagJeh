import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ToggleLeft, ToggleRight, Calendar, AlertCircle, Trash2 } from 'lucide-react';

export default function Langganan() {
  const { user } = useAuth();
  
  // State Data
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State UI Feedback
  const [error, setError] = useState('');

  // Mengambil data jadwal transaksi berulang beserta relasi nama kategori dan nama akun
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: dbError } = await supabase
        .from('recurring_schedules')
        .select(`
          id, amount, type, description, frequency, next_run_date, is_active,
          categories (name, color_code),
          accounts (name)
        `)
        .order('next_run_date', { ascending: true });

      if (dbError) throw dbError;
      setSchedules(data || []);
    } catch (err) {
      setError('Gagal mengambil data jadwal otomatisasi: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Mengubah status aktif/nonaktif jadwal (Soft State Toggle)
  const toggleScheduleStatus = async (id, currentStatus) => {
    try {
      const { error: updateError } = await supabase
        .from('recurring_schedules')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (updateError) throw updateError;

      // Mutasi state lokal secara efisien tanpa fetch ulang ke server
      setSchedules(prev => prev.map(sched => 
        sched.id === id ? { ...sched, is_active: !currentStatus } : sched
      ));
    } catch (err) {
      alert('Gagal mengubah status otomatisasi: ' + err.message);
    }
  };

  // Menghapus jadwal otomatisasi secara permanen jika diperlukan
  const deleteSchedule = async (id) => {
    if (!window.confirm('Hapus jadwal otomatisasi ini secara permanen? Langkah ini tidak akan menghapus transaksi yang sudah tercatat sebelumnya.')) return;
    
    try {
      const { error: deleteError } = await supabase
        .from('recurring_schedules')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setSchedules(prev => prev.filter(sched => sched.id !== id));
    } catch (err) {
      alert('Gagal menghapus jadwal: ' + err.message);
    }
  };

  // Utilitas Pemformatan data visual
  const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  
  const calculateDaysLeft = (dateString) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const targetDate = new Date(dateString);
    targetDate.setHours(0,0,0,0);
    
    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hari ini';
    if (diffDays < 0) return 'Melewati jatuh tempo';
    return `${diffDays} hari lagi`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manajemen Otomasi & Langganan</h1>
        <p className="text-slate-500 text-sm mt-1">Kelola tagihan berulang dan alur pemasukan otomatis Anda.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-center gap-3 text-sm font-medium">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12 text-slate-900">
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Belum ada jadwal transaksi otomatis atau langganan yang terdaftar.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {schedules.map((sched) => {
              const daysLeftStr = calculateDaysLeft(sched.next_run_date);
              
              return (
                <div key={sched.id} className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${sched.is_active ? 'bg-white' : 'bg-slate-50/50'}`}>
                  
                  {/* Bagian Informasi Detil Jadwal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sched.categories?.color_code || '#ccc' }} />
                      <h3 className={`font-semibold truncate text-base ${sched.is_active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                        {sched.categories?.name || 'Kategori Terhapus'}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 font-medium rounded-full ${sched.type === 'income' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                        {sched.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-500 truncate mb-2">
                      {sched.description || 'Tanpa catatan khusus'}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        Jatuh tempo: {new Date(sched.next_run_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      {sched.is_active && (
                        <span className={`font-bold ${daysLeftStr.includes('Hari') || daysLeftStr.includes('Melewati') ? 'text-amber-600' : 'text-slate-500'}`}>
                          ({daysLeftStr})
                        </span>
                      )}
                      
                      {/* TAMPILAN SUMBER DOMPET / AKUN */}
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-slate-200">
                        {sched.type === 'income' ? 'Kredit ke:' : 'Debet via:'} {sched.accounts?.name || 'Akun Utama'}
                      </span>
                    </div>
                  </div>

                  {/* Bagian Finansial & Kontrol Aksi */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Nominal</p>
                      <p className={`text-base font-bold mt-0.5 ${!sched.is_active ? 'text-slate-400 line-through' : sched.type === 'income' ? 'text-blue-600' : 'text-slate-900'}`}>
                        {formatRupiah(sched.amount)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Tombol Toggle Status Otomatisasi */}
                      <button
                        onClick={() => toggleScheduleStatus(sched.id, sched.is_active)}
                        className={`p-1 rounded-lg transition-colors outline-none focus:ring-2 focus:ring-slate-200 ${sched.is_active ? 'text-slate-900 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-100'}`}
                        title={sched.is_active ? "Nonaktifkan otomatisasi" : "Aktifkan otomatisasi"}
                        aria-label="Toggle status jadwal"
                      >
                        {sched.is_active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                      </button>

                      {/* Tombol Hapus Jadwal Permanen */}
                      <button
                        onClick={() => deleteSchedule(sched.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all outline-none focus:ring-2 focus:ring-red-200"
                        title="Hapus jadwal"
                        aria-label="Hapus jadwal berulang secara permanen"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}