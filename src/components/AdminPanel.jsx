import { useState } from "react";
import { BR_COLORS, EMOJIS, uid } from "../lib/constants";
import { db } from "../lib/db";
import { useConfirm } from "../confirm";
import { useToast } from "../toast";
import { btnD, btnP, btnS, inp, lbl } from "../lib/styles";

export default function AdminPanel({ branches, coaches, onClose, refreshData }) {
  const [tab, setTab] = useState("branches");
  const [addB, setAddB] = useState(false);
  const [nbN, setNbN] = useState("");
  const [nbC, setNbC] = useState(BR_COLORS[1]);
  const [addC, setAddC] = useState(false);
  const [nc, setNc] = useState({ name: "", new_pin: "", emoji: "🏋️", branch_id: "" });
  const [editC, setEditC] = useState(null);
  const confirmAction = useConfirm();
  const toast = useToast();

  const doAddB = async () => {
    if (!nbN.trim()) return;
    await db.saveBranch({ id: `b-${uid()}`, name: nbN.trim(), color: nbC });
    setNbN("");
    setAddB(false);
    refreshData();
  };
  const delB = async (id) => {
    const branch = branches.find((b) => b.id === id);
    const ok = await confirmAction({
      title: "지점을 삭제할까요?",
      message: `${branch?.name || "이 지점"}을(를) 삭제하면 연결된 운영 데이터에 영향을 줄 수 있어요.`,
      details: "지점에 코치나 과제가 남아 있다면 먼저 정리한 뒤 삭제해 주세요.",
      confirmLabel: "지점 삭제",
      tone: "danger",
    });
    if (!ok) return;
    await db.deleteBranch(id);
    toast.success("지점을 삭제했어요.", { title: "삭제 완료" });
    refreshData();
  };
  const doAddC = async () => {
    if (!nc.name.trim() || nc.new_pin.length !== 4) return;
    await db.saveCoach({ id: `coach-${uid()}`, name: nc.name.trim(), new_pin: nc.new_pin, role: "coach", emoji: nc.emoji, branch_id: nc.branch_id || branches[0]?.id });
    setNc({ name: "", new_pin: "", emoji: "🏋️", branch_id: "" });
    setAddC(false);
    refreshData();
  };
  const saveEdit = async () => {
    if (!editC) return;
    await db.saveCoach(editC);
    setEditC(null);
    refreshData();
  };
  const delC = async (id) => {
    const coach = coaches.find((c) => c.id === id);
    const ok = await confirmAction({
      title: "코치를 삭제할까요?",
      message: `${coach?.name || "선택한 코치"} 계정을 삭제하면 이 코치로 로그인할 수 없어요.`,
      details: "담당 과제가 남아 있다면 다른 코치에게 먼저 배정해 주세요.",
      confirmLabel: "코치 삭제",
      tone: "danger",
    });
    if (!ok) return;
    await db.deleteCoach(id);
    toast.success("코치를 삭제했어요.", { title: "삭제 완료" });
    refreshData();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,14,26,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 500, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", animation: "slideUp .3s ease" }}>
        <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#E5E7EB", margin: "0 auto 16px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>⚙️ 센터 관리</span>
            <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "#6B7280", fontWeight: 600 }}>닫기</button>
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {[ ["branches", "📍 지점"], ["coaches", "🏋️ 코치"] ].map(([k, v]) => (
              <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", background: tab === k ? "#0A0E1A" : "#F3F4F6", color: tab === k ? "#fff" : "#6B7280" }}>{v}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>
          {tab === "branches" && (
            <>
              {branches.map((b) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#FAFAFA", borderRadius: 12, marginBottom: 8, border: "1px solid #EAECF0" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: b.color }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{b.name}</span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>{coaches.filter((c) => c.branch_id === b.id).length}명</span>
                  <button onClick={() => delB(b.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#D1D5DB", fontSize: 14 }}>🗑</button>
                </div>
              ))}
              {addB ? (
                <div style={{ padding: 16, background: "#F9FAFB", borderRadius: 14, border: "1.5px solid #E5E7EB", marginTop: 8 }}>
                  <label style={lbl}>지점 이름</label>
                  <input value={nbN} onChange={(e) => setNbN(e.target.value)} placeholder="예: 검단점" style={inp} autoFocus />
                  <label style={{ ...lbl, marginTop: 12 }}>색상</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>{BR_COLORS.map((c) => <button key={c} onClick={() => setNbC(c)} style={{ width: 32, height: 32, borderRadius: 10, background: c, border: nbC === c ? "3px solid #0A0E1A" : "2px solid transparent", cursor: "pointer" }} />)}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}><button onClick={() => setAddB(false)} style={btnS}>취소</button><button onClick={doAddB} style={btnP}>추가</button></div>
                </div>
              ) : <button onClick={() => setAddB(true)} style={btnD}>+ 새 지점</button>}
            </>
          )}
          {tab === "coaches" && (
            <>
              {editC && (
                <div style={{ padding: 16, background: "#FFF8F3", borderRadius: 14, border: "1.5px solid #FDDCB8", marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#C2410C" }}>✏️ {editC.name} 수정</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}><label style={lbl}>이름</label><input value={editC.name} onChange={(e) => setEditC({ ...editC, name: e.target.value })} style={inp} /></div>
                    <div style={{ flex: 1 }}><label style={lbl}>새 PIN(선택)</label><input value={editC.new_pin || ""} onChange={(e) => setEditC({ ...editC, new_pin: e.target.value.replace(/\D/g, "").slice(0, 4) })} style={inp} placeholder="변경할 때만 입력" /></div>
                  </div>
                  <label style={lbl}>지점</label>
                  <select value={editC.branch_id || ""} onChange={(e) => setEditC({ ...editC, branch_id: e.target.value })} style={inp}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                  <label style={lbl}>이모지</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>{EMOJIS.map((em) => <button key={em} onClick={() => setEditC({ ...editC, emoji: em })} style={{ fontSize: 20, padding: "4px 6px", borderRadius: 8, border: editC.emoji === em ? "2px solid #FF6B35" : "2px solid #E5E7EB", background: editC.emoji === em ? "#FFF5F0" : "#fff", cursor: "pointer" }}>{em}</button>)}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}><button onClick={() => setEditC(null)} style={btnS}>취소</button><button onClick={saveEdit} style={btnP}>저장</button></div>
                </div>
              )}
              {coaches.filter((c) => c.role === "coach").map((c) => {
                const br = branches.find((b) => b.id === c.branch_id);
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#FAFAFA", borderRadius: 12, marginBottom: 8, border: "1px solid #EAECF0" }}>
                    <span style={{ fontSize: 20 }}>{c.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: 11, color: "#6B7280", background: "#F3F4F6", padding: "1px 8px", borderRadius: 5 }}>PIN: 보호됨</span>
                        {br && <span style={{ fontSize: 11, color: br.color, background: `${br.color}10`, padding: "1px 8px", borderRadius: 5, fontWeight: 600 }}>{br.name}</span>}
                      </div>
                    </div>
                    <button onClick={() => setEditC({ ...c, new_pin: "" })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#9CA3AF" }}>✏️</button>
                    <button onClick={() => delC(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#D1D5DB", fontSize: 13 }}>🗑</button>
                  </div>
                );
              })}
              {addC ? (
                <div style={{ padding: 16, background: "#F9FAFB", borderRadius: 14, border: "1.5px solid #E5E7EB", marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}><label style={lbl}>이름</label><input value={nc.name} onChange={(e) => setNc((p) => ({ ...p, name: e.target.value }))} style={inp} autoFocus /></div>
                    <div style={{ flex: 1 }}><label style={lbl}>PIN</label><input value={nc.new_pin} onChange={(e) => setNc((p) => ({ ...p, new_pin: e.target.value.replace(/\D/g, "").slice(0, 4) }))} style={inp} maxLength={4} type="tel" /></div>
                  </div>
                  <label style={lbl}>지점</label>
                  <select value={nc.branch_id || branches[0]?.id || ""} onChange={(e) => setNc((p) => ({ ...p, branch_id: e.target.value }))} style={inp}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                  <label style={lbl}>이모지</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>{EMOJIS.map((em) => <button key={em} onClick={() => setNc((p) => ({ ...p, emoji: em }))} style={{ fontSize: 20, padding: "4px 6px", borderRadius: 8, border: nc.emoji === em ? "2px solid #FF6B35" : "2px solid #E5E7EB", background: nc.emoji === em ? "#FFF5F0" : "#fff", cursor: "pointer" }}>{em}</button>)}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}><button onClick={() => setAddC(false)} style={btnS}>취소</button><button onClick={doAddC} style={btnP}>추가</button></div>
                </div>
              ) : <button onClick={() => setAddC(true)} style={btnD}>+ 새 코치</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
