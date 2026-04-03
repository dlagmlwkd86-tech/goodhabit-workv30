import { useState } from "react";
import { copyText } from "../lib/clipboard";
import { palette, surface } from "../lib/styles";
import { useToast } from "../toast";
import { themeOptions, useTheme } from "../theme";

const buttonThemes = {
  primary: {
    background: "var(--primary-gradient)",
    color: "#fff",
    border: "none",
    boxShadow: "var(--primary-shadow)",
  },
  secondary: {
    background: "var(--surface-strong)",
    color: "var(--button-secondary-text)",
    border: `1px solid ${palette.line}`,
    boxShadow: "var(--shadow-sm)",
  },
  dark: {
    background: "linear-gradient(135deg,var(--navy),#334155)",
    color: "#fff",
    border: "none",
    boxShadow: "0 14px 26px rgba(15,23,42,0.18)",
  },
  warm: {
    background: "linear-gradient(135deg,var(--primary-soft),#FFFFFF)",
    color: "var(--primary)",
    border: "1px solid color-mix(in srgb, var(--primary) 20%, white)",
    boxShadow: "0 8px 18px rgba(148,163,184,0.10)",
  },
  danger: {
    background: "linear-gradient(135deg,#FEF2F2,#FFFFFF)",
    color: "#DC2626",
    border: "1px solid #FECACA",
    boxShadow: "0 8px 18px rgba(239,68,68,0.10)",
  },
  ghost: {
    background: "transparent",
    color: "var(--sub)",
    border: `1px solid ${palette.line}`,
    boxShadow: "none",
  },
};

const badgeThemes = {
  slate: { bg: "var(--bg-soft)", bd: "var(--line)", fg: "var(--button-secondary-text)" },
  amber: { bg: "#FFF7ED", bd: "#FED7AA", fg: "#C2410C" },
  orange: { bg: "#FFF7ED", bd: "#FDBA74", fg: "#C2410C" },
  blue: { bg: "#EFF6FF", bd: "#BFDBFE", fg: "#1D4ED8" },
  green: { bg: "#ECFDF5", bd: "#A7F3D0", fg: "#047857" },
  red: { bg: "#FEF2F2", bd: "#FECACA", fg: "#DC2626" },
  violet: { bg: "#F5F3FF", bd: "#DDD6FE", fg: "#6D28D9" },
  dark: { bg: "rgba(255,255,255,0.1)", bd: "rgba(255,255,255,0.08)", fg: "#F8FAFC" },
};

const iconPaths = {
  sparkle: <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3zm6 10l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9L18 13zM6 14l1.1 2.5L10 17.6l-2.9 1.1L6 21l-1.1-2.3L2 17.6l2.9-1.1L6 14z" fill="currentColor" stroke="none"/>,
  bulb: <><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 1 4.8 12.1c-.8.7-1.3 1.6-1.6 2.6h-6.4c-.3-1-.8-1.9-1.6-2.6A7 7 0 0 1 12 2Z"/></>,
  search: <><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  settings: <><path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5z"/><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6z"/></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></>,
  pin: <><path d="M12 21s-6-4.4-6-10a6 6 0 1 1 12 0c0 5.6-6 10-6 10z"/><circle cx="12" cy="11" r="2.5"/></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></>,
  comment: <><path d="M5 18l-2 3v-3.5A7 7 0 0 1 2 7.5A7.5 7.5 0 0 1 9.5 3h5A7.5 7.5 0 0 1 22 10.5v0A7.5 7.5 0 0 1 14.5 18H5z"/></>,
  trash: <><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M8 10v8"/><path d="M12 10v8"/><path d="M16 10v8"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></>,
  edit: <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l4 4"/></>,
  task: <><path d="M9 6h10"/><path d="M9 12h10"/><path d="M9 18h10"/><path d="M5 6h.01"/><path d="M5 12h.01"/><path d="M5 18h.01"/></>,
  robot: <><rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 4v4"/><path d="M8.5 12h.01"/><path d="M15.5 12h.01"/><path d="M9 16h6"/></>,
  chart: <><path d="M5 19V9"/><path d="M12 19V5"/><path d="M19 19v-7"/></>,
  megaphone: <><path d="M3 11v2a2 2 0 0 0 2 2h2l3 4h2l-1-4h1l7-3V8l-7-3H5a2 2 0 0 0-2 2v4z"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3.5"/><path d="M21 21v-2a4 4 0 0 0-3-3.9"/><path d="M15.5 3.2a3.5 3.5 0 0 1 0 6.6"/></>,
  coach: <><path d="M6 11h12"/><path d="M9 8v6"/><path d="M15 8v6"/><path d="M4 8h2v6H4z"/><path d="M18 8h2v6h-2z"/><path d="M8 18l-2 3"/><path d="M16 18l2 3"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/></>,
  repeat: <><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></>,
  check: <path d="M5 12l4 4L19 6"/>,
  alert: <><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.7L1.8 18.3A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.8-2.7L13.7 3.7a2 2 0 0 0-3.4 0z"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18"/><path d="M12 3a15 15 0 0 0 0 18"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/></>,
  download: <><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
  printer: <><path d="M7 8V4h10v4"/><rect x="5" y="13" width="14" height="8" rx="2"/><path d="M7 17h10"/><path d="M6 13H4a2 2 0 0 1-2-2v-1a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v1a2 2 0 0 1-2 2h-2"/></>,
  close: <><path d="M6 6l12 12"/><path d="M18 6L6 18"/></>,
};

