// src/contexts/ToastContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';

const MAX_TOASTS = 5;

const ToastContext = createContext({});

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = crypto.randomUUID(); // Standar modern browser
    setToasts((prev) => {
      const next = [...prev, { id, message, type, duration }];
      return next.slice(-MAX_TOASTS); // FIFO Queue dengan limit
    });
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);