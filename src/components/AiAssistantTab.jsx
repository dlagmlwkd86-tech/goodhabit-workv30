import { useMemo, useState } from "react";
import { callAI, eventPrompt, memberMessagePrompt, reviewPrompt, trendsPrompt } from "../lib/ai";
import { Badge, Button, Card, CopyButton, EmptyState, ErrorBanner, Icon } from "./Common";
import { inp, lbl } from "../lib/styles";
import { useToast } from "../toast";

function ResultCard({ title, text, loading, tone = "slate" }) {
  const styles = {
    blue: { bd: "#C7D2FE", bg: "linear-gradient(135deg,#EEF2FF,#FFFFFF)", text: "#312E81", sub: "#4338CA" },
    amber: { bd: "#FDDCB8", bg: "linear-gradient(135deg,#FFF8F3,#FFFFFF)", text: "#9A3412", sub: "#C2410C" },
    green: { bd: "#A7F3D0", bg: "linear-gradient(135deg,#ECFDF5,#FFFFFF)", text: "#065F46", sub: "#047857" },
    slate: { bd: "#E2E8F0", bg: "linear-gradient(135deg,#F8FAFC,#FFFFFF)", text: "#334155", sub: "#475569" },
  }[tone];
  return (
    <Card style={{ background: styles.bg, borderColor: styles.bd, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 900, color: styles.text }}>{title}</div>
          <div style={{ fontSize: 11.5, color: styles.sub, marginTop: 4 }}>복붙해서 바로 활용할 수 있게 정리해드려요.</div>
        </div>
        {!!text && <CopyButton text={text} tone={tone} />}
      </div>
      {loading ? <div style={{ color: styles.text, fontSize: 13 }}><span className="ai-spin"><Icon name="sparkle" size={14} /></span> 생성 중...</div> : text ? <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{text}</div> : <EmptyState icon={tone === "amber" ? "sparkle" : tone === "blue" ? "chart" : tone === "green" ? "globe" : "robot"} title={`${title} 준비 전이에요`} message="버튼을 누르면 현장에서 바로 복붙해 쓸 수 있는 형태로 정리해드려요." tone={tone} compact style={{ marginTop: 4, minHeight: 0, padding: "22px 16px" }} />}
    </Card>
  );
}

function PrefToggle({ title, desc, checked, disabled, onChange }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: "14px 15px",
        borderRadius: 16,
        border: checked ? "1.5px solid #FDBA74" : "1.5px solid #E2E8F0",
        background: checked ? "linear-gradient(135deg,#FFF7ED,#FFFFFF)" : "rgba(255,255,255,0.82)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: "inherit",
      }}
    >
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 5, lineHeight: 1.5 }}>{desc}</div>
      </div>
      <div style={{
        width: 46,
        height: 28,
        borderRadius: 999,
        background: checked ? "var(--primary-gradient)" : "#E2E8F0",
        position: "relative",
        flexShrink: 0,
        transition: "all .2s ease",
        boxShadow: checked ? "var(--primary-shadow)" : "none",
      }}>
        <div style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
          transition: "all .2s ease",
        }} />
      </div>
    </button>
  );
}