export function Icon({ name = "sparkle", size = 18, stroke = 2, style, filled = false }) {
  const path = iconPaths[name] || iconPaths.sparkle;
  return (
    <span className="icon-stroke" style={style} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        {path}
      </svg>
    </span>
  );
}

export function ThemeSwitcher({ compact = false }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-toggle" style={{ width: compact ? "auto" : "100%", justifyContent: compact ? "flex-end" : "space-between" }}>
      {themeOptions.map((item) => (
        <button key={item.id} type="button" onClick={() => setTheme(item.id)} className={`theme-option ${theme === item.id ? "is-active" : ""}`.trim()}>
          <span className="theme-swatch" style={{ background: item.chip }} />
          {!compact && <span>{item.label}</span>}
        </button>
      ))}
    </div>
  );
}

export function Card({ children, style, className = "", tone = "default" }) {
  const toneStyle = tone === "dark"
    ? { background: "linear-gradient(135deg,var(--navy) 0%,#1E293B 40%,#334155 100%)", borderColor: "rgba(255,255,255,0.08)", color: "#fff" }
    : tone === "warm"
      ? { background: "linear-gradient(135deg,var(--primary-soft),#FFFFFF)", borderColor: "color-mix(in srgb, var(--primary) 20%, white)" }
      : {};
  return <div className={`glass-card ${className}`.trim()} style={{ ...surface, ...toneStyle, ...style }}>{children}</div>;
}

export function Button({ children, variant = "primary", block = false, style, icon, title, label, ...props }) {
  const theme = buttonThemes[variant] || buttonThemes.secondary;
  return (
    <button
      {...props}
      title={title || label}
      style={{
        padding: "11px 14px",
        borderRadius: 14,
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        width: block ? "100%" : undefined,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: props.disabled ? 0.6 : 1,
        ...theme,
        ...style,
      }}
    >
      {icon ? (typeof icon === "string" ? <Icon name={icon} size={14} /> : icon) : null}
      {children}
    </button>
  );
}

export function Badge({ children, tone = "slate", style, icon }) {
  const theme = badgeThemes[tone] || badgeThemes.slate;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 999, background: theme.bg, color: theme.fg, border: `1px solid ${theme.bd}`, fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap", ...style }}>
      {icon ? (typeof icon === "string" ? <Icon name={icon} size={13} /> : icon) : null}
      {children}
    </span>
  );
}

