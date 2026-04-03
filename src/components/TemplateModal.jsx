import { CATS, RECUR_L, TEMPLATE_PRESETS } from "../lib/constants";
import { Badge, Button, ModalSheet } from "./Common";

export default function TemplateModal({ onClose, onUse }) {
  return (
    <ModalSheet onClose={onClose} maxWidth={500}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>📋 루틴 템플릿</div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>자주 쓰는 과제를 불러와 빠르게 등록하세요</div>
        </div>
        <Button onClick={onClose} variant="secondary">닫기</Button>
      </div>
      <div className="stack-grid" style={{ gap: 10 }}>
        {TEMPLATE_PRESETS.map((tp) => {
          const cat = CATS[tp.cat];
          return (
            <div key={tp.id} style={{ border: "1px solid #EAECF0", borderRadius: 16, padding: 14, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{tp.icon} {tp.title}</span>
                    <Badge style={{ background: cat.bg, color: cat.color, borderColor: "transparent", padding: "2px 6px", fontSize: 10 }}>{cat.label}</Badge>
                    <Badge tone="slate" style={{ padding: "2px 6px", fontSize: 10 }}>{tp.subs.length}개 세부과제</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6, lineHeight: 1.55 }}>{tp.memo}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>기본 마감: {tp.dueOffset === 0 ? "오늘" : `${tp.dueOffset}일 뒤`} · 반복: {RECUR_L[tp.recur]}</div>
                </div>
                <Button onClick={() => onUse(tp)} style={{ flexShrink: 0 }}>불러오기</Button>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {tp.subs.slice(0, 4).map((sub, idx) => <Badge key={idx} tone="slate" style={{ padding: "4px 8px", fontSize: 11 }}>{sub}</Badge>)}
                {tp.subs.length > 4 && <span style={{ fontSize: 11, color: "#9CA3AF", padding: "4px 2px" }}>+{tp.subs.length - 4}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </ModalSheet>
  );
}
