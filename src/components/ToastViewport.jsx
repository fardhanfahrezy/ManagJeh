// src/components/ToastViewport.jsx
import { useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { X } from 'lucide-react'; // Pastikan lucide-react terpasang

const ToastItem = ({ toast, removeToast }) => {
  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast, removeToast]);

  const variants = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-white border-slate-200 text-slate-800"
  };

  const isCritical = toast.type === 'error';

  return (
    <div 
      className={`flex items-center gap-3 p-4 rounded-xl shadow-2xl border ${variants[toast.type] || variants.info}`}
      role={isCritical ? "alert" : "status"}
      aria-live={isCritical ? "assertive" : "polite"}
    >
      <span className="text-sm font-bold">{toast.message}</span>
      <button onClick={() => removeToast(toast.id)} className="p-1 hover:bg-black/5 rounded-md">
        <X size={16} />
      </button>
    </div>
  );
};

export const ToastViewport = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>
  );
};