export function ErrorBanner({ message, onDismiss, tone = "error" }) {
  if (!message) return null;
  const themes = {
    error: { bg: "linear-gradient(135deg,#FEF2F2,#FFFFFF)", bd: "#FECACA", fg: "#B91C1C", icon: "alert" },
    info: { bg: "linear-gradient(135deg,#EFF6FF,#FFFFFF)", bd: "#BFDBFE", fg: "#1D4ED8", icon: "sparkle" },
  };
  const current = themes[tone] || themes.error;
  return (
    <div className="banner" style={{ background: current.bg, borderColor: current.bd }}>
      <div style={{ fontSize: 15, lineHeight: 1.2, color: current.fg }}><Icon name={current.icon} size={16} /></div>
      <div style={{ flex: 1, fontSize: 12.5, color: current.fg, lineHeight: 1.55, fontWeight: 700 }}>{message}</div>
      {onDismiss ? <button onClick={onDismiss} style={{ border: "none", background: "transparent", color: "#94A3B8", cursor: "pointer", padding: 0, fontSize: 16, lineHeight: 1 }}><Icon name="close" size={15} /></button> : null}
    </div>
  );
}

export function EmptyState({ icon = "sparkle", title = "아직 비어 있어요", message, action, compact = false, tone = "slate", style }) {
  const tones = {
    slate: { bg: "linear-gradient(135deg,var(--bg-soft),#FFFFFF)", bd: "var(--line)", chipBg: "#FFFFFF", chipFg: "var(--button-secondary-text)", title: "var(--text)", text: "var(--sub)" },
    amber: { bg: "linear-gradient(135deg,#FFF8F3,#FFFFFF)", bd: "#FDDCB8", chipBg: "#FFF7ED", chipFg: "#C2410C", title: "#7C2D12", text: "#9A3412" },
    blue: { bg: "linear-gradient(135deg,#EFF6FF,#FFFFFF)", bd: "#BFDBFE", chipBg: "#FFFFFF", chipFg: "#1D4ED8", title: "#1E3A8A", text: "#1D4ED8" },
    green: { bg: "linear-gradient(135deg,#ECFDF5,#FFFFFF)", bd: "#A7F3D0", chipBg: "#FFFFFF", chipFg: "#047857", title: "#065F46", text: "#047857" },
    red: { bg: "linear-gradient(135deg,#FEF2F2,#FFFFFF)", bd: "#FECACA", chipBg: "#FFFFFF", chipFg: "#DC2626", title: "#991B1B", text: "#B91C1C" },
  };
  const current = tones[tone] || tones.slate;
  return (
    <div className={`empty-state ${compact ? "empty-state-compact" : ""}`.trim()} style={{ background: current.bg, borderColor: current.bd, ...style }}>
      <div className="empty-state-orb" style={{ background: current.chipBg, color: current.chipFg }}><Icon name={icon} size={compact ? 20 : 24} /></div>
      <div style={{ fontSize: compact ? 14 : 16, fontWeight: 900, color: current.title }}>{title}</div>
      {message ? <div style={{ marginTop: 6, fontSize: compact ? 11.5 : 12.5, color: current.text, lineHeight: 1.65, maxWidth: compact ? 280 : 360 }}>{message}</div> : null}
      {action ? <div style={{ marginTop: compact ? 12 : 14 }}>{action}</div> : null}
    </div>
  );
}


