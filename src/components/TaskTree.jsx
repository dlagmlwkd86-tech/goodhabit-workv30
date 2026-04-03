import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth";
import { advicePrompt, callAI } from "../lib/ai";
import { CATS, PRI, RECUR_L, dday, ddayColor, ddayLabel, nowIso, timeNow, uid } from "../lib/constants";
import { btnP, btnS, inp, lbl, surface } from "../lib/styles";
import { ActBtn, Badge, CopyButton, EmptyState, Icon } from "./Common";

function TaskEditPanel({ task, onSave, onCancel, coaches }) {
  const [ed, setEd] = useState({ title: task.title, due: task.due || "", pri: task.pri, cat: task.cat, recur: task.recur, assignees: task.assignees || [], memo: task.memo || "" });
  return (
    <div style={{ padding: "14px 16px 16px", borderTop: "1px solid #E2E8F0", background: "linear-gradient(180deg,#FFFFFF,#F8FAFC)" }}>
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 10, color: "#334155", display: "flex", alignItems: "center", gap: 8 }}><Icon name="edit" size={14} /> 과제 수정</div>
      <label style={lbl}>과제명</label><input value={ed.title} onChange={(e) => setEd((p) => ({ ...p, title: e.target.value }))} style={inp} />
      <div style={{ display: "flex", gap: 8 }}><div style={{ flex: 1 }}><label style={lbl}>분야</label><select value={ed.cat} onChange={(e) => setEd((p) => ({ ...p, cat: e.target.value }))} style={inp}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</select></div><div style={{ flex: 1 }}><label style={lbl}>우선순위</label><select value={ed.pri} onChange={(e) => setEd((p) => ({ ...p, pri: e.target.value }))} style={inp}><option value="high">🔴 긴급</option><option value="mid">🟡 보통</option><option value="low">⚪ 낮음</option></select></div></div>
      <div style={{ display: "flex", gap: 8 }}><div style={{ flex: 1 }}><label style={lbl}>마감일</label><input type="date" value={ed.due} onChange={(e) => setEd((p) => ({ ...p, due: e.target.value }))} style={inp} /></div><div style={{ flex: 1 }}><label style={lbl}>반복</label><select value={ed.recur} onChange={(e) => setEd((p) => ({ ...p, recur: e.target.value }))} style={inp}><option value="none">없음</option><option value="weekly">매주</option><option value="biweekly">격주</option><option value="monthly">매월</option></select></div></div>
      <label style={lbl}>담당</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{coaches.filter((c) => c.role === "coach").map((c) => { const on = ed.assignees.includes(c.id); return <button key={c.id} onClick={() => setEd((p) => ({ ...p, assignees: on ? p.assignees.filter((x) => x !== c.id) : [...p.assignees, c.id] }))} style={{ padding: "6px 11px", borderRadius: 12, fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: `1.5px solid ${on ? "#FDBA74" : "#E2E8F0"}`, background: on ? "linear-gradient(135deg,#FFF7ED,#FFFFFF)" : "rgba(255,255,255,0.88)", color: on ? "#C2410C" : "#475569" }}>{c.emoji} {c.name}</button>; })}</div>
      <label style={lbl}>메모</label><input value={ed.memo} onChange={(e) => setEd((p) => ({ ...p, memo: e.target.value }))} placeholder="참고사항" style={inp} />
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}><button onClick={onCancel} style={btnS}>취소</button><button onClick={() => onSave({ ...task, ...ed })} style={btnP}>저장</button></div>
    </div>
  );
}

