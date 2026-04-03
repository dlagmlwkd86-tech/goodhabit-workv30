import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastCtx = createContext(null);

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const TONES = {
  success: { accent: "#10B981", bg: "linear-gradient(135deg,#ECFDF5,#FFFFFF)", border: "#A7F3D0", icon: "✅" },
  error: { accent: "#EF4444", bg: "linear-gradient(135deg,#FEF2F2,#FFFFFF)", border: "#FECACA", icon: "⚠️" },
  info: { accent: "#2563EB", bg: "linear-gradient(135deg,#EFF6FF,#FFFFFF)", border: "#BFDBFE", icon: "ℹ️" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((input) => {
    const next = typeof input === "string" ? { message: input } : input || {};
    const id = makeId();
    const toast = {
      id,
      tone: next.tone || "info",
      title: next.title || "알림",
      message: next.message || "완료되었습니다.",
      duration: Number.isFinite(next.duration) ? next.duration : 2600,
    };
    setToasts((prev) => [...prev.slice(-2), toast]);
    const timer = setTimeout(() => dismiss(id), toast.duration);
    timersRef.current.set(id, timer);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    show: push,
    dismiss,
    success: (message, options = {}) => push({ ...options, tone: "success", title: options.title || "완료", message }),
    error: (message, options = {}) => push({ ...options, tone: "error", title: options.title || "문제가 있어요", message }),
    info: (message, options = {}) => push({ ...options, tone: "info", title: options.title || "안내", message }),
  }), [dismiss, push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          const tone = TONES[toast.tone] || TONES.info;
          return (
            <div key={toast.id} className="toast-card" style={{ background: tone.bg, borderColor: tone.border }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ fontSize: 16, lineHeight: 1.2 }}>{tone.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: tone.accent }}>{toast.title}</div>
                  <div style={{ fontSize: 12.5, color: "#334155", marginTop: 4, lineHeight: 1.5 }}>{toast.message}</div>
                </div>
                <button onClick={() => dismiss(toast.id)} style={{ border: "none", background: "transparent", color: "#94A3B8", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastCtx);
  if (!value) throw new Error("useToast must be used within ToastProvider");
  return value;
}
