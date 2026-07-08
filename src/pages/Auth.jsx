import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, Mail, Lock, Loader2, ArrowRight, User, KeyRound } from 'lucide-react';

export default function Auth() {
  // Manajemen State Otentikasi: 'login', 'register', 'forgot'
  const [authMode, setAuthMode] = useState('login'); 
  const [loading, setLoading] = useState(false);
  
  // State Formulir
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  
  // State Umpan Balik
  const [message, setMessage] = useState({ type: '', text: '' });

  const resetFormState = () => {
    setPassword('');
    setUsername('');
    setMessage({ type: '', text: '' });
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (authMode === 'login') {
        // --- ALUR LOGIN ---
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        
        if (error) {
          if (error.message.includes('Email not confirmed')) {
            throw new Error('Akses ditolak: Email Anda belum diverifikasi. Silakan periksa kotak masuk Anda.');
          }
          throw error;
        }

      } else if (authMode === 'register') {
        // --- ALUR REGISTRASI ---
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              username: username.trim(),
            }
          }
        });
        
        if (error) throw error;
        
        // INTERSEPSI KEAMANAN: Memblokir pendaftaran duplikat saat Confirm Email ON
        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error('Entitas email sudah terdaftar dalam sistem.');
        }

        setMessage({ 
          type: 'success', 
          text: 'Registrasi tercatat. Tautan verifikasi telah dikirim ke email Anda. Anda wajib memverifikasi email sebelum dapat masuk.' 
        });
        
        setAuthMode('login');
        resetFormState();

      } else if (authMode === 'forgot') {
        // --- ALUR LUPA KATA SANDI ---
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/update-password`,
        });

        if (error) throw error;

        setMessage({ 
          type: 'success', 
          text: 'Instruksi pemulihan kata sandi telah dikirim ke email Anda.' 
        });
        setAuthMode('login');
        resetFormState();
      }
    } catch (error) {
      let errorMsg = error.message;
      
      // Sanitasi & Pemetaan Error
      if (errorMsg.includes('Invalid login credentials')) {
        errorMsg = 'Kredensial tidak valid. Periksa kembali email dan kata sandi Anda.';
      } else if (errorMsg.includes('User already registered')) {
        errorMsg = 'Entitas email sudah terdaftar dalam sistem.';
      } else if (errorMsg.includes('Password should be at least')) {
        errorMsg = 'Standar keamanan: Kata sandi minimal 6 karakter.';
      } else if (errorMsg.includes('rate limit')) {
        errorMsg = 'Terlalu banyak permintaan. Server memblokir akses sementara waktu.';
      }
      
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // Render Engine Pembantu
  const renderHeader = () => {
    switch (authMode) {
      case 'login': return { title: 'Otentikasi Sistem', subtitle: 'Masukkan kredensial akses Anda.' };
      case 'register': return { title: 'Inisialisasi Akun', subtitle: 'Registrasi entitas baru ke dalam sistem.' };
      case 'forgot': return { title: 'Pemulihan Akses', subtitle: 'Masukkan email untuk mereset kata sandi.' };
      default: return { title: '', subtitle: '' };
    }
  };

  const headerText = renderHeader();

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-blue-100">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 sm:p-10 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 rotate-3">
            <Sparkles className="text-white" size={32} />
          </div>
        </div>

        <h1 className="text-2xl font-black text-slate-900 text-center tracking-tight mb-2">
          {headerText.title}
        </h1>
        <p className="text-center text-sm text-slate-500 mb-8 font-medium">
          {headerText.subtitle}
        </p>

        {/* Aksesibilitas: Pengumuman pembaca layar (ARIA Live) untuk error/sukses */}
        {message.text && (
          <div 
            aria-live="polite"
            className={`p-4 rounded-2xl text-sm font-bold mb-6 border ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-red-50 text-red-800 border-red-100'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          
          {/* Kolom Username (Hanya muncul saat Register) */}
          {authMode === 'register' && (
            <div>
              <label htmlFor="username" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium text-slate-900"
                  placeholder="johndoe"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
              Alamat Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium text-slate-900"
                placeholder="nama@email.com"
                disabled={loading}
              />
            </div>
          </div>

          {/* Kolom Password (Disembunyikan saat Forgot Password) */}
          {authMode !== 'forgot' && (
            <div>
              <div className="flex justify-between items-center mb-2 ml-1 pr-1">
                <label htmlFor="password" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Kata Sandi
                </label>
                {authMode === 'login' && (
                  <button 
                    type="button" 
                    onClick={() => { setAuthMode('forgot'); resetFormState(); }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors outline-none"
                  >
                    Lupa sandi?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium text-slate-900"
                  placeholder="Minimal 6 karakter"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || (authMode !== 'forgot' && !password) || (authMode === 'register' && !username)}
            className="w-full group bg-slate-900 text-white font-bold py-3.5 rounded-2xl hover:bg-slate-800 focus:ring-4 focus:ring-slate-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 outline-none"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {authMode === 'login' && 'Otorisasi Masuk'}
                {authMode === 'register' && 'Daftar Entitas Baru'}
                {authMode === 'forgot' && 'Kirim Tautan Pemulihan'}
                {authMode === 'forgot' ? <KeyRound size={18} className="group-hover:rotate-12 transition-transform" /> : <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center flex flex-col gap-3">
          {authMode !== 'register' && (
            <button
              type="button"
              onClick={() => { setAuthMode('register'); resetFormState(); }}
              className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors outline-none"
            >
              Inisialisasi akun baru di sini.
            </button>
          )}
          {authMode !== 'login' && (
            <button
              type="button"
              onClick={() => { setAuthMode('login'); resetFormState(); }}
              className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors outline-none"
            >
              Sudah terdaftar? Otorisasi di sini.
            </button>
          )}
        </div>

      </div>
    </main>
  );
}