function SubNode({ sub, isLast, isFirst, color, onToggle, onDelete, onMoveUp, onMoveDown, count }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", minHeight: sub.done && sub.doneBy ? 50 : 42 }}>
      <div style={{ width: 30, position: "relative", flexShrink: 0 }}>
        <div style={{ position: "absolute", left: 14, top: 0, bottom: isLast ? "50%" : 0, width: 2, background: `${color}24` }} />
        <div style={{ position: "absolute", left: 14, top: "50%", width: 12, height: 2, background: `${color}24` }} />
        <div style={{ position: "absolute", left: 23, top: "50%", transform: "translate(-50%,-50%)", width: 8, height: 8, borderRadius: "50%", background: sub.done ? color : "#fff", border: `2px solid ${sub.done ? color : `${color}50`}`, zIndex: 1 }} />
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", gap: 7, padding: "7px 7px 7px 4px", borderRadius: 12 }}>
        <div onClick={() => onToggle(sub.id)} style={{ width: 19, height: 19, borderRadius: 6, flexShrink: 0, marginTop: 1, border: `2px solid ${sub.done ? "#34D399" : "#CBD5E1"}`, background: sub.done ? "#34D399" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: sub.done ? "0 8px 16px rgba(16,185,129,0.2)" : "none" }}>{sub.done && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onToggle(sub.id)}><span style={{ fontSize: 13.5, fontWeight: 600, color: sub.done ? "#94A3B8" : "#1E293B", textDecoration: sub.done ? "line-through" : "none" }}>{sub.t}</span>{sub.done && sub.doneBy && <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 3 }}>{sub.doneEmoji} {sub.doneBy} · {sub.doneAt}</div>}</div>
        {count > 1 && <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>{!isFirst && <button onClick={() => onMoveUp(sub.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#CBD5E1", padding: "0 3px" }}>▲</button>}{!isLast && <button onClick={() => onMoveDown(sub.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#CBD5E1", padding: "0 3px" }}>▼</button>}</div>}
        <button onClick={() => onDelete(sub.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", fontSize: 12, marginTop: 2, flexShrink: 0 }}>✕</button>
      </div>
    </div>
  );
}

function Comments({ comments, onAdd, color }) {
  const me = useAuth();
  const [text, setText] = useState("");
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [comments.length]);
  const submit = () => {
    if (!text.trim()) return;
    onAdd({ id: uid(), coachId: me.id, name: me.name, emoji: me.emoji, role: me.role, text: text.trim(), time: timeNow(), createdAt: nowIso() });
    setText("");
  };

  return (
    <div style={{ padding: "12px 16px 14px", borderTop: "1px solid #E2E8F0", background: "linear-gradient(180deg,#FFFFFF,#F8FAFC)" }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#64748B", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><Icon name="comment" size={14} /> 코멘트</div>
      <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 10 }}>
        {comments.length === 0 && <EmptyState icon="comment" title="아직 코멘트가 없어요" message="이 과제 안에서 바로 지시나 확인 메시지를 남길 수 있어요." tone="blue" compact style={{ padding: "18px 16px", minHeight: 0 }} />}
        {comments.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 8, flexDirection: c.coachId === me.id ? "row-reverse" : "row" }}>
            <div style={{ maxWidth: "82%", padding: "9px 12px", borderRadius: 16, fontSize: 13, lineHeight: 1.55, background: c.role === "owner" ? "#EEF2FF" : "#F0FDF4", border: `1px solid ${c.role === "owner" ? "#C7D2FE" : "#BBF7D0"}` }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: c.role === "owner" ? "#4338CA" : "#059669", marginBottom: 3 }}>{c.emoji} {c.name}</div>
              {c.text}
              <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4, textAlign: "right" }}>{c.time}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontSize: 12, color: "#64748B", fontWeight: 800, flexShrink: 0 }}>{me.emoji} {me.name}</span><input value={text} onChange={(e) => setText(e.target.value)} placeholder="메시지..." onKeyDown={(e) => { if (e.key === "Enter") submit(); }} style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 13, fontFamily: "inherit", outline: "none", background: "rgba(255,255,255,0.9)" }} /><button onClick={submit} style={{ padding: "10px 14px", borderRadius: 12, border: "none", background: `linear-gradient(135deg,${color},${color}CC)`, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>전송</button></div>
    </div>
  );
}

