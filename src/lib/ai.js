import { CATS, PRI, ddayLabel } from "./constants";

export async function callAI(prompt, grounded = false) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, grounded }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI error");
  return data.text;
}

export function advicePrompt(task, names, branchName) {
  const c = CATS[task.cat];
  const subs = task.subs.map((s, i) => `${i + 1}. [${s.done ? "✅" : "⬜"}] ${s.t}`).join("\n");
  return `당신은 그룹PT 센터 "좋은습관PT ${branchName}"의 베테랑 매니저입니다.
담당 코치(${names})에게 실행 지시. 코치는 성실하지만 기획력·기억력이 약해 구체적 지시 필요.
과제: ${c.label} / ${task.title} / ${PRI[task.pri].label} / 마감:${task.due || "미정"} ${task.due ? ddayLabel(task.due) : ""}
${task.memo ? "메모:" + task.memo : ""}
세부:
${subs}
규칙: 미완료 중 지금 할 것 1개, 소요시간, 준비물, 실전 템플릿/멘트, 실수경고 1가지. 6~8줄. 존댓말. 일반텍스트.`;
}

export function reviewPrompt(tasks, branchName) {
  const summary = tasks.map((t) => `- [${CATS[t.cat].label}] ${t.title} (${t.subs.filter((s) => s.done).length}/${t.subs.length}, ${PRI[t.pri].label})`).join("\n");
  return `"좋은습관PT ${branchName}" 주간 리뷰.\n${summary}\n성과(1~2줄),주의(1~2줄),최우선(1~2줄),응원(1줄). 6~8줄. 존댓말. 일반텍스트.`;
}

export function eventPrompt(branchName) {
  const month = new Date().getMonth() + 1;
  return `"좋은습관PT ${branchName}" ${month}월 이벤트 3가지 추천. 그룹PT/크로스핏/HYROX 센터, 인천 20~40대. 이벤트명,이유,운영법,효과. 존댓말. 일반텍스트.`;
}

export function trendsPrompt(branchName) {
  return `"좋은습관PT ${branchName}" 코치를 위한 피트니스 업계 동향. 운동트렌드,마케팅,회원관리,경쟁환경 각1~2줄 + 코치응원1줄. 존댓말. 한국시장. 일반텍스트.`;
}

export function memberMessagePrompt({ branchName, scenario, tone, memberInfo, goal, extra }) {
  return `당신은 그룹PT 센터 "좋은습관PT ${branchName}"의 상담/회원관리 코치입니다.
다음 조건에 맞는 카카오톡 메시지 3개를 작성하세요.
- 상황: ${scenario}
- 톤: ${tone}
- 회원 정보: ${memberInfo || "없음"}
- 목표: ${goal || "관계 유지와 자연스러운 응답 유도"}
- 추가 참고: ${extra || "없음"}
규칙:
1) 각 문안은 2~4문장
2) 과장/압박 없이 친근하고 자연스럽게
3) 마지막엔 답장 유도 문장 포함
4) 이모지는 많지 않게
5) 문안 1/2/3으로 구분
6) 바로 복붙 가능하게 일반 텍스트로 작성`;
}

export function weeklyReportSummaryPrompt(report, branchName) {
  const summary = report?.summary || {};
  const coaches = (report?.coaches || []).slice(0, 5);
  const bottlenecks = report?.bottlenecks || [];

  const coachLines = coaches.length
    ? coaches.map((item, idx) => `${idx + 1}. ${item.name} / 유형:${item.archetype} / 최근7일완료:${item.completed7d}건 / 평균처리:${item.avgCycleHours == null ? '데이터 축적중' : item.avgCycleHours.toFixed(1) + '시간'} / 마감준수:${item.onTimeRate == null ? '데이터 축적중' : item.onTimeRate + '%'} / 긴급반응:${item.urgentResponseAvg == null ? '데이터 축적중' : item.urgentResponseAvg.toFixed(1) + '시간'}`).join("\n")
    : '코치별 데이터 없음';

  const bottleneckLines = bottlenecks.length
    ? bottlenecks.map((item, idx) => `${idx + 1}. ${item.title} / 마감:${item.due || '미정'} / 우선순위:${item.pri} / 담당:${(item.assignees || []).join(', ') || '없음'} / 지연일수:${item.overdueDays || 0}`).join("\n")
    : '병목 과제 없음';

  return `당신은 그룹PT 센터 "좋은습관PT ${branchName}"의 센터장 보좌 운영 코치입니다.
아래 수치를 바탕으로 대표/센터장이 바로 읽을 수 있는 주간 운영 요약을 작성하세요.

[센터 핵심 지표]
- 최근 7일 완료: ${summary.completed7d || 0}건
- 현재 진행 중: ${summary.activeCount || 0}건
- 지연 과제: ${summary.overdueActive || 0}건
- 마감 준수율: ${summary.onTimeRate == null ? '데이터 축적중' : summary.onTimeRate + '%'}
- 평균 처리시간: ${summary.avgCycleHours == null ? '데이터 축적중' : summary.avgCycleHours.toFixed(1) + '시간'}
- 긴급 대응속도: ${summary.urgentResponseAvg == null ? '데이터 축적중' : summary.urgentResponseAvg.toFixed(1) + '시간'}

[코치별 흐름]
${coachLines}

[병목 과제]
${bottleneckLines}

규칙:
1) 제목 없이 바로 작성
2) 총 5줄 이내
3) 1줄차: 센터 전체 흐름 요약
4) 2~3줄차: 주목할 코치 흐름 1~2명
5) 4줄차: 가장 먼저 볼 병목/리스크
6) 5줄차: 다음 주 운영 액션 1가지 제안
7) 공격적 평가 금지, 부드럽고 실무적인 표현
8) 존댓말, 일반 텍스트`;
}
