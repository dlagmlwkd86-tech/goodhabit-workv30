import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { supabase } from "./supabase";

const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

/* ─── Constants ─── */
const CATS = {
  member: { label: "회원관리", icon: "👥", color: "#2563EB", bg: "#EFF6FF" },
  coach: { label: "코치관리", icon: "🏋️", color: "#059669", bg: "#ECFDF5" },
  marketing: { label: "마케팅", icon: "📣", color: "#D97706", bg: "#FFFBEB" },
  operation: { label: "운영", icon: "⚙️", color: "#7C3AED", bg: "#F5F3FF" },
};
const PRI = { high: { label: "긴급", color: "#fff", bg: "#DC2626" }, mid: { label: "보통", color: "#92400E", bg: "#FDE68A" }, low: { label: "낮음", color: "#6B7280", bg: "#F3F4F6" } };
const RECUR_L = { none: "없음", weekly: "매주", biweekly: "격주", monthly: "매월" };
const BR_COLORS = ["#FF6B35","#2563EB","#059669","#7C3AED","#DC2626","#D97706","#0891B2","#BE185D"];
const EMOJIS = ["🏋️","💪","🔥","⚡","🎯","💫","🏃","🥊","🧘","⭐","❤️"];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const todayStr = () => new Date().toISOString().slice(0, 10);
const dday = (d) => { if (!d) return null; return Math.ceil((new Date(d) - new Date(todayStr())) / 86400000); };
const ddayLabel = (d) => { const n = dday(d); if (n === null) return ""; if (n < 0) return `D+${Math.abs(n)}`; if (n === 0) return "D-Day"; return `D-${n}`; };
const ddayColor = (d) => { const n = dday(d); if (n === null) return "#999"; if (n <= 0) return "#DC2626"; if (n <= 3) return "#EA580C"; if (n <= 7) return "#D97706"; return "#6B7280"; };
const canSee = (t, me) => me.role === "owner" || !t.assignees?.length || t.assignees.includes(me.id);
const nextDue = (due, recur) => { if (!due) return ""; const d = new Date(due); if (recur === "weekly") d.setDate(d.getDate() + 7); else if (recur === "biweekly") d.setDate(d.getDate() + 14); else if (recur === "monthly") d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); };
const timeNow = () => new Date().toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/* ─── Supabase helpers ─── */
const db = {
  async loadBranches() { const { data } = await supabase.from("branches").select("*").order("created_at"); return data || []; },
  async loadCoaches() { const { data } = await supabase.from("coaches").select("*").order("created_at"); return data || []; },
  async loginByPin(pin) { const { data } = await supabase.from("coaches").select("*").eq("pin", pin).maybeSingle(); return data; },
  async loadTasks(branchId) {
    let q = supabase.from("tasks").select("*").order("created_at", { ascending: true });
    if (branchId) q = q.eq("branch_id", branchId);
    const { data } = await q;
    return data ? data.map(r => r.data) : [];
  },
  async loadAllTasks() { const { data } = await supabase.from("tasks").select("*").order("created_at"); return data ? data.map(r => r.data) : []; },
  async saveTasks(tasks) { const rows = tasks.map(t => ({ id: t.id, branch_id: t.branchId, data: t, updated_at: new Date().toISOString() })); await supabase.from("tasks").upsert(rows, { onConflict: "id" }); },
  async deleteTask(id) { await supabase.from("tasks").delete().eq("id", id); },
  async saveBranch(b) { await supabase.from("branches").upsert([b], { onConflict: "id" }); },
  async deleteBranch(id) { await supabase.from("branches").delete().eq("id", id); },
  async saveCoach(c) { await supabase.from("coaches").upsert([c], { onConflict: "id" }); },
  async deleteCoach(id) { await supabase.from("coaches").delete().eq("id", id); },
};

/* ─── AI ─── */
const AI_CACHE_TTL_MS = 60_000;
const aiCache = new Map();
const aiInflight = new Map();

function buildAiCacheKey(prompt, grounded = false, key = "") {
  return `${key || "default"}::${grounded ? "1" : "0"}::${prompt}`;
}

function friendlyAiError(err) {
  const msg = String(err?.message || "");
  if (/quota|resource_exhausted|rate limit|too many requests|429/i.test(msg)) {
    return "AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.";
  }
  return msg || "AI 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}

async function callAI(prompt, grounded = false, options = {}) {
  const cacheKey = buildAiCacheKey(prompt, grounded, options.key);
  const cached = aiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.text;

  if (aiInflight.has(cacheKey)) return aiInflight.get(cacheKey);

  const request = (async () => {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, grounded }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.rawError || "AI error");
    const text = data.text || "";
    aiCache.set(cacheKey, { text, expiresAt: Date.now() + (options.ttlMs || AI_CACHE_TTL_MS) });
    return text;
  })();

  aiInflight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    aiInflight.delete(cacheKey);
  }
}
function advicePrompt(task, names, branchName) {
  const c = CATS[task.cat]; const subs = task.subs.map((s, i) => `${i + 1}. [${s.done ? "✅" : "⬜"}] ${s.t}`).join("\n");
  return `당신은 그룹PT 센터 "좋은습관PT ${branchName}"의 베테랑 매니저입니다.
담당 코치(${names})에게 실행 지시. 코치는 성실하지만 기획력·기억력이 약해 구체적 지시 필요.
과제: ${c.label} / ${task.title} / ${PRI[task.pri].label} / 마감:${task.due || "미정"} ${task.due ? ddayLabel(task.due) : ""}
${task.memo ? "메모:" + task.memo : ""}
세부:
${subs}
규칙: 미완료 중 지금 할 것 1개, 소요시간, 준비물, 실전 템플릿/멘트, 실수경고 1가지. 6~8줄. 존댓말. 일반텍스트.`;
}
function reviewPrompt(tasks, branchName) {
  const s = tasks.map(t => `- [${CATS[t.cat].label}] ${t.title} (${t.subs.filter(s => s.done).length}/${t.subs.length}, ${PRI[t.pri].label})`).join("\n");
  return `"좋은습관PT ${branchName}" 주간 리뷰.\n${s}\n성과(1~2줄),주의(1~2줄),최우선(1~2줄),응원(1줄). 6~8줄. 존댓말. 일반텍스트.`;
}
function eventPrompt(branchName) {
  const m = new Date().getMonth() + 1;
  return `"좋은습관PT ${branchName}" ${m}월 이벤트 3가지 추천. 그룹PT/크로스핏/HYROX 센터, 인천 20~40대. 이벤트명,이유,운영법,효과. 존댓말. 일반텍스트.`;
}
function trendsPrompt(branchName) {
  return `"좋은습관PT ${branchName}" 코치를 위한 피트니스 업계 동향. 운동트렌드,마케팅,회원관리,경쟁환경 각1~2줄 + 코치응원1줄. 존댓말. 한국시장. 일반텍스트.`;
}

