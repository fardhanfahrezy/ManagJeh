// src/pages/Auth.jsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Loader2, Eye, EyeOff, ChevronLeft } from 'lucide-react';

export default function Auth() {
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  // PERBAIKAN 1: State untuk Validasi Syarat & Ketentuan
  const [agreeTerms, setAgreeTerms] = useState(false); 
  
  const [message, setMessage] = useState({ type: '', text: '' });

  const resetFormState = () => {
    setPassword('');
    setUsername('');
    setAgreeTerms(false);
    setMessage({ type: '', text: '' });
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;

      } else if (authMode === 'register') {
        // Keamanan Tambahan: Validasi persetujuan
        if (!agreeTerms) throw new Error('Anda harus menyetujui Syarat dan Ketentuan.');

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: username.trim() } },
        });
        
        if (error) throw error;
        if (data?.user?.identities?.length === 0) {
          throw new Error('Email sudah terdaftar dalam sistem.');
        }

        setMessage({ type: 'success', text: 'Registrasi berhasil. Periksa email Anda untuk verifikasi.' });
        setAuthMode('login');
        resetFormState();

      } else if (authMode === 'forgot') {
        // PERBAIKAN 2: Implementasi Lupa Kata Sandi
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/update-password`,
        });
        if (error) throw error;

        setMessage({ type: 'success', text: 'Instruksi pemulihan telah dikirim ke email Anda.' });
        setAuthMode('login');
        resetFormState();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) throw error;
    } catch (error) {
      setMessage({ type: 'error', text: `Fitur ${provider} belum dikonfigurasi. Hubungi administrator.` });
    }
  };

  // Kalkulasi status tombol submit agar lebih rapi
  const isSubmitDisabled = () => {
    if (loading) return true;
    if (!email) return true;
    if (authMode !== 'forgot' && !password) return true;
    if (authMode === 'register' && (!username || !agreeTerms)) return true;
    return false;
  };

  return (
    <main className="min-h-screen bg-[#F3F5F9] flex flex-col items-center justify-center p-4 sm:p-8 font-sans selection:bg-blue-200">
      
      <div className="w-full max-w-md sm:max-w-sm relative flex flex-col">
        
        <div className="flex items-center justify-center w-full mb-8 relative">
          {authMode !== 'login' && (
            <button 
              onClick={() => { setAuthMode('login'); resetFormState(); }}
              className="absolute left-0 p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 transition-colors outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Kembali ke Login"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
          )}
          <h1 className="text-2xl font-bold text-blue-600 tracking-tight">ManagJeh</h1>
        </div>

        <div className="bg-white rounded-[2.5rem] sm:rounded-3xl shadow-xl shadow-blue-900/5 px-6 py-10 sm:p-8">
          
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8 px-2 leading-tight">
            {authMode === 'login' && 'Welcome to ManagJeh login now!'}
            {authMode === 'register' && 'Create an Account?'}
            {authMode === 'forgot' && 'Reset your password'}
          </h2>

          {message.text && (
            <div className={`p-4 rounded-2xl text-sm font-medium mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            {authMode === 'register' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-900 pl-1">Name</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#F3F5F9] text-gray-900 rounded-full px-5 py-3.5 sm:py-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium placeholder-gray-400"
                  placeholder="Johan orindo"
                  disabled={loading}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-900 pl-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F3F5F9] text-gray-900 rounded-full px-5 py-3.5 sm:py-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium placeholder-gray-400"
                placeholder="joedoe75@gmail.com"
                disabled={loading}
              />
            </div>

            {authMode !== 'forgot' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-900 pl-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#F3F5F9] text-gray-900 rounded-full px-5 py-3.5 sm:py-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium placeholder-gray-400"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 outline-none"
                    tabIndex="-1"
                  >
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>
            )}

            {/* PERBAIKAN 3: Tata Letak Sub-aksi yang Logis */}
            <div className={`flex px-1 ${authMode === 'login' ? 'justify-end' : 'justify-start'}`}>
              
              {authMode === 'register' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                  />
                  <span className="text-sm font-medium text-gray-500">I agree to the Terms of Service</span>
                </label>
              )}
              
              {authMode === 'login' && (
                <button 
                  type="button" 
                  onClick={() => { setAuthMode('forgot'); resetFormState(); }}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 outline-none"
                >
                  Forgot password?
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitDisabled()}
              className="w-full bg-[#2F73F6] hover:bg-blue-700 text-white font-bold py-4 sm:py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 outline-none focus:ring-4 focus:ring-blue-300"
            >
              {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (
                authMode === 'login' ? 'Login' : authMode === 'register' ? 'Create account' : 'Reset Password'
              )}
            </button>
          </form>

          {/* Social Auth */}
          {authMode !== 'forgot' && (
            <div className="mt-8 flex flex-col items-center">
              <span className="text-sm font-medium text-gray-400 bg-white px-2 mb-6">Or Sign in with</span>
              <div className="flex justify-center gap-4 w-full">
                <button onClick={() => handleSocialLogin('facebook')} className="sm:p-2 bg-[#F3F5F9] rounded-2xl hover:bg-gray-200 transition-colors flex-1 flex justify-center outline-none focus:ring-2 focus:ring-blue-500">
                  <svg className="w-6 h-6 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg>
                </button>
                <button onClick={() => handleSocialLogin('google')} className="sm:p-2 bg-[#F3F5F9] rounded-2xl hover:bg-gray-200 transition-colors flex-1 flex justify-center outline-none focus:ring-2 focus:ring-blue-500">
                  <svg className="w-6 h-6" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                </button>
                <button onClick={() => handleSocialLogin('apple')} className="sm:p-2 bg-[#F3F5F9] rounded-2xl hover:bg-gray-200 transition-colors flex-1 flex justify-center outline-none focus:ring-2 focus:ring-blue-500">
                  <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.15 2.95.82 3.79 2.05-3.28 1.95-2.73 6.46.52 7.72-.73 1.83-1.57 3.25-2.96 4.69l.06-.06zM12.03 7.25c-.15-2.99 2.45-5.32 5.41-5.25.17 3.07-2.72 5.51-5.41 5.25z" /></svg>
                </button>
              </div>
            </div>
          )}

        </div>

        <div className="mt-6 text-center">
           {authMode === 'login' ? (
              <p className="text-sm text-gray-600 font-medium">
                Don't have an account? <button onClick={() => { setAuthMode('register'); resetFormState(); }} className="text-blue-600 font-bold hover:underline outline-none">Register here</button>
              </p>
           ) : (
              <p className="text-sm text-gray-600 font-medium">
                <Link to="/" className="text-gray-500 hover:text-gray-800 transition-colors font-semibold outline-none flex items-center justify-center gap-1">
                  <ChevronLeft size={16} /> Kembali ke Beranda
                </Link>
              </p>
           )}
        </div>

      </div>
    </main>
  );
}