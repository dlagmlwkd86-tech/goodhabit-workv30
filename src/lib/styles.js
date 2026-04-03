export const palette = {
  bg: "var(--bg)",
  bgSoft: "var(--bg-soft)",
  text: "var(--text)",
  sub: "var(--sub)",
  line: "var(--line)",
  primary: "var(--primary)",
  primary2: "var(--primary-2)",
  primarySoft: "var(--primary-soft)",
  navy: "var(--navy)",
  navySoft: "var(--navy-soft)",
  success: "var(--success)",
  danger: "var(--danger)",
  warning: "var(--warning)",
};

export const surface = {
  background: "var(--surface)",
  border: `1px solid ${palette.line}`,
  boxShadow: "var(--shadow-lg)",
  backdropFilter: "blur(14px)",
  borderRadius: 20,
};

export const lbl = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: palette.sub,
  marginBottom: 6,
  marginTop: 14,
};

export const inp = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: `1.5px solid ${palette.line}`,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
  background: "var(--input-bg)",
  color: palette.text,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
};

export const btnS = {
  padding: "11px 14px",
  borderRadius: 14,
  border: `1px solid ${palette.line}`,
  background: "var(--surface-strong)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  color: "var(--button-secondary-text)",
  flex: 1,
  boxShadow: "var(--shadow-sm)",
};

export const btnP = {
  padding: "11px 14px",
  borderRadius: 14,
  border: "none",
  background: "var(--primary-gradient)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  fontFamily: "inherit",
  flex: 1,
  boxShadow: "var(--primary-shadow)",
};

export const btnD = {
  width: "100%",
  padding: 13,
  borderRadius: 16,
  border: "1.5px dashed var(--line)",
  background: "var(--surface-muted)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  color: palette.sub,
  fontFamily: "inherit",
  marginTop: 4,
};