export function StatCard({ icon = "chart", label, value, sub, tone = "slate", progress = null }) {
  const tones = {
    slate: { shell: "linear-gradient(135deg,rgba(255,255,255,.18),rgba(255,255,255,.1))", icon: "rgba(255,255,255,.16)", value: "#FFFFFF", sub: "#CBD5E1" },
    blue: { shell: "linear-gradient(135deg,rgba(59,130,246,.22),rgba(255,255,255,.1))", icon: "rgba(255,255,255,.18)", value: "#FFFFFF", sub: "#DBEAFE" },
    red: { shell: "linear-gradient(135deg,rgba(239,68,68,.22),rgba(255,255,255,.1))", icon: "rgba(255,255,255,.18)", value: "#FFFFFF", sub: "#FECACA" },
    green: { shell: "linear-gradient(135deg,rgba(16,185,129,.22),rgba(255,255,255,.1))", icon: "rgba(255,255,255,.18)", value: "#FFFFFF", sub: "#BBF7D0" },
    amber: { shell: "linear-gradient(135deg,rgba(245,158,11,.22),rgba(255,255,255,.1))", icon: "rgba(255,255,255,.18)", value: "#FFFFFF", sub: "#FDE68A" },
  };
  const current = tones[tone] || tones.slate;
  return (
    <div className="stat-card" style={{ background: current.shell }}>
      <div className="stat-icon-wrap" style={{ background: current.icon }}><Icon name={icon} size={15} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub ? <div className="stat-sub" style={{ color: current.sub }}>{sub}</div> : null}
      </div>
      {typeof progress === 'number' ? (
        <div className="stat-progress-rail">
          <div className="stat-progress-fill" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export function ModalSheet({ children, onClose, maxWidth = 540, align = "end", padding = "24px 20px 30px" }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,14,26,0.56)", backdropFilter: "blur(6px)", display: "flex", alignItems: align === "center" ? "center" : "flex-end", justifyContent: "center", zIndex: 999 }} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <Card style={{ width: "100%", maxWidth, maxHeight: align === "center" ? "90vh" : "88vh", overflowY: "auto", borderRadius: align === "center" ? 24 : "28px 28px 0 0", padding, animation: "slideUp .3s ease" }}>
        <div style={{ width: 42, height: 5, borderRadius: 999, background: "var(--line)", margin: "0 auto 20px" }} />
        {children}
      </Card>
    </div>
  );
}

export function ActBtn({ onClick, active, icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "11px 0",
        border: "none",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 800,
        fontFamily: "inherit",
        background: active ? "linear-gradient(135deg,var(--primary-soft),#FFFFFF)" : "transparent",
        color: active ? "var(--primary)" : "var(--sub)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        position: "relative",
      }}
    >
      {typeof icon === "string" ? <Icon name={icon} size={14} /> : icon} {label}
      {badge > 0 && (
        <span
          style={{
            position: "absolute",
            top: 4,
            right: "18%",
            background: "linear-gradient(135deg,#EF4444,#F87171)",
            color: "#fff",
            fontSize: 9.5,
            fontWeight: 800,
            borderRadius: 999,
            padding: "1px 6px",
            boxShadow: "0 6px 14px rgba(239,68,68,0.25)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export function Pill({ active, onClick, color, children, icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 14px",
        borderRadius: 999,
        border: active ? "none" : "1px solid var(--line)",
        cursor: "pointer",
        fontSize: 11.5,
        fontWeight: 800,
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        background: active ? `linear-gradient(135deg,${color},${color}D9)` : "rgba(255,255,255,0.82)",
        color: active ? "#fff" : "var(--button-secondary-text)",
        boxShadow: active ? "0 10px 22px rgba(15,23,42,0.10)" : "0 4px 12px rgba(148,163,184,0.08)",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </button>
  );
}

export function CopyButton({ text, tone = "amber", label = "복사", copiedLabel = "복사됨", title }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const styles = {
    amber: { bg: "#FFF7ED", bd: "#FDBA74", fg: "#C2410C" },
    blue: { bg: "#EFF6FF", bd: "#93C5FD", fg: "#1D4ED8" },
    green: { bg: "#ECFDF5", bd: "#6EE7B7", fg: "#047857" },
    slate: { bg: "var(--bg-soft)", bd: "#CBD5E1", fg: "var(--button-secondary-text)" },
  }[tone] || { bg: "var(--bg-soft)", bd: "#CBD5E1", fg: "var(--button-secondary-text)" };

  return (
    <button
      onClick={async () => {
        const ok = await copyText(text);
        if (!ok) {
          toast.error("복사에 실패했어요. 다시 시도해 주세요.", { title: "복사 실패" });
          return;
        }
        setCopied(true);
        toast.success("클립보드에 복사했어요.", { title: "복사 완료", duration: 1600 });
        setTimeout(() => setCopied(false), 1200);
      }}
      style={{
        padding: "7px 11px",
        borderRadius: 10,
        border: `1px solid ${styles.bd}`,
        background: copied ? styles.fg : styles.bg,
        color: copied ? "#fff" : styles.fg,
        fontSize: 11.5,
        fontWeight: 800,
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: copied ? "0 10px 20px rgba(15,23,42,0.14)" : "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Icon name={copied ? "check" : "task"} size={13} />
      {copied ? copiedLabel : label}
    </button>
  );
}