/* ─── Shared styles ─── */
const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 4, marginTop: 14 };
const inp = { width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#FAFAFA" };
const btnS = { padding: "10px 0", borderRadius: 10, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#9CA3AF", flex: 1 };
const btnP = { padding: "10px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#FF6B35,#FF8F5E)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flex: 1 };
const btnD = { width: "100%", padding: 12, borderRadius: 12, border: "1.5px dashed #D1D5DB", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#9CA3AF", fontFamily: "inherit", marginTop: 4 };
function ActBtn({ onClick, active, icon, label, badge, disabled = false }) {
  return <button disabled={disabled} onClick={disabled ? undefined : onClick} style={{ flex: 1, padding: "9px 0", border: "none", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, fontSize: 12, fontWeight: 600, fontFamily: "inherit", background: active ? "#F8FAFC" : "transparent", color: active ? "#475569" : "#C0C0C0", display: "flex", alignItems: "center", justifyContent: "center", gap: 3, position: "relative" }}>{icon} {label}{badge > 0 && <span style={{ position: "absolute", top: 2, right: "18%", background: "#EF4444", color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 10, padding: "1px 5px" }}>{badge}</span>}</button>;
}
function Pill({ active, onClick, color, children }) {
  return <button onClick={onClick} style={{ padding: "7px 14px", borderRadius: 10, border: active ? "none" : "1px solid #E5E7EB", cursor: "pointer", fontSize: 11.5, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap", background: active ? color : "#fff", color: active ? "#fff" : "#9CA3AF" }}>{children}</button>;
}

/* ─── Admin Panel ─── */
function AdminPanel({ branches, coaches, onClose, refreshData }) {
  const [tab, setTab] = useState("branches");
  const [addB, setAddB] = useState(false); const [nbN, setNbN] = useState(""); const [nbC, setNbC] = useState(BR_COLORS[1]);
  const [addC, setAddC] = useState(false); const [nc, setNc] = useState({ name: "", pin: "", emoji: "🏋️", branch_id: "" });
  const [editC, setEditC] = useState(null);

  const doAddB = async () => { if (!nbN.trim()) return; const b = { id: "b-" + uid(), name: nbN.trim(), color: nbC }; await db.saveBranch(b); setNbN(""); setAddB(false); refreshData(); };
  const delB = async (id) => { if (!confirm("지점 삭제?")) return; await db.deleteBranch(id); refreshData(); };
  const doAddC = async () => { if (!nc.name.trim() || nc.pin.length !== 4) return; if (coaches.find(c => c.pin === nc.pin)) { alert("PIN 중복"); return; } const c = { id: "coach-" + uid(), name: nc.name.trim(), pin: nc.pin, role: "coach", emoji: nc.emoji, branch_id: nc.branch_id || branches[0]?.id }; await db.saveCoach(c); setNc({ name: "", pin: "", emoji: "🏋️", branch_id: "" }); setAddC(false); refreshData(); };
  const saveEdit = async () => { if (!editC) return; await db.saveCoach(editC); setEditC(null); refreshData(); };
  const delC = async (id) => { if (!confirm("코치 삭제?")) return; await db.deleteCoach(id); refreshData(); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,14,26,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 500, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", animation: "slideUp .3s ease" }}>
        <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#E5E7EB", margin: "0 auto 16px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>⚙️ 센터 관리</span>
            <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "#6B7280", fontWeight: 600 }}>닫기</button>
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {[["branches", "📍 지점"], ["coaches", "🏋️ 코치"]].map(([k, v]) => <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", background: tab === k ? "#0A0E1A" : "#F3F4F6", color: tab === k ? "#fff" : "#6B7280" }}>{v}</button>)}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>
          {tab === "branches" && <>
            {branches.map(b => <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#FAFAFA", borderRadius: 12, marginBottom: 8, border: "1px solid #EAECF0" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: b.color }} /><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{b.name}</span><span style={{ fontSize: 11, color: "#9CA3AF" }}>{coaches.filter(c => c.branch_id === b.id).length}명</span><button onClick={() => delB(b.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#D1D5DB", fontSize: 14 }}>🗑</button></div>)}
            {addB ? <div style={{ padding: 16, background: "#F9FAFB", borderRadius: 14, border: "1.5px solid #E5E7EB", marginTop: 8 }}>
              <label style={lbl}>지점 이름</label><input value={nbN} onChange={e => setNbN(e.target.value)} placeholder="예: 검단점" style={inp} autoFocus />
              <label style={{ ...lbl, marginTop: 12 }}>색상</label><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>{BR_COLORS.map(c => <button key={c} onClick={() => setNbC(c)} style={{ width: 32, height: 32, borderRadius: 10, background: c, border: nbC === c ? "3px solid #0A0E1A" : "2px solid transparent", cursor: "pointer" }} />)}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}><button onClick={() => setAddB(false)} style={btnS}>취소</button><button onClick={doAddB} style={btnP}>추가</button></div>
            </div> : <button onClick={() => setAddB(true)} style={btnD}>+ 새 지점</button>}
          </>}
          {tab === "coaches" && <>
            {editC && <div style={{ padding: 16, background: "#FFF8F3", borderRadius: 14, border: "1.5px solid #FDDCB8", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#C2410C" }}>✏️ {editC.name} 수정</div>
              <div style={{ display: "flex", gap: 8 }}><div style={{ flex: 1 }}><label style={lbl}>이름</label><input value={editC.name} onChange={e => setEditC({ ...editC, name: e.target.value })} style={inp} /></div><div style={{ flex: 1 }}><label style={lbl}>PIN</label><input value={editC.pin} onChange={e => setEditC({ ...editC, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })} style={inp} /></div></div>
              <label style={lbl}>지점</label><select value={editC.branch_id || ""} onChange={e => setEditC({ ...editC, branch_id: e.target.value })} style={inp}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              <label style={lbl}>이모지</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>{EMOJIS.map(em => <button key={em} onClick={() => setEditC({ ...editC, emoji: em })} style={{ fontSize: 20, padding: "4px 6px", borderRadius: 8, border: editC.emoji === em ? "2px solid #FF6B35" : "2px solid #E5E7EB", background: editC.emoji === em ? "#FFF5F0" : "#fff", cursor: "pointer" }}>{em}</button>)}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}><button onClick={() => setEditC(null)} style={btnS}>취소</button><button onClick={saveEdit} style={btnP}>저장</button></div>
            </div>}
            {coaches.filter(c => c.role === "coach").map(c => {
              const br = branches.find(b => b.id === c.branch_id);
              return <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#FAFAFA", borderRadius: 12, marginBottom: 8, border: "1px solid #EAECF0" }}><span style={{ fontSize: 20 }}>{c.emoji}</span><div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div><div style={{ display: "flex", gap: 6, marginTop: 3 }}><span style={{ fontSize: 11, color: "#6B7280", background: "#F3F4F6", padding: "1px 8px", borderRadius: 5 }}>PIN:{c.pin}</span>{br && <span style={{ fontSize: 11, color: br.color, background: br.color + "10", padding: "1px 8px", borderRadius: 5, fontWeight: 600 }}>{br.name}</span>}</div></div><button onClick={() => setEditC({ ...c })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#9CA3AF" }}>✏️</button><button onClick={() => delC(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#D1D5DB", fontSize: 13 }}>🗑</button></div>;
            })}
            {addC ? <div style={{ padding: 16, background: "#F9FAFB", borderRadius: 14, border: "1.5px solid #E5E7EB", marginTop: 8 }}>
              <div style={{ display: "flex", gap: 8 }}><div style={{ flex: 1 }}><label style={lbl}>이름</label><input value={nc.name} onChange={e => setNc(p => ({ ...p, name: e.target.value }))} style={inp} autoFocus /></div><div style={{ flex: 1 }}><label style={lbl}>PIN</label><input value={nc.pin} onChange={e => setNc(p => ({ ...p, pin: e.target.value.replace(/\D/g, "").slice(0, 4) }))} style={inp} maxLength={4} type="tel" /></div></div>
              <label style={lbl}>지점</label><select value={nc.branch_id || branches[0]?.id || ""} onChange={e => setNc(p => ({ ...p, branch_id: e.target.value }))} style={inp}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              <label style={lbl}>이모지</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>{EMOJIS.map(em => <button key={em} onClick={() => setNc(p => ({ ...p, emoji: em }))} style={{ fontSize: 20, padding: "4px 6px", borderRadius: 8, border: nc.emoji === em ? "2px solid #FF6B35" : "2px solid #E5E7EB", background: nc.emoji === em ? "#FFF5F0" : "#fff", cursor: "pointer" }}>{em}</button>)}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}><button onClick={() => setAddC(false)} style={btnS}>취소</button><button onClick={doAddC} style={btnP}>추가</button></div>
            </div> : <button onClick={() => setAddC(true)} style={btnD}>+ 새 코치</button>}
          </>}
        </div>
      </div>
    </div>
  );
}

/* ─── Recurring Modal ─── */
function RecurModal({ task, onRecreate, onFinish, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,14,26,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001, padding: 20 }} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔁</div>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>반복 과제 완료!</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 6 }}>"{task.title}"</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>{RECUR_L[task.recur]}{task.due ? ` · 다음: ${nextDue(task.due, task.recur)}` : ""}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={onRecreate} style={{ padding: 14, borderRadius: 14, border: "none", background: "linear-gradient(135deg,#FF6B35,#FF8F5E)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>🔄 다음 회차 생성</button>
          <button onClick={onFinish} style={{ padding: 14, borderRadius: 14, border: "1.5px solid #E5E7EB", background: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#6B7280" }}>✅ 종료 (완료 처리)</button>
          <button onClick={onCancel} style={{ padding: 10, border: "none", background: "transparent", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#9CA3AF" }}>취소</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Task Edit ─── */
function TaskEditPanel({ task, onSave, onCancel, coaches }) {
  const [ed, setEd] = useState({ title: task.title, due: task.due || "", pri: task.pri, cat: task.cat, recur: task.recur, assignees: task.assignees || [], memo: task.memo || "" });
  return (
    <div style={{ padding: "12px 14px 14px", borderTop: "1px solid #E5E7EB", background: "#FAFBFC" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>✏️ 과제 수정</div>
      <label style={lbl}>과제명</label><input value={ed.title} onChange={e => setEd(p => ({ ...p, title: e.target.value }))} style={inp} />
      <div style={{ display: "flex", gap: 8 }}><div style={{ flex: 1 }}><label style={lbl}>분야</label><select value={ed.cat} onChange={e => setEd(p => ({ ...p, cat: e.target.value }))} style={inp}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</select></div><div style={{ flex: 1 }}><label style={lbl}>우선순위</label><select value={ed.pri} onChange={e => setEd(p => ({ ...p, pri: e.target.value }))} style={inp}><option value="high">🔴 긴급</option><option value="mid">🟡 보통</option><option value="low">⚪ 낮음</option></select></div></div>
      <div style={{ display: "flex", gap: 8 }}><div style={{ flex: 1 }}><label style={lbl}>마감일</label><input type="date" value={ed.due} onChange={e => setEd(p => ({ ...p, due: e.target.value }))} style={inp} /></div><div style={{ flex: 1 }}><label style={lbl}>반복</label><select value={ed.recur} onChange={e => setEd(p => ({ ...p, recur: e.target.value }))} style={inp}><option value="none">없음</option><option value="weekly">매주</option><option value="biweekly">격주</option><option value="monthly">매월</option></select></div></div>
      <label style={lbl}>담당</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{coaches.filter(c => c.role === "coach").map(c => { const on = ed.assignees.includes(c.id); return <button key={c.id} onClick={() => setEd(p => ({ ...p, assignees: on ? p.assignees.filter(x => x !== c.id) : [...p.assignees, c.id] }))} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: `2px solid ${on ? "#FF6B35" : "#E5E7EB"}`, background: on ? "#FFF5F0" : "#fff", color: on ? "#FF6B35" : "#6B7280" }}>{c.emoji} {c.name}</button>; })}</div>
      <label style={lbl}>메모</label><input value={ed.memo} onChange={e => setEd(p => ({ ...p, memo: e.target.value }))} placeholder="참고사항" style={inp} />
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}><button onClick={onCancel} style={btnS}>취소</button><button onClick={() => onSave({ ...task, ...ed })} style={btnP}>저장</button></div>
    </div>
  );
}

/* ─── SubNode ─── */
function SubNode({ sub, isLast, isFirst, color, onToggle, onDelete, onMoveUp, onMoveDown, count }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", minHeight: sub.done && sub.doneBy ? 46 : 38 }}>
      <div style={{ width: 28, position: "relative", flexShrink: 0 }}><div style={{ position: "absolute", left: 13, top: 0, bottom: isLast ? "50%" : 0, width: 2, background: color + "25" }} /><div style={{ position: "absolute", left: 13, top: "50%", width: 12, height: 2, background: color + "25" }} /><div style={{ position: "absolute", left: 22, top: "50%", transform: "translate(-50%,-50%)", width: 7, height: 7, borderRadius: "50%", background: sub.done ? color : "#fff", border: `2px solid ${sub.done ? color : color + "50"}`, zIndex: 1 }} /></div>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", gap: 6, padding: "6px 6px 6px 4px", borderRadius: 8 }}>
        <div onClick={() => onToggle(sub.id)} style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1, border: `2px solid ${sub.done ? "#34D399" : "#D1D5DB"}`, background: sub.done ? "#34D399" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{sub.done && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onToggle(sub.id)}><span style={{ fontSize: 13.5, fontWeight: 500, color: sub.done ? "#B0B0B0" : "#1F2937", textDecoration: sub.done ? "line-through" : "none" }}>{sub.t}</span>{sub.done && sub.doneBy && <div style={{ fontSize: 10.5, color: "#A3A3A3", marginTop: 2 }}>{sub.doneEmoji} {sub.doneBy} · {sub.doneAt}</div>}</div>
        {count > 1 && <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>{!isFirst && <button onClick={() => onMoveUp(sub.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#D1D5DB", padding: "0 3px" }}>▲</button>}{!isLast && <button onClick={() => onMoveDown(sub.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#D1D5DB", padding: "0 3px" }}>▼</button>}</div>}
        <button onClick={() => onDelete(sub.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E0E0E0", fontSize: 12, marginTop: 2, flexShrink: 0 }}>✕</button>
      </div>
    </div>
  );
}

/* ─── Comments ─── */
function Comments({ comments, onAdd, color }) {
  const me = useAuth(); const [text, setText] = useState(""); const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [comments.length]);
  const submit = () => { if (!text.trim()) return; onAdd({ id: uid(), coachId: me.id, name: me.name, emoji: me.emoji, role: me.role, text: text.trim(), time: timeNow() }); setText(""); };
  return (
    <div style={{ padding: "10px 14px 12px", borderTop: "1px solid #F3F4F6", background: "#FAFBFC" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8 }}>💬 코멘트</div>
      <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 8 }}>{comments.length === 0 && <div style={{ fontSize: 12, color: "#C0C0C0", padding: "8px 0" }}>아직 없습니다</div>}{comments.map(c => (<div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 8, flexDirection: c.coachId === me.id ? "row-reverse" : "row" }}><div style={{ maxWidth: "80%", padding: "8px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.5, background: c.role === "owner" ? "#E0E7FF" : "#F0FDF4" }}><div style={{ fontSize: 10, fontWeight: 700, color: c.role === "owner" ? "#4338CA" : "#059669", marginBottom: 2 }}>{c.emoji} {c.name}</div>{c.text}<div style={{ fontSize: 10, color: "#999", marginTop: 3, textAlign: "right" }}>{c.time}</div></div></div>))}<div ref={endRef} /></div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, flexShrink: 0 }}>{me.emoji} {me.name}</span><input value={text} onChange={e => setText(e.target.value)} placeholder="메시지..." onKeyDown={e => { if (e.key === "Enter") submit(); }} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", outline: "none" }} /><button onClick={submit} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: color, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>전송</button></div>
    </div>
  );
}

/* ─── TaskTree ─── */
function TaskTree({ task, onChange, onSoftDelete, onComplete, onShowRecur, coaches, branchName, commentSeen }) {
  const me = useAuth(); const [ai, setAi] = useState(null); const [aiLoad, setAiLoad] = useState(false); const [panel, setPanel] = useState(null); const [adding, setAdding] = useState(false); const [newSub, setNewSub] = useState("");
  const cat = CATS[task.cat]; const overdue = task.due && dday(task.due) !== null && dday(task.due) < 0;
  const done = task.subs.filter(s => s.done).length; const total = task.subs.length; const pct = total === 0 ? 0 : Math.round(done / total * 100); const allDone = total > 0 && done === total;
  const newCmt = (task.comments || []).length - (commentSeen || 0);
  const names = (task.assignees || []).map(id => coaches.find(c => c.id === id)?.name).filter(Boolean).join(", ") || "전체";

  const toggleSub = (sid) => onChange({ ...task, subs: task.subs.map(s => { if (s.id !== sid) return s; const nd = !s.done; return nd ? { ...s, done: true, doneBy: me.name, doneEmoji: me.emoji, doneAt: timeNow() } : { ...s, done: false, doneBy: null, doneEmoji: null, doneAt: null }; }) });
  const moveSub = (sid, dir) => { const i = task.subs.findIndex(s => s.id === sid); if (i < 0) return; const j = i + dir; if (j < 0 || j >= task.subs.length) return; const ns = [...task.subs]; [ns[i], ns[j]] = [ns[j], ns[i]]; onChange({ ...task, subs: ns }); };
  const addSub = () => { if (!newSub.trim()) return; onChange({ ...task, subs: [...task.subs, { id: uid(), t: newSub.trim(), done: false }] }); setNewSub(""); setAdding(false); };

  const doAI = async () => {
    if (aiLoad) return;
    if (panel === "ai") { setPanel(null); return; }
    setPanel("ai");
    if (ai) return;
    setAiLoad(true);
    try {
      setAi(await callAI(advicePrompt(task, names, branchName), false, { key: `task:${task.id}` }));
    } catch (e) {
      setAi(friendlyAiError(e));
    } finally {
      setAiLoad(false);
    }
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ background: allDone ? "#F0FDF4" : "#fff", borderRadius: 16, overflow: "hidden", border: `1.5px solid ${allDone ? "#BBF7D0" : overdue && !allDone ? "#FCA5A5" : "#EAECF0"}`, opacity: task.completed ? 0.5 : allDone ? 0.8 : 1, boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
        {/* Header */}
        <div onClick={() => onChange({ ...task, open: !task.open })} style={{ display: "flex", alignItems: "center", cursor: "pointer", padding: "14px 12px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}><div style={{ width: 22, height: 22, borderRadius: 6, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", transform: task.open ? "rotate(90deg)" : "" }}><svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M3 1L7 5L3 9" stroke={cat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div><div style={{ width: 4, height: 26, borderRadius: 2, background: cat.color }} /></div>
          <div style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><span style={{ fontSize: 14.5, fontWeight: 700, color: allDone ? "#9CA3AF" : "#111", textDecoration: task.completed ? "line-through" : "none" }}>{task.title}</span>{task.recur !== "none" && <span style={{ fontSize: 9.5, background: "#E0E7FF", color: "#4338CA", padding: "1px 6px", borderRadius: 5, fontWeight: 700 }}>🔁 {RECUR_L[task.recur]}</span>}{task.completed && <span style={{ fontSize: 9.5, background: "#D1FAE5", color: "#059669", padding: "1px 6px", borderRadius: 5, fontWeight: 700 }}>완료</span>}</div>
            <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, background: cat.bg, color: cat.color, padding: "2px 6px", borderRadius: 5, fontWeight: 700 }}>{cat.icon} {cat.label}</span>
              <span style={{ fontSize: 10, background: PRI[task.pri].bg, color: PRI[task.pri].color, padding: "2px 6px", borderRadius: 5, fontWeight: 700 }}>{PRI[task.pri].label}</span>
              {task.due && <span style={{ fontSize: 10.5, fontWeight: 800, color: ddayColor(task.due), padding: "1px 6px", borderRadius: 5 }}>{ddayLabel(task.due)}</span>}
              {(task.assignees || []).map(aid => { const c = coaches.find(x => x.id === aid); return c ? <span key={aid} style={{ fontSize: 9.5, background: "#F1F5F9", color: "#475569", padding: "1px 6px", borderRadius: 5, fontWeight: 600 }}>{c.emoji} {c.name}</span> : null; })}
            </div>
          </div>
          <div style={{ position: "relative", width: 42, height: 42, flexShrink: 0 }}><svg width="42" height="42" viewBox="0 0 42 42" style={{ transform: "rotate(-90deg)" }}><circle cx="21" cy="21" r="17" fill="none" stroke="#F3F4F6" strokeWidth="3.5" /><circle cx="21" cy="21" r="17" fill="none" stroke={allDone ? "#34D399" : cat.color} strokeWidth="3.5" strokeDasharray={`${2 * Math.PI * 17}`} strokeDashoffset={`${2 * Math.PI * 17 * (1 - pct / 100)}`} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s" }} /></svg><span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800 }}>{done}/{total}</span></div>
        </div>
        {task.memo && <div style={{ margin: "0 12px 6px 48px", padding: "5px 10px", background: "#FAFAFA", borderRadius: 7, fontSize: 12, color: "#6B7280", borderLeft: `3px solid ${cat.color}25` }}>📝 {task.memo}</div>}
        {/* Complete banner */}
        {allDone && !task.completed && <div style={{ margin: "0 12px 8px", padding: "10px 14px", background: "linear-gradient(135deg,#F0FDF4,#ECFDF5)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #BBF7D0" }}><span style={{ fontSize: 12, fontWeight: 600, color: "#059669" }}>✅ 모든 세부과제 완료!</span><button onClick={e => { e.stopPropagation(); if (task.recur !== "none") onShowRecur(task.id); else onComplete(task.id); }} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#059669", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{task.recur !== "none" ? "🔁 처리 선택" : "✅ 완료 처리"}</button></div>}
        {/* Subtasks */}
        {task.open && <div style={{ paddingLeft: 32, paddingRight: 8, paddingBottom: 2 }}>
          {task.subs.map((sub, i) => <SubNode key={sub.id} sub={sub} isFirst={i === 0} isLast={i === task.subs.length - 1 && !adding} color={cat.color} onToggle={toggleSub} onDelete={(sid) => onChange({ ...task, subs: task.subs.filter(s => s.id !== sid) })} onMoveUp={(id) => moveSub(id, -1)} onMoveDown={(id) => moveSub(id, 1)} count={task.subs.length} />)}
          {adding ? <div style={{ display: "flex", alignItems: "center", minHeight: 36 }}><div style={{ width: 28 }} /><div style={{ flex: 1, display: "flex", gap: 5, marginLeft: 4 }}><input value={newSub} onChange={e => setNewSub(e.target.value)} placeholder="세부과제..." onKeyDown={e => { if (e.key === "Enter") addSub(); if (e.key === "Escape") { setAdding(false); setNewSub(""); } }} autoFocus style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${cat.color}35`, fontSize: 13, fontFamily: "inherit", outline: "none", background: "#FAFAFA" }} /><button onClick={addSub} style={{ padding: "5px 10px", borderRadius: 7, border: "none", background: cat.color, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>추가</button></div></div>
            : <div style={{ paddingLeft: 28 }}><button onClick={() => setAdding(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#C0C0C0", fontFamily: "inherit", padding: "4px 0", fontWeight: 600 }}>+ 세부과제</button></div>}
        </div>}
        {/* Actions */}
        <div style={{ display: "flex", borderTop: "1px solid #F3F4F6", marginTop: 4 }}>
          <ActBtn onClick={doAI} active={panel === "ai"} icon="💡" label={aiLoad ? "생성중" : "AI"} disabled={aiLoad} />
          <div style={{ width: 1, background: "#F3F4F6" }} />
          <ActBtn onClick={() => setPanel(panel === "edit" ? null : "edit")} active={panel === "edit"} icon="✏️" label="수정" />
          <div style={{ width: 1, background: "#F3F4F6" }} />
          <ActBtn onClick={() => setPanel(panel === "comments" ? null : "comments")} active={panel === "comments"} icon="💬" label="코멘트" badge={newCmt} />
          <div style={{ width: 1, background: "#F3F4F6" }} />
          <button onClick={() => onSoftDelete(task.id)} style={{ padding: "9px 12px", border: "none", cursor: "pointer", fontSize: 12, color: "#DEDEDE", fontFamily: "inherit", background: "transparent" }}>🗑</button>
        </div>
        {panel === "ai" && <div style={{ padding: "12px 14px 14px", borderTop: "1px solid #FEF3C7", background: "linear-gradient(180deg,#FFFBEB,#FFFDFA)" }}>{aiLoad ? <div style={{ color: "#D97706", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><span className="ai-spin">⏳</span> 생성 중... 잠시만 기다려주세요.</div> : ai && <><div style={{ fontSize: 12, fontWeight: 800, color: "#92400E", marginBottom: 8 }}>💡 실행 가이드</div><div style={{ fontSize: 13, color: "#44403C", lineHeight: 1.85, whiteSpace: "pre-wrap", padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #FDE68A" }}>{ai}</div></>}</div>}
        {panel === "edit" && <TaskEditPanel task={task} onSave={t => { onChange(t); setPanel(null); }} onCancel={() => setPanel(null)} coaches={coaches} />}
        {panel === "comments" && <Comments comments={task.comments || []} onAdd={c => onChange({ ...task, comments: [...(task.comments || []), c] })} color={cat.color} />}
      </div>
    </div>
  );
}

/* ─── Login ─── */
function LoginScreen({ onLogin }) {
  const [pin, setPin] = useState(["", "", "", ""]); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const refs = [useRef(), useRef(), useRef(), useRef()];
  const hi = async (i, v) => { if (!/^\d?$/.test(v)) return; const n = [...pin]; n[i] = v; setPin(n); setError(""); if (v && i < 3) refs[i + 1].current?.focus(); if (v && i === 3 && n.every(d => d)) { setLoading(true); const c = await db.loginByPin(n.join("")); if (c) { localStorage.setItem("gh-coach-id", c.id); onLogin(c); } else { setError("PIN이 일치하지 않습니다"); setPin(["", "", "", ""]); refs[0].current?.focus(); } setLoading(false); } };
  return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-30%", right: "-20%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,#FF6B3518 0%,transparent 70%)" }} />
      <div style={{ textAlign: "center", marginBottom: 36 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#FF6B35", letterSpacing: 3, marginBottom: 10 }}>GOOD HABITS PT</div><div style={{ fontSize: 34, fontWeight: 900, color: "#fff" }}>좋은습관<span style={{ color: "#FF6B35" }}>PT</span></div><div style={{ fontSize: 13, color: "#4B5563", marginTop: 6 }}>센터 과제관리</div></div>
      <div style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", borderRadius: 28, padding: "40px 32px 36px", width: "100%", maxWidth: 360, textAlign: "center", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#E5E7EB", marginBottom: 28 }}>PIN 코드 입력</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 }}>{pin.map((d, i) => <input key={i} ref={refs[i]} value={d} onChange={e => hi(i, e.target.value)} onKeyDown={e => { if (e.key === "Backspace" && !pin[i] && i > 0) refs[i - 1].current?.focus(); }} onFocus={e => e.target.select()} type="tel" inputMode="numeric" maxLength={1} style={{ width: 56, height: 64, borderRadius: 16, border: `2px solid ${error ? "#EF4444" : d ? "#FF6B35" : "rgba(255,255,255,0.1)"}`, textAlign: "center", fontSize: 26, fontWeight: 800, fontFamily: "inherit", outline: "none", background: d ? "rgba(255,107,53,0.08)" : "rgba(255,255,255,0.04)", color: "#fff" }} />)}</div>
        {error && <div style={{ fontSize: 13, color: "#EF4444", fontWeight: 600 }}>{error}</div>}
        {loading && <div style={{ fontSize: 13, color: "#FF6B35", animation: "pulse 1.5s ease infinite" }}>확인 중...</div>}
      </div>
    </div>
  );
}

/* ─── Dashboard ─── */
function Dashboard({ coaches: initCoaches, branches: initBranches }) {
  const me = useAuth(); const isOwner = me.role === "owner";
  const [coaches, setCoaches] = useState(initCoaches);
  const [branches, setBranches] = useState(initBranches);
  const [curBranch, setCurBranch] = useState(isOwner ? initBranches[0]?.id : me.branch_id);
  const br = branches.find(b => b.id === curBranch); const branchName = br?.name || "";
  const branchCoaches = coaches.filter(c => c.branch_id === curBranch || c.role === "owner");

  const [allTasks, setAllTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("all"); const [search, setSearch] = useState("");
  const [hideCompleted, setHideCompleted] = useState(true); const [showTrash, setShowTrash] = useState(false);
  const [showAdd, setShowAdd] = useState(false); const [showAdmin, setShowAdmin] = useState(false);
  const [nf, setNf] = useState({ title: "", cat: "member", pri: "mid", due: "", subsText: "", recur: "none", assignees: [] });
  const [review, setReview] = useState(null); const [reviewLoad, setReviewLoad] = useState(false); const [showReview, setShowReview] = useState(false);
  const [events, setEvents] = useState(null); const [eventsLoad, setEventsLoad] = useState(false); const [showEvents, setShowEvents] = useState(false);
  const [trends, setTrends] = useState(null); const [trendsLoad, setTrendsLoad] = useState(false); const [showTrends, setShowTrends] = useState(false);
  const [recurModal, setRecurModal] = useState(null);
  const [commentSeen, setCommentSeen] = useState({});
  const [syncing, setSyncing] = useState(false);

  // Load
  useEffect(() => { (async () => { const d = isOwner ? await db.loadAllTasks() : await db.loadTasks(me.branch_id); setAllTasks(d || []); setLoaded(true); })(); }, []);
  // Realtime
  useEffect(() => {
    const ch = supabase.channel("rt").on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, async () => { const d = isOwner ? await db.loadAllTasks() : await db.loadTasks(me.branch_id); if (d) setAllTasks(d); }).subscribe();
    const ch2 = supabase.channel("rt2").on("postgres_changes", { event: "*", schema: "public", table: "coaches" }, async () => { setCoaches(await db.loadCoaches()); }).subscribe();
    const ch3 = supabase.channel("rt3").on("postgres_changes", { event: "*", schema: "public", table: "branches" }, async () => { setBranches(await db.loadBranches()); }).subscribe();
    return () => { supabase.removeChannel(ch); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
  }, []);

  // Save debounced
  const saveRef = useRef(null);
  const save = useCallback((t) => { if (saveRef.current) clearTimeout(saveRef.current); saveRef.current = setTimeout(async () => { setSyncing(true); await db.saveTasks(t); setSyncing(false); }, 500); }, []);

  const refreshData = async () => { setCoaches(await db.loadCoaches()); setBranches(await db.loadBranches()); };

  // Filters
  let vis = allTasks.filter(t => t.branchId === curBranch && !t.deleted && canSee(t, me));
  if (hideCompleted) vis = vis.filter(t => !t.completed);
  if (search.trim()) { const q = search.toLowerCase(); vis = vis.filter(t => t.title.toLowerCase().includes(q) || t.subs.some(s => s.t.toLowerCase().includes(q))); }
  const completedCount = allTasks.filter(t => t.branchId === curBranch && t.completed && !t.deleted).length;
  const trashedTasks = allTasks.filter(t => t.branchId === curBranch && t.deleted);

  // Summary
  const active = allTasks.filter(t => t.branchId === curBranch && !t.completed && !t.deleted && canSee(t, me));
  const urgentN = active.filter(t => t.pri === "high" && t.subs.some(s => !s.done)).length;
  const overdueN = active.filter(t => t.due && dday(t.due) < 0 && t.subs.some(s => !s.done)).length;

  // Actions
  const upd = useCallback((t) => { setAllTasks(p => { const n = p.map(x => x.id === t.id ? t : x); save(n); return n; }); }, [save]);
  const softDel = useCallback((id) => { if (!confirm("휴지통으로 이동할까요?")) return; setAllTasks(p => { const n = p.map(t => t.id === id ? { ...t, deleted: true, deletedAt: new Date().toISOString() } : t); save(n); return n; }); }, [save]);
  const restore = useCallback((id) => { setAllTasks(p => { const n = p.map(t => t.id === id ? { ...t, deleted: false, deletedAt: null } : t); save(n); return n; }); }, [save]);
  const permDel = useCallback(async (id) => { if (!confirm("영구 삭제?")) return; setAllTasks(p => p.filter(t => t.id !== id)); await db.deleteTask(id); }, []);
  const complete = useCallback((id) => { setAllTasks(p => { const n = p.map(t => t.id === id ? { ...t, completed: true } : t); save(n); return n; }); }, [save]);
  const doRecreate = () => { if (!recurModal) return; setAllTasks(p => { const t = p.find(x => x.id === recurModal); if (!t) return p; const next = p.map(x => x.id === recurModal ? { ...x, completed: true } : x); const nt = { ...t, id: uid(), completed: false, open: true, due: nextDue(t.due, t.recur), subs: t.subs.map(s => ({ ...s, id: uid(), done: false, doneBy: null, doneEmoji: null, doneAt: null })), comments: [] }; const r = [...next, nt]; save(r); return r; }); setRecurModal(null); };

  const add = () => { if (!nf.title.trim()) return; const subs = nf.subsText.split("\n").map(s => s.trim()).filter(Boolean).map(s => ({ id: uid(), t: s, done: false })); const nt = { id: uid(), title: nf.title.trim(), cat: nf.cat, pri: nf.pri, due: nf.due, memo: "", open: true, recur: nf.recur, assignees: nf.assignees, branchId: curBranch, subs, comments: [], completed: false, deleted: false }; setAllTasks(p => { const n = [...p, nt]; save(n); return n; }); setNf({ title: "", cat: "member", pri: "mid", due: "", subsText: "", recur: "none", assignees: [] }); setShowAdd(false); };
  const switchBr = (bid) => { setCurBranch(bid); setReview(null); setShowReview(false); setEvents(null); setShowEvents(false); setTrends(null); setShowTrends(false); setFilter("all"); setSearch(""); setShowTrash(false); };

  const doReview = async () => {
    setShowReview(!showReview);
    if (review || reviewLoad) return;
    setReviewLoad(true);
    try {
      setReview(await callAI(reviewPrompt(vis, branchName), false, { key: `review:${curBranch}` }));
    } catch (e) {
      setReview(friendlyAiError(e));
    } finally {
      setReviewLoad(false);
    }
  };
  const doEvents = async () => {
    setShowEvents(!showEvents);
    if (events || eventsLoad) return;
    setEventsLoad(true);
    try {
      setEvents(await callAI(eventPrompt(branchName), false, { key: `events:${curBranch}` }));
    } catch (e) {
      setEvents(friendlyAiError(e));
    } finally {
      setEventsLoad(false);
    }
  };
  const doTrends = async () => {
    setShowTrends(!showTrends);
    if (trends || trendsLoad) return;
    setTrendsLoad(true);
    try {
      setTrends(await callAI(trendsPrompt(branchName), true, { key: `trends:${curBranch}` }));
    } catch (e) {
      setTrends(friendlyAiError(e));
    } finally {
      setTrendsLoad(false);
    }
  };

  const focus = vis.filter(t => t.due && dday(t.due) !== null && dday(t.due) <= 3 && t.subs.some(s => !s.done)).sort((a, b) => dday(a.due) - dday(b.due));
  const list = (filter === "all" ? [...vis] : vis.filter(t => t.cat === filter)).sort((a, b) => { const ad = a.subs.every(s => s.done) && a.subs.length > 0, bd = b.subs.every(s => s.done) && b.subs.length > 0; if (ad !== bd) return ad ? 1 : -1; const p = { high: 0, mid: 1, low: 2 }; if (p[a.pri] !== p[b.pri]) return p[a.pri] - p[b.pri]; if (a.due && b.due) return a.due.localeCompare(b.due); return a.due ? -1 : 1; });
  const totalS = vis.reduce((a, t) => a + t.subs.length, 0); const doneS = vis.reduce((a, t) => a + t.subs.filter(s => s.done).length, 0); const pct = totalS === 0 ? 0 : Math.round(doneS / totalS * 100);
  const logout = () => { localStorage.removeItem("gh-coach-id"); window.location.reload(); };

  if (!loaded) return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 12, background: "#0A0E1A" }}><span className="ai-spin" style={{ fontSize: 28 }}>⏳</span><span style={{ color: "#6B7280", fontSize: 14 }}>불러오는 중...</span></div>;

  return (
    <div style={{ minHeight: "100vh", background: "#F0F2F5" }}>
      {/* Header */}
      <div style={{ background: "#0A0E1A", padding: "16px 16px 14px", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle,#FF6B3512 0%,transparent 70%)" }} />
        <div style={{ maxWidth: 600, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 17, fontWeight: 900 }}>좋은습관<span style={{ color: "#FF6B35" }}>PT</span></span>{syncing && <span style={{ fontSize: 10, color: "#FF6B35", animation: "pulse 1.5s ease infinite" }}>저장</span>}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {isOwner && <button onClick={() => setShowAdmin(true)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 14, color: "#9CA3AF" }}>⚙️</button>}
              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.06)", padding: "5px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}><span style={{ fontSize: 13 }}>{me.emoji}</span><span style={{ fontSize: 12, fontWeight: 600 }}>{me.name}</span></div>
              <button onClick={logout} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 11, color: "#6B7280", fontFamily: "inherit" }}>로그아웃</button>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 6, overflowX: "auto" }}>
            {isOwner ? branches.map(b => <button key={b.id} onClick={() => switchBr(b.id)} style={{ padding: "8px 18px", borderRadius: 12, border: curBranch === b.id ? "none" : "1px solid rgba(255,255,255,0.08)", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", background: curBranch === b.id ? `linear-gradient(135deg,${b.color},${b.color}CC)` : "rgba(255,255,255,0.04)", color: curBranch === b.id ? "#fff" : "#6B7280", whiteSpace: "nowrap" }}>📍 {b.name}</button>)
              : <div style={{ padding: "8px 18px", borderRadius: 12, background: `linear-gradient(135deg,${br?.color || "#FF6B35"},${br?.color || "#FF6B35"}CC)`, fontSize: 13, fontWeight: 700 }}>📍 {branchName}</div>}
          </div>
          <div style={{ marginTop: 12, background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>진행률</span><span style={{ fontSize: 14, fontWeight: 800 }}>{pct}%<span style={{ fontWeight: 400, color: "#6B7280", fontSize: 11, marginLeft: 4 }}>{doneS}/{totalS}</span></span></div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: "linear-gradient(90deg,#FF6B35,#FF8F5E)", transition: "width 0.6s" }} /></div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {urgentN > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#FCA5A5", background: "rgba(239,68,68,0.1)", padding: "3px 10px", borderRadius: 8 }}>🔴 긴급 {urgentN}</span>}
              {overdueN > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#F87171", background: "rgba(239,68,68,0.1)", padding: "3px 10px", borderRadius: 8 }}>⚠️ 초과 {overdueN}</span>}
              {urgentN === 0 && overdueN === 0 && <span style={{ fontSize: 11, fontWeight: 600, color: "#6EE7B7" }}>✅ 긴급 없음</span>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 12px" }}>
        {/* Search */}
        <div style={{ margin: "12px 0 6px", position: "relative" }}><span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#9CA3AF" }}>🔍</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="과제 검색..." style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 12, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#fff" }} />{search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#D1D5DB" }}>✕</button>}</div>

        {/* Focus */}
        {focus.length > 0 && !search && <div style={{ margin: "8px 0 6px", background: "linear-gradient(135deg,#FFF8F3,#FFF1E8)", border: "1.5px solid #FDDCB8", borderRadius: 16, padding: "14px 14px 10px" }}><div style={{ fontSize: 13, fontWeight: 800, color: "#C2410C", marginBottom: 10 }}>⏰ 집중 과제</div>{focus.map(t => { const cat = CATS[t.cat]; const d = t.subs.filter(s => s.done).length; const next = t.subs.find(s => !s.done); return <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #FDDCB850" }}><span style={{ fontSize: 12, fontWeight: 800, color: ddayColor(t.due), minWidth: 40, textAlign: "center", background: dday(t.due) <= 0 ? "#FEE2E2" : "#FFF", padding: "3px 6px", borderRadius: 6 }}>{ddayLabel(t.due)}</span><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>{next && <div style={{ fontSize: 11.5, color: "#D97706", marginTop: 2 }}>→ {next.t}</div>}</div><span style={{ fontSize: 11, fontWeight: 700, color: cat.color }}>{d}/{t.subs.length}</span></div>; })}</div>}

        {/* AI */}
        {!search && <>
          <div style={{ margin: "8px 0 6px" }}><button onClick={doReview} style={{ width: "100%", padding: 12, borderRadius: 14, border: "1.5px solid #E0E7FF", background: showReview ? "#EEF2FF" : "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "#4338CA" }}>📊 주간 리뷰</button></div>
          {showReview && <div style={{ background: "#fff", border: "1.5px solid #E0E7FF", borderRadius: 16, padding: 16, marginBottom: 8 }}>{reviewLoad ? <div style={{ color: "#4338CA", fontSize: 13 }}><span className="ai-spin">⏳</span> 분석 중...</div> : <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{review}</div>}</div>}
          <div style={{ display: "flex", gap: 8, margin: "4px 0 8px" }}><button onClick={doEvents} style={{ flex: 1, padding: 12, borderRadius: 14, border: "1.5px solid #FDDCB8", background: showEvents ? "#FFF8F3" : "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: "#C2410C" }}>🎯 추천 이벤트</button><button onClick={doTrends} style={{ flex: 1, padding: 12, borderRadius: 14, border: "1.5px solid #A7F3D0", background: showTrends ? "#ECFDF5" : "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: "#065F46" }}>🌐 업계 동향</button></div>
          {showEvents && <div style={{ background: "#fff", border: "1.5px solid #FDDCB8", borderRadius: 16, padding: 16, marginBottom: 8 }}>{eventsLoad ? <div style={{ color: "#D97706", fontSize: 13 }}><span className="ai-spin">⏳</span></div> : <div style={{ fontSize: 13, color: "#44403C", lineHeight: 1.85, whiteSpace: "pre-wrap", padding: "12px 14px", background: "#FFFBEB", borderRadius: 10, border: "1px solid #FDE68A" }}>{events}</div>}</div>}
          {showTrends && <div style={{ background: "#fff", border: "1.5px solid #A7F3D0", borderRadius: 16, padding: 16, marginBottom: 8 }}>{trendsLoad ? <div style={{ color: "#059669", fontSize: 13 }}><span className="ai-spin">⏳</span></div> : <div style={{ fontSize: 13, color: "#1F2937", lineHeight: 1.85, whiteSpace: "pre-wrap", padding: "12px 14px", background: "#F0FDF4", borderRadius: 10, border: "1px solid #D1FAE5" }}>{trends}</div>}</div>}
        </>}

        {/* Filters */}
        <div style={{ display: "flex", gap: 5, padding: "6px 0 4px", overflowX: "auto" }}>
          <Pill active={filter === "all"} onClick={() => setFilter("all")} color="#475569">전체 {vis.length}</Pill>
          {Object.entries(CATS).map(([k, v]) => <Pill key={k} active={filter === k} onClick={() => setFilter(filter === k ? "all" : k)} color={v.color}>{v.icon}</Pill>)}
        </div>
        <div style={{ display: "flex", gap: 12, padding: "4px 0 8px" }}>
          {completedCount > 0 && <button onClick={() => setHideCompleted(!hideCompleted)} style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>✅ 완료과제 {completedCount}건 {hideCompleted ? "보기" : "숨김"}</button>}
          {trashedTasks.length > 0 && <button onClick={() => setShowTrash(!showTrash)} style={{ fontSize: 12, color: "#D1D5DB", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>🗑 휴지통 {trashedTasks.length}건</button>}
        </div>

        {/* Trash */}
        {showTrash && trashedTasks.length > 0 && <div style={{ marginBottom: 12, padding: "12px 14px", background: "#FAFAFA", borderRadius: 14, border: "1px solid #EAECF0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 10 }}>🗑 휴지통</div>
          {trashedTasks.map(t => <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
            <span style={{ flex: 1, fontSize: 13, color: "#9CA3AF" }}>{t.title}</span>
            <button onClick={() => restore(t.id)} style={{ fontSize: 11, color: "#3B82F6", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>복원</button>
            <button onClick={() => permDel(t.id)} style={{ fontSize: 11, color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>영구삭제</button>
          </div>)}
        </div>}

        <button onClick={() => setShowAdd(true)} style={{ position: "fixed", bottom: 24, right: 24, width: 58, height: 58, borderRadius: "50%", background: "linear-gradient(135deg,#FF6B35,#FF8F5E)", color: "#fff", border: "none", fontSize: 30, cursor: "pointer", boxShadow: "0 6px 24px rgba(255,107,53,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>

        {/* Task list */}
        <div style={{ paddingBottom: 80 }}>
          {list.length === 0 && <div style={{ textAlign: "center", padding: 48, color: "#B0B0B0", fontSize: 14 }}>{search ? "검색 결과 없음" : "등록된 과제가 없습니다"}</div>}
          {list.map(t => <TaskTree key={t.id} task={t} onChange={upd} onSoftDelete={softDel} onComplete={complete} onShowRecur={id => setRecurModal(id)} coaches={branchCoaches} branchName={branchName} commentSeen={commentSeen[t.id] || 0} />)}
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && <div style={{ position: "fixed", inset: 0, background: "rgba(10,14,26,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 999 }} onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
        <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "24px 20px 34px", width: "100%", maxWidth: 500, maxHeight: "88vh", overflowY: "auto", animation: "slideUp .3s ease" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#E5E7EB", margin: "0 auto 20px" }} />
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>새 과제 <span style={{ fontSize: 12, background: "linear-gradient(135deg,#FF6B35,#FF8F5E)", color: "#fff", padding: "3px 12px", borderRadius: 8, fontWeight: 700, marginLeft: 6 }}>📍 {branchName}</span></div>
          <label style={lbl}>과제명</label><input value={nf.title} onChange={e => setNf(p => ({ ...p, title: e.target.value }))} placeholder="예: 4월 회원 재등록 캠페인" style={inp} />
          <div style={{ display: "flex", gap: 8 }}><div style={{ flex: 1 }}><label style={lbl}>분야</label><select value={nf.cat} onChange={e => setNf(p => ({ ...p, cat: e.target.value }))} style={inp}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</select></div><div style={{ flex: 1 }}><label style={lbl}>우선순위</label><select value={nf.pri} onChange={e => setNf(p => ({ ...p, pri: e.target.value }))} style={inp}><option value="high">🔴 긴급</option><option value="mid">🟡 보통</option><option value="low">⚪ 낮음</option></select></div></div>
          <div style={{ display: "flex", gap: 8 }}><div style={{ flex: 1 }}><label style={lbl}>마감일</label><input type="date" value={nf.due} onChange={e => setNf(p => ({ ...p, due: e.target.value }))} style={inp} /></div><div style={{ flex: 1 }}><label style={lbl}>반복</label><select value={nf.recur} onChange={e => setNf(p => ({ ...p, recur: e.target.value }))} style={inp}><option value="none">없음</option><option value="weekly">매주</option><option value="biweekly">격주</option><option value="monthly">매월</option></select></div></div>
          <label style={lbl}>담당</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{branchCoaches.filter(c => c.role === "coach").map(c => { const on = nf.assignees.includes(c.id); return <button key={c.id} onClick={() => setNf(p => ({ ...p, assignees: on ? p.assignees.filter(x => x !== c.id) : [...p.assignees, c.id] }))} style={{ padding: "6px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: `2px solid ${on ? "#FF6B35" : "#E5E7EB"}`, background: on ? "#FFF5F0" : "#fff", color: on ? "#FF6B35" : "#6B7280" }}>{c.emoji} {c.name}</button>; })}</div>
          <label style={lbl}>세부과제 <span style={{ fontWeight: 400, color: "#bbb" }}>(한 줄에 하나씩)</span></label><textarea value={nf.subsText} onChange={e => setNf(p => ({ ...p, subsText: e.target.value }))} placeholder={"리스트 추출\n개별 연락\n결과 집계"} style={{ ...inp, minHeight: 80, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}><button onClick={() => setShowAdd(false)} style={{ ...btnS, padding: 13, fontSize: 15 }}>취소</button><button onClick={add} style={{ ...btnP, padding: 13, fontSize: 15 }}>추가</button></div>
        </div>
      </div>}

      {showAdmin && <AdminPanel branches={branches} coaches={coaches} onClose={() => setShowAdmin(false)} refreshData={refreshData} />}
      {recurModal && <RecurModal task={allTasks.find(t => t.id === recurModal)} onRecreate={doRecreate} onFinish={() => { complete(recurModal); setRecurModal(null); }} onCancel={() => setRecurModal(null)} />}
    </div>
  );
}

/* ─── Root ─── */
export default function App() {
  const [me, setMe] = useState(null);
  const [coaches, setCoaches] = useState([]);
  const [branches, setBranches] = useState([]);
  const [checking, setChecking] = useState(true);
  useEffect(() => { (async () => {
    const [c, b] = await Promise.all([db.loadCoaches(), db.loadBranches()]);
    setCoaches(c); setBranches(b);
    const sid = localStorage.getItem("gh-coach-id");
    if (sid) { const f = c.find(x => x.id === sid); if (f) setMe(f); }
    setChecking(false);
  })(); }, []);
  if (checking) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0A0E1A", color: "#6B7280" }}>로딩 중...</div>;
  if (!me) return <LoginScreen onLogin={c => setMe(c)} />;
  return <AuthCtx.Provider value={me}><Dashboard coaches={coaches} branches={branches} /></AuthCtx.Provider>;
}