export default function TaskTree({ task, onChange, onSoftDelete, onComplete, onShowRecur, coaches, branchName, commentSeen, onMarkCommentsSeen }) {
  const me = useAuth();
  const catIconName = task?.cat === "member" ? "users" : task?.cat === "coach" ? "coach" : task?.cat === "marketing" ? "megaphone" : "settings";
  const priTone = task?.pri === "high" ? "red" : task?.pri === "mid" ? "orange" : "slate";
  const priIcon = task?.pri === "high" ? "alert" : task?.pri === "mid" ? "sparkle" : "check";
  const [ai, setAi] = useState(null);
  const [aiLoad, setAiLoad] = useState(false);
  const [panel, setPanel] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newSub, setNewSub] = useState("");
  const cat = CATS[task.cat];
  const overdue = task.due && dday(task.due) !== null && dday(task.due) < 0;
  const done = task.subs.filter((s) => s.done).length;
  const total = task.subs.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const allDone = total > 0 && done === total;
  const newCmt = (task.comments || []).length - (commentSeen || 0);
  const names = (task.assignees || []).map((id) => coaches.find((c) => c.id === id)?.name).filter(Boolean).join(", ") || "전체";

  const toggleSub = (sid) => onChange({ ...task, subs: task.subs.map((s) => {
    if (s.id !== sid) return s;
    const nd = !s.done;
    return nd ? { ...s, done: true, doneBy: me.name, doneEmoji: me.emoji, doneAt: timeNow(), doneAtISO: nowIso() } : { ...s, done: false, doneBy: null, doneEmoji: null, doneAt: null, doneAtISO: null };
  }) });

  const moveSub = (sid, dir) => {
    const i = task.subs.findIndex((s) => s.id === sid);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= task.subs.length) return;
    const ns = [...task.subs];
    [ns[i], ns[j]] = [ns[j], ns[i]];
    onChange({ ...task, subs: ns });
  };

  const addSub = () => {
    if (!newSub.trim()) return;
    onChange({ ...task, subs: [...task.subs, { id: uid(), t: newSub.trim(), done: false, doneAtISO: null }] });
    setNewSub("");
    setAdding(false);
  };

  useEffect(() => {
    if (panel === "comments") onMarkCommentsSeen?.(task.id, (task.comments || []).length);
  }, [panel, task.id, task.comments, onMarkCommentsSeen]);

  const doAI = async () => {
    if (panel === "ai") {
      setPanel(null);
      return;
    }
    setPanel("ai");
    if (ai) return;
    setAiLoad(true);
    try {
      setAi(await callAI(advicePrompt(task, names, branchName)));
    } catch (e) {
      setAi(`오류: ${e.message}`);
    }
    setAiLoad(false);
  };

  return (
    <div className="task-card-wrap" style={{ marginBottom: 12 }}>
      <div className="glass-card task-card" style={{ ...surface, background: allDone ? "linear-gradient(135deg,#F0FDF4,#FFFFFF)" : "rgba(255,255,255,0.9)", borderColor: allDone ? "#BBF7D0" : overdue && !allDone ? "#FECACA" : "#E2E8F0", opacity: task.completed ? 0.58 : 1, overflow: "hidden" }}>
        <div className="task-card-head" onClick={() => onChange({ ...task, open: !task.open })} style={{ display: "flex", alignItems: "center", cursor: "pointer", padding: "16px 14px 12px", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ width: 24, height: 24, borderRadius: 8, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", transform: task.open ? "rotate(90deg)" : "none", transition: "transform .18s ease" }}><svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M3 1L7 5L3 9" stroke={cat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <div style={{ width: 5, height: 34, borderRadius: 999, background: `linear-gradient(180deg,${cat.color},${cat.color}AA)` }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}><span style={{ fontSize: 14.5, fontWeight: 900, color: task.completed ? "#94A3B8" : "#0F172A", textDecoration: task.completed ? "line-through" : "none" }}>{task.title}</span>{task.recur !== "none" && <Badge tone="violet" icon="repeat" style={{ padding: "4px 9px", fontSize: 10.5 }}>{RECUR_L[task.recur]}</Badge>}{task.completed && <Badge tone="green" icon="check" style={{ padding: "4px 9px", fontSize: 10.5 }}>완료</Badge>}</div>
            <div className="task-meta-row" style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Badge tone={task.cat === "member" ? "blue" : task.cat === "coach" ? "green" : task.cat === "marketing" ? "orange" : "violet"} icon={catIconName} style={{ boxShadow: "0 8px 14px rgba(15,23,42,0.05)" }}>{cat.label}</Badge>
              <Badge tone={priTone} icon={priIcon} style={{ boxShadow: "0 8px 14px rgba(15,23,42,0.05)" }}>{PRI[task.pri].label}</Badge>
              {task.due && <Badge tone={dday(task.due) <= 0 ? "red" : dday(task.due) <= 3 ? "orange" : "slate"} icon="calendar" style={{ color: ddayColor(task.due), boxShadow: "0 8px 14px rgba(15,23,42,0.05)" }}>{ddayLabel(task.due)}</Badge>}
              {(task.assignees || []).map((aid) => { const c = coaches.find((x) => x.id === aid); return c ? <Badge key={aid} tone="slate" style={{ boxShadow: "0 8px 14px rgba(15,23,42,0.05)" }}>{c.emoji} {c.name}</Badge> : null; })}
            </div>
          </div>
          <div className="task-progress-ring" style={{ position: "relative", width: 54, height: 54, flexShrink: 0 }}><svg width="54" height="54" viewBox="0 0 54 54" style={{ transform: "rotate(-90deg)" }}><circle cx="27" cy="27" r="21" fill="none" stroke="#E2E8F0" strokeWidth="5" /><circle cx="27" cy="27" r="21" fill="none" stroke={allDone ? "#10B981" : cat.color} strokeWidth="5" strokeDasharray={`${2 * Math.PI * 21}`} strokeDashoffset={`${2 * Math.PI * 21 * (1 - pct / 100)}`} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s" }} /></svg><span style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 900, color: "#334155", lineHeight: 1.05 }}><strong style={{ fontSize: 11.5 }}>{done}/{total}</strong><span style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", marginTop: 2 }}>완료</span></span></div>
        </div>
        {task.memo && <div style={{ margin: "0 14px 8px 50px", padding: "8px 11px", background: "rgba(248,250,252,0.92)", borderRadius: 12, fontSize: 12, color: "#64748B", borderLeft: `3px solid ${cat.color}35`, display: "flex", alignItems: "center", gap: 8 }}><Icon name="edit" size={13} /> {task.memo}</div>}
        {allDone && !task.completed && <div style={{ margin: "0 14px 10px", padding: "11px 14px", background: "linear-gradient(135deg,#F0FDF4,#ECFDF5)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, border: "1px solid #BBF7D0" }}><span style={{ fontSize: 12, fontWeight: 800, color: "#059669", display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name="check" size={14} /> 모든 세부과제 완료!</span><button onClick={(e) => { e.stopPropagation(); if (task.recur !== "none") onShowRecur(task.id); else onComplete(task.id); }} style={{ padding: "8px 12px", borderRadius: 11, border: "none", background: "#059669", color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{task.recur !== "none" ? <><Icon name="repeat" size={12} /> 처리 선택</> : <><Icon name="check" size={12} /> 완료 처리</>}</button></div>}
        <div className={`expand-shell ${task.open ? "is-open" : ""}`}>
          <div className="expand-inner">
            <div style={{ paddingLeft: 34, paddingRight: 10, paddingBottom: 6 }}>{task.subs.map((sub, i) => <SubNode key={sub.id} sub={sub} isFirst={i === 0} isLast={i === task.subs.length - 1 && !adding} color={cat.color} onToggle={toggleSub} onDelete={(sid) => onChange({ ...task, subs: task.subs.filter((s) => s.id !== sid) })} onMoveUp={(id) => moveSub(id, -1)} onMoveDown={(id) => moveSub(id, 1)} count={task.subs.length} />)}{adding ? <div style={{ display: "flex", alignItems: "center", minHeight: 40 }}><div style={{ width: 30 }} /><div style={{ flex: 1, display: "flex", gap: 6, marginLeft: 4 }}><input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="세부과제..." onKeyDown={(e) => { if (e.key === "Enter") addSub(); if (e.key === "Escape") { setAdding(false); setNewSub(""); } }} autoFocus style={{ flex: 1, padding: "8px 11px", borderRadius: 12, border: `1.5px solid ${cat.color}35`, fontSize: 13, fontFamily: "inherit", outline: "none", background: "rgba(248,250,252,0.95)" }} /><button onClick={addSub} style={{ padding: "8px 11px", borderRadius: 11, border: "none", background: `linear-gradient(135deg,${cat.color},${cat.color}CC)`, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>추가</button></div></div> : <div style={{ paddingLeft: 30 }}><button onClick={() => setAdding(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: cat.color, fontFamily: "inherit", padding: "5px 0", fontWeight: 800 }}><Icon name="plus" size={13} /> 세부과제 추가</button></div>}</div>
          </div>
        </div>
        <div style={{ display: "flex", borderTop: "1px solid #EEF2F7", marginTop: 4, background: "rgba(248,250,252,0.72)" }}>
          <ActBtn onClick={doAI} active={panel === "ai"} icon="bulb" label="AI" />
          <div style={{ width: 1, background: "#EEF2F7" }} />
          <ActBtn onClick={() => setPanel(panel === "edit" ? null : "edit")} active={panel === "edit"} icon="edit" label="수정" />
          <div style={{ width: 1, background: "#EEF2F7" }} />
          <ActBtn onClick={() => setPanel(panel === "comments" ? null : "comments")} active={panel === "comments"} icon="comment" label="코멘트" badge={newCmt} />
          <div style={{ width: 1, background: "#EEF2F7" }} />
          <button onClick={() => onSoftDelete(task.id)} style={{ padding: "10px 13px", border: "none", cursor: "pointer", fontSize: 13, color: "#CBD5E1", fontFamily: "inherit", background: "transparent" }}><Icon name="trash" size={14} /></button>
        </div>
        <div className={`detail-shell ${panel === "ai" ? "is-open" : ""}`}>
          <div className="detail-inner">
            {panel === "ai" && <div style={{ padding: "14px 16px 16px", borderTop: "1px solid #FDE68A", background: "linear-gradient(180deg,#FFFBEB,#FFFDFA)" }}>{aiLoad ? <div style={{ color: "#D97706", fontSize: 13 }}><span className="ai-spin"><Icon name="sparkle" size={14} /></span> 생성 중...</div> : ai && <><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}><div style={{ fontSize: 12, fontWeight: 900, color: "#92400E", display: "flex", alignItems: "center", gap: 8 }}><Icon name="bulb" size={13} /> 실행 가이드</div><CopyButton text={ai} tone="amber" /></div><div style={{ fontSize: 13, color: "#44403C", lineHeight: 1.85, whiteSpace: "pre-wrap", padding: "13px 14px", background: "#fff", borderRadius: 14, border: "1px solid #FDE68A", boxShadow: "0 10px 24px rgba(245,158,11,0.08)" }}>{ai}</div></>}</div>}
          </div>
        </div>
        <div className={`detail-shell ${panel === "edit" ? "is-open" : ""}`}>
          <div className="detail-inner">
            {panel === "edit" && <TaskEditPanel task={task} onSave={(t) => { onChange(t); setPanel(null); }} onCancel={() => setPanel(null)} coaches={coaches} />}
          </div>
        </div>
        <div className={`detail-shell ${panel === "comments" ? "is-open" : ""}`}>
          <div className="detail-inner">
            {panel === "comments" && <Comments comments={task.comments || []} onAdd={(c) => onChange({ ...task, comments: [...(task.comments || []), c] })} color={cat.color} />}
          </div>
        </div>
      </div>
    </div>
  );
}
