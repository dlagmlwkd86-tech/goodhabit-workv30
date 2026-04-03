import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card } from "./components/Common";

const ConfirmCtx = createContext(null);

const TONES = {
  default: {
    icon: "❔",
    titleColor: "#0F172A",
    badgeTone: "slate",
    badgeText: "확인",
    confirmVariant: "primary",
  },
  danger: {
    icon: "🗑️",
    titleColor: "#B91C1C",
    badgeTone: "red",
    badgeText: "주의",
    confirmVariant: "danger",
  },
  warm: {
    icon: "📦",
    titleColor: "#C2410C",
    badgeTone: "amber",
    badgeText: "이동",
    confirmVariant: "warm",
  },
};

export function ConfirmProvider({ children }) {
  const resolverRef = useRef(null);
  const [dialog, setDialog] = useState(null);

  const close = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setDialog(null);
  }, []);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        title: options.title || "계속할까요?",
        message: options.message || "이 작업을 진행할지 확인해 주세요.",
        confirmLabel: options.confirmLabel || "확인",
        cancelLabel: options.cancelLabel || "취소",
        tone: options.tone || "default",
        details: options.details || "",
      });
    });
  }, []);

  useEffect(() => () => {
    if (resolverRef.current) resolverRef.current(false);
  }, []);

  const api = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmCtx.Provider value={api}>
      {children}
      {dialog ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,14,26,0.58)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
            zIndex: 1200,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <ConfirmDialog dialog={dialog} onCancel={() => close(false)} onConfirm={() => close(true)} />
        </div>
      ) : null}
    </ConfirmCtx.Provider>
  );
}

function ConfirmDialog({ dialog, onCancel, onConfirm }) {
  const tone = TONES[dialog.tone] || TONES.default;
  return (
    <Card style={{ width: "100%", maxWidth: 420, padding: 22, borderRadius: 24, animation: "fadeIn .18s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg,#FFF8F3,#FFFFFF)",
            border: "1px solid #FDDCB8",
            fontSize: 22,
            boxShadow: "0 14px 24px rgba(251,146,60,0.12)",
          }}
        >
          {tone.icon}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Badge tone={tone.badgeTone} style={{ marginBottom: 6 }}>{tone.badgeText}</Badge>
          <div style={{ fontSize: 18, fontWeight: 900, color: tone.titleColor, lineHeight: 1.35 }}>{dialog.title}</div>
        </div>
      </div>

      <div style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.7 }}>{dialog.message}</div>
      {dialog.details ? (
        <div style={{ marginTop: 12, fontSize: 12.5, color: "#64748B", lineHeight: 1.65, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14, padding: "11px 12px" }}>
          {dialog.details}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" block onClick={onCancel}>{dialog.cancelLabel}</Button>
        <Button variant={tone.confirmVariant} block onClick={onConfirm}>{dialog.confirmLabel}</Button>
      </div>
    </Card>
  );
}

export function useConfirm() {
  const value = useContext(ConfirmCtx);
  if (!value) throw new Error("useConfirm must be used within ConfirmProvider");
  return value.confirm;
}
