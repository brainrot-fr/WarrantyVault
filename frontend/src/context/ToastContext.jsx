import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { GlassToast } from '../components/ui/GlassToast';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (message, variant = 'success') => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((current) => [...current, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed inset-x-4 top-4 z-[100] mx-auto flex max-w-md flex-col gap-2" aria-live="polite">
        {toasts.map((item) => (
          <GlassToast key={item.id} {...item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context.toast;
}
