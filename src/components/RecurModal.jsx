import { RECUR_L, nextDue } from "../lib/constants";
import { Button, ModalSheet } from "./Common";

export default function RecurModal({ task, onRecreate, onFinish, onCancel }) {
  if (!task) return null;
  return (
    <ModalSheet onClose={onCancel} maxWidth={360} align="center" padding="28px 24px">
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔁</div>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>반복 과제 완료!</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 6 }}>&quot;{task.title}&quot;</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>{RECUR_L[task.recur]}{task.due ? ` · 다음: ${nextDue(task.due, task.recur)}` : ""}</div>
        <div className="stack-grid" style={{ gap: 8 }}>
          <Button onClick={onRecreate} block>다음 반복도 생성</Button>
          <Button onClick={onFinish} variant="secondary" block>이번 것만 완료</Button>
        </div>
      </div>
    </ModalSheet>
  );
}
