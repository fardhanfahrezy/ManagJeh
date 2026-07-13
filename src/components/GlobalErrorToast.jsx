// src/components/GlobalErrorToast.jsx:
import { useState, useEffect, useRef } from 'react';
import { AlertCircle, X, CheckCircle } from 'lucide-react';

export default function GlobalErrorToast() {
    const [toast, setToast] = useState({ isOpen: false, message: '', type: 'error' });
    const timerRef = useRef(null);

    useEffect(() => {
        const handleGlobalToast = (event) => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }

            setToast({ isOpen: true, message: event.detail.message, type: event.detail.type });
            
            timerRef.current = setTimeout(() => {
                setToast((prev) => ({ ...prev, isOpen: false }));
            }, 5000);
        };

        window.addEventListener('app-toast', handleGlobalToast);
        return () => window.removeEventListener('app-toast', handleGlobalToast);
    }, []);

    if (!toast.isOpen) return null;

    return (
        <div 
            role="alert" 
            aria-live="assertive" 
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300"
        >
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border ${
                toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
                {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                <p className="text-sm font-bold tracking-tight max-w-[300px] md:max-w-md truncate whitespace-normal">
                    {toast.message}
                </p>
                <button 
                    onClick={() => {
                        if (timerRef.current) clearTimeout(timerRef.current);
                        setToast({ ...toast, isOpen: false });
                    }}
                    aria-label="Tutup Notifikasi"
                    className="ml-2 p-1 opacity-50 hover:opacity-100 transition-opacity outline-none"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}