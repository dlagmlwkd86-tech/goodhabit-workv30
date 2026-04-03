import { CATS } from "../lib/constants";
import { inp, lbl } from "../lib/styles";
import { Badge, Button, ModalSheet } from "./Common";

export default function AddTaskModal({ branchName, nf, setNf, branchCoaches, onClose, onAdd }) {
  return (
    <ModalSheet onClose={onClose} maxWidth={540}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 900, marginBottom: 6 }}>새 과제 만들기</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>오늘 할 일을 빠르게 등록해보세요.</div>
        </div>
        <Badge tone="amber">📍 {branchName}</Badge>
      </div>
      <label style={lbl}>과제명</label>
      <input value={nf.title} onChange={(e) => setNf((p) => ({ ...p, title: e.target.value }))} placeholder="예: 4월 회원 재등록 캠페인" style={inp} />
      <div className="two-col-grid">
        <div><label style={lbl}>분야</label><select value={nf.cat} onChange={(e) => setNf((p) => ({ ...p, cat: e.target.value }))} style={inp}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</select></div>
        <div><label style={lbl}>우선순위</label><select value={nf.pri} onChange={(e) => setNf((p) => ({ ...p, pri: e.target.value }))} style={inp}><option value="high">🔴 긴급</option><option value="mid">🟡 보통</option><option value="low">⚪ 낮음</option></select></div>
      </div>
      <div className="two-col-grid">
        <div><label style={lbl}>마감일</label><input type="date" value={nf.due} onChange={(e) => setNf((p) => ({ ...p, due: e.target.value }))} style={inp} /></div>
        <div><label style={lbl}>반복</label><select value={nf.recur} onChange={(e) => setNf((p) => ({ ...p, recur: e.target.value }))} style={inp}><option value="none">없음</option><option value="weekly">매주</option><option value="biweekly">격주</option><option value="monthly">매월</option></select></div>
      </div>
      <label style={lbl}>담당</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {branchCoaches.filter((c) => c.role === "coach").map((c) => {
          const on = nf.assignees.includes(c.id);
          return <Button key={c.id} onClick={() => setNf((p) => ({ ...p, assignees: on ? p.assignees.filter((x) => x !== c.id) : [...p.assignees, c.id] }))} variant={on ? "warm" : "secondary"} style={{ padding: "7px 12px", fontSize: 13 }}>{c.emoji} {c.name}</Button>;
        })}
      </div>
      <label style={lbl}>세부과제 <span style={{ fontWeight: 500, color: "#94A3B8" }}>(한 줄에 하나씩)</span></label>
      <textarea value={nf.subsText} onChange={(e) => setNf((p) => ({ ...p, subsText: e.target.value }))} placeholder={"리스트 추출\n개별 연락\n결과 집계"} style={{ ...inp, minHeight: 92, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 18 }}><Button onClick={onClose} variant="secondary" block style={{ padding: 13, fontSize: 15 }}>취소</Button><Button onClick={onAdd} block style={{ padding: 13, fontSize: 15 }}>추가</Button></div>
    </ModalSheet>
  );
}
