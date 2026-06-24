"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X } from "lucide-react";

interface Toast {
  id: number;
  message: string;
  type: "info" | "warning" | "error" | "success";
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type?: Toast["type"]) => void;
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

export const useToast = () => useContext(ToastContext);

let nextId = 1;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const styles: Record<Toast["type"], string> = {
    info: "bg-accent-blue-soft border-accent-blue/20 text-accent-blue",
    warning: "bg-accent-yellow-soft border-accent-yellow/20 text-accent-yellow",
    error: "bg-accent-red-soft border-accent-red/20 text-accent-red",
    success: "bg-accent-green-soft border-accent-green/20 text-accent-green",
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col space-y-2 max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-start justify-between gap-3 px-4 py-3 rounded-lg border text-xs font-medium shadow-lg backdrop-blur-sm animate-in slide-in-from-right ${styles[t.type]}`}
          >
            <span>{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="opacity-70 hover:opacity-100 ml-2 cursor-pointer flex-shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