function hourLabel(hour) {
  const suffix = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${suffix} ${displayHour}시`;
}

export default function AiAssistantTab({ branchName, visibleTasks, notifications }) {
  const [messageForm, setMessageForm] = useState({
    scenario: "휴면회원 재접촉",
    tone: "친근하고 부담 없는 톤",
    memberInfo: "2주째 미출석, 30대 여성, 무릎 불편감 있음",
    goal: "답장을 유도하고 이번 주 예약으로 연결",
    extra: "압박감 없이 안부 중심",
  });
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [eventLoading, setEventLoading] = useState(false);
  const [eventText, setEventText] = useState("");
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendText, setTrendText] = useState("");
  const [notice, setNotice] = useState("");
  const toast = useToast();

  const stats = useMemo(() => {
    const open = visibleTasks.filter((t) => !t.completed && !t.deleted).length;
    const done = visibleTasks.reduce((acc, task) => acc + task.subs.filter((sub) => sub.done).length, 0);
    const total = visibleTasks.reduce((acc, task) => acc + task.subs.length, 0);
    const urgent = visibleTasks.filter((t) => !t.completed && !t.deleted && t.pri === "high").length;
    return { open, done, total, urgent };
  }, [visibleTasks]);

  const handleAiError = (error, title) => {
    const message = error?.message || "요청 처리 중 문제가 생겼어요.";
    setNotice(message);
    toast.error(message, { title });
  };

  const generateMessages = async () => {
    setMessageLoading(true);
    setNotice("");
    try {
      const result = await callAI(memberMessagePrompt({ branchName, ...messageForm }));
      setMessageText(result);
      toast.success("카톡 문구를 만들었어요.", { title: "AI 완료", duration: 1600 });
    } catch (e) {
      handleAiError(e, "카톡 문구 생성 실패");
    }
    setMessageLoading(false);
  };

  const generateReview = async () => {
    setReviewLoading(true);
    setNotice("");
    try {
      setReviewText(await callAI(reviewPrompt(visibleTasks, branchName)));
      toast.success("주간 리뷰를 만들었어요.", { title: "AI 완료", duration: 1600 });
    } catch (e) {
      handleAiError(e, "주간 리뷰 생성 실패");
    }
    setReviewLoading(false);
  };

  const generateEvents = async () => {
    setEventLoading(true);
    setNotice("");
    try {
      setEventText(await callAI(eventPrompt(branchName)));
      toast.success("추천 이벤트를 만들었어요.", { title: "AI 완료", duration: 1600 });
    } catch (e) {
      handleAiError(e, "추천 이벤트 생성 실패");
    }
    setEventLoading(false);
  };

  const generateTrends = async () => {
    setTrendLoading(true);
    setNotice("");
    try {
      setTrendText(await callAI(trendsPrompt(branchName), true));
      toast.success("업계 동향을 정리했어요.", { title: "AI 완료", duration: 1600 });
    } catch (e) {
      handleAiError(e, "업계 동향 생성 실패");
    }
    setTrendLoading(false);
  };

  const requestWebPush = async () => {
    try {
      const ok = await notifications.requestPermission();
      if (ok) toast.success("웹푸시 연결을 완료했어요.", { title: "알림 연결" });
    } catch (e) {
      handleAiError(e, "웹푸시 연결 실패");
    }
  };

  const toggleWebPush = async () => {
    try {
      await notifications.setEnabled(!notifications.enabled);
      toast.success(notifications.enabled ? "웹푸시를 껐어요." : "웹푸시를 켰어요.", { title: "알림 설정", duration: 1600 });
    } catch (e) {
      handleAiError(e, "알림 설정 실패");
    }
  };

  const togglePref = async (key, next) => {
    try {
      await notifications.setPrefs({ [key]: next });
      toast.success("알림 설정을 저장했어요.", { title: "저장 완료", duration: 1400 });
    } catch (e) {
      handleAiError(e, "알림 설정 저장 실패");
    }
  };

  const changeDigestHour = async (hour) => {
    try {
      await notifications.setPrefs({ dueDigestHour: Number(hour) });
      toast.success(`마감 요약 시간을 ${hourLabel(Number(hour))}로 저장했어요.`, { title: "시간 저장", duration: 1700 });
    } catch (e) {
      handleAiError(e, "알림 시간 저장 실패");
    }
  };

  const prefDisabled = notifications.permission !== "granted" || !notifications.enabled || notifications.prefsBusy;

  return (
    <div className="stack-grid" style={{ paddingBottom: 96 }}>
      <Card tone="dark" style={{ padding: 18, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -40, top: -20, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 18, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}><Icon name="robot" size={18} /> AI 실무 탭</div>
          <div style={{ fontSize: 12.5, color: "#CBD5E1", marginTop: 6, lineHeight: 1.6 }}>{branchName}에서 바로 복붙하고 실행할 수 있는 문구와 리뷰를 만듭니다.</div>
          <div className="summary-grid" style={{ marginTop: 16 }}>
            {[
              { label: "열린 과제", value: `${stats.open}개` },
              { label: "긴급 과제", value: `${stats.urgent}개` },
              { label: "세부과제 완료", value: `${stats.done}/${stats.total}` },
              { label: "센터 모드", value: "실행 중심" },
            ].map((item) => (
              <div key={item.label} style={{ padding: "12px 12px 11px", borderRadius: 16, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 11.5, color: "#CBD5E1", fontWeight: 700 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {notice ? <ErrorBanner message={notice} onDismiss={() => setNotice("")} /> : null}

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}><Icon name="alert" size={16} /> 푸시 알림 설정</div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 4, lineHeight: 1.6 }}>긴급 과제는 즉시, 코멘트는 담당자에게만 즉시, 마감 요약은 원하는 시간에 웹푸시로 알려줘요.</div>
          </div>
          <Badge tone={notifications.enabled ? "green" : "slate"}>{notifications.enabled ? "알림 켜짐" : "알림 꺼짐"}</Badge>
        </div>
        {!notifications.supported ? (
          <ErrorBanner message="이 브라우저에서는 알림을 지원하지 않습니다." />
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <Button onClick={requestWebPush} disabled={notifications.busy}>{notifications.permission === "granted" ? "웹푸시 다시 연결" : "웹푸시 켜기"}</Button>
              <Button onClick={toggleWebPush} variant="secondary" disabled={notifications.permission !== "granted" || notifications.busy}>{notifications.enabled ? "웹푸시 끄기" : "웹푸시 켜기"}</Button>
            </div>
            <div className="stack-grid" style={{ marginTop: 14, gap: 10 }}>
              <PrefToggle title="긴급 과제 즉시 알림" desc="긴급으로 등록되거나 긴급으로 바뀐 과제를 바로 받아요." checked={notifications.prefs.urgentTask} disabled={prefDisabled} onChange={(next) => togglePref("urgentTask", next)} />
              <PrefToggle title="새 코멘트 알림" desc="담당자로 지정된 과제에 새 댓글이 달릴 때만 바로 알려줘요." checked={notifications.prefs.comment} disabled={prefDisabled} onChange={(next) => togglePref("comment", next)} />
              <PrefToggle title="마감 요약 알림" desc="오늘 마감/지연 과제를 선택한 시간에 한 번에 요약해줘요." checked={notifications.prefs.dueDigest} disabled={prefDisabled} onChange={(next) => togglePref("dueDigest", next)} />
            </div>
            <div style={{ marginTop: 12, padding: 14, borderRadius: 16, border: "1px solid #E2E8F0", background: prefDisabled ? "#F8FAFC" : "rgba(255,255,255,0.8)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: "#111827" }}>마감 요약 시간</div>
              <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>현재 설정: {hourLabel(notifications.prefs.dueDigestHour)}</div>
              <select value={notifications.prefs.dueDigestHour} onChange={(e) => changeDigestHour(e.target.value)} disabled={prefDisabled || !notifications.prefs.dueDigest} style={{ ...inp, marginTop: 10, background: prefDisabled || !notifications.prefs.dueDigest ? "#F3F4F6" : "rgba(248,250,252,0.95)" }}>
                {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
              </select>
            </div>
          </>
        )}
        <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 10, lineHeight: 1.55 }}>
          {notifications.permission !== "granted"
            ? "먼저 웹푸시를 켜야 세부 알림 종류와 시간을 저장할 수 있어요."
            : notifications.prefsBusy
              ? "알림 설정을 저장 중이에요…"
              : "받고 싶은 알림만 켜둘 수 있어요. 코멘트는 담당자에게만 보내고, 마감 요약 시간은 이 기기 구독에 저장됩니다."}
        </div>
      </Card>

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}><Icon name="comment" size={16} /> 회원 카톡 멘트 생성기</div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 4, lineHeight: 1.6 }}>상황만 적으면 바로 보내기 좋은 문구를 3개 뽑아줘요.</div>
          </div>
          <Badge tone="amber">실무 복붙용</Badge>
        </div>
        <label style={lbl}>상황</label>
        <select value={messageForm.scenario} onChange={(e) => setMessageForm((p) => ({ ...p, scenario: e.target.value }))} style={inp}>
          <option>휴면회원 재접촉</option>
          <option>신규회원 첫주 케어</option>
          <option>재등록 제안</option>
          <option>결석 체크</option>
          <option>수업 후 피드백</option>
          <option>일반 홍보/이벤트 안내</option>
        </select>
        <label style={lbl}>톤</label>
        <input value={messageForm.tone} onChange={(e) => setMessageForm((p) => ({ ...p, tone: e.target.value }))} style={inp} />
        <label style={lbl}>회원 정보</label>
        <textarea value={messageForm.memberInfo} onChange={(e) => setMessageForm((p) => ({ ...p, memberInfo: e.target.value }))} style={{ ...inp, minHeight: 82, resize: "vertical" }} />
        <label style={lbl}>목표</label>
        <input value={messageForm.goal} onChange={(e) => setMessageForm((p) => ({ ...p, goal: e.target.value }))} style={inp} />
        <label style={lbl}>추가 참고</label>
        <input value={messageForm.extra} onChange={(e) => setMessageForm((p) => ({ ...p, extra: e.target.value }))} style={inp} />
        <Button onClick={generateMessages} block style={{ marginTop: 16 }} icon="sparkle">카톡 문구 만들기</Button>
      </Card>
      <ResultCard title="카톡 문구 결과" text={messageText} loading={messageLoading} tone="amber" />

      <div className="stack-grid" style={{ gap: 10 }}>
        <Button onClick={generateReview} variant="secondary" block style={{ borderColor: "#C7D2FE", background: "linear-gradient(135deg,#EEF2FF,#FFFFFF)", color: "#4338CA" }} icon="chart">주간 리뷰 생성</Button>
        <ResultCard title="주간 리뷰" text={reviewText} loading={reviewLoading} tone="blue" />
        <div className="two-col-grid">
          <Button onClick={generateEvents} variant="secondary" style={{ borderColor: "#FDDCB8", background: "linear-gradient(135deg,#FFF8F3,#FFFFFF)", color: "#C2410C" }} icon="megaphone">추천 이벤트</Button>
          <Button onClick={generateTrends} variant="secondary" style={{ borderColor: "#A7F3D0", background: "linear-gradient(135deg,#ECFDF5,#FFFFFF)", color: "#065F46" }} icon="globe">업계 동향</Button>
        </div>
        <ResultCard title="추천 이벤트" text={eventText} loading={eventLoading} tone="amber" />
        <ResultCard title="업계 동향" text={trendText} loading={trendLoading} tone="green" />
      </div>
    </div>
  );
}
