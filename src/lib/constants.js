export const CATS = {
  member: { label: "회원관리", icon: "👥", color: "#2563EB", bg: "#EFF6FF" },
  coach: { label: "코치관리", icon: "🏋️", color: "#059669", bg: "#ECFDF5" },
  marketing: { label: "마케팅", icon: "📣", color: "#D97706", bg: "#FFFBEB" },
  operation: { label: "운영", icon: "⚙️", color: "#7C3AED", bg: "#F5F3FF" },
};

export const PRI = {
  high: { label: "긴급", color: "#fff", bg: "#DC2626" },
  mid: { label: "보통", color: "#92400E", bg: "#FDE68A" },
  low: { label: "낮음", color: "#6B7280", bg: "#F3F4F6" },
};

export const RECUR_L = { none: "없음", weekly: "매주", biweekly: "격주", monthly: "매월" };
export const BR_COLORS = ["#FF6B35", "#2563EB", "#059669", "#7C3AED", "#DC2626", "#D97706", "#0891B2", "#BE185D"];
export const EMOJIS = ["🏋️", "💪", "🔥", "⚡", "🎯", "💫", "🏃", "🥊", "🧘", "⭐", "❤️"];

export const TEMPLATE_PRESETS = [
  { id: "open", icon: "🌅", title: "오픈 루틴", cat: "operation", pri: "high", recur: "none", dueOffset: 0, memo: "출근 직후 10~15분 안에 끝내는 오픈 체크리스트", subs: ["조명·환기 상태 확인", "수업 공간·소도구 정리", "예약/변경 사항 확인", "당일 신규·상담 회원 체크", "공용 공간 사진 1장 공유"] },
  { id: "close", icon: "🌙", title: "마감 루틴", cat: "operation", pri: "mid", recur: "none", dueOffset: 0, memo: "퇴근 전 누락 방지용 마감 체크리스트", subs: ["기구·소도구 정리", "청소 및 분리수거 확인", "회원 문의 미응답 체크", "내일 수업/상담 일정 재확인", "특이사항 코멘트 남기기"] },
  { id: "new-member", icon: "🆕", title: "신규회원 7일 케어", cat: "member", pri: "high", recur: "none", dueOffset: 1, memo: "등록 직후 첫 주 적응 관리", subs: ["첫 수업 만족도 확인", "식단/출석 가이드 발송", "통증·주의사항 체크", "다음 예약 확정", "7일차 피드백 메시지 전송"] },
  { id: "retention", icon: "📞", title: "휴면회원 리텐션", cat: "member", pri: "high", recur: "weekly", dueOffset: 2, memo: "2주 이상 미출석 회원 재접촉", subs: ["휴면회원 리스트 추출", "우선 연락 대상 5명 선정", "카톡/전화 1차 연락", "응답 내용 기록", "재등록 가능성 분류"] },
  { id: "sns", icon: "📱", title: "주간 SNS 업로드", cat: "marketing", pri: "mid", recur: "weekly", dueOffset: 3, memo: "인스타/블로그 등 주간 콘텐츠 발행", subs: ["주제 선정", "사진·영상 수집", "문구 초안 작성", "업로드 및 해시태그 점검", "반응/문의 확인"] },
  { id: "facility", icon: "🛠️", title: "시설 점검", cat: "operation", pri: "mid", recur: "monthly", dueOffset: 5, memo: "월 1회 시설·소모품 점검", subs: ["기구 이상 유무 점검", "소모품 재고 확인", "수리/구매 필요 항목 기록", "위험 요소 사진 기록", "대표/실장 공유"] },
];

export const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
const pad = (n) => String(n).padStart(2, "0");
export const toDateStr = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const parseDateStr = (value) => {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const addDaysStr = (value, days = 0) => {
  const base = parseDateStr(value) || new Date();
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return toDateStr(next);
};
export const todayStr = () => toDateStr(new Date());
export const dday = (d) => {
  if (!d) return null;
  const dueDate = parseDateStr(d);
  const today = parseDateStr(todayStr());
  return Math.ceil((dueDate - today) / 86400000);
};
export const ddayLabel = (d) => {
  const n = dday(d);
  if (n === null) return "";
  if (n < 0) return `D+${Math.abs(n)}`;
  if (n === 0) return "D-Day";
  return `D-${n}`;
};
export const ddayColor = (d) => {
  const n = dday(d);
  if (n === null) return "#999";
  if (n <= 0) return "#DC2626";
  if (n <= 3) return "#EA580C";
  if (n <= 7) return "#D97706";
  return "#6B7280";
};
export const canSee = (task, me) => me.role === "owner" || !task.assignees?.length || task.assignees.includes(me.id);
export const nextDue = (due, recur) => {
  if (!due) return "";
  const d = parseDateStr(due);
  if (!d) return "";
  if (recur === "weekly") d.setDate(d.getDate() + 7);
  else if (recur === "biweekly") d.setDate(d.getDate() + 14);
  else if (recur === "monthly") d.setMonth(d.getMonth() + 1);
  return toDateStr(d);
};
export const nowIso = () => new Date().toISOString();
export const timeNow = () => new Date().toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
