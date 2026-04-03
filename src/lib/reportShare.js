import { formatHours } from "./report";

function pctText(value) {
  return value == null ? "데이터 축적중" : `${value}%`;
}

function hoursText(value) {
  return formatHours(value);
}

function topCoachLine(item) {
  if (!item) return "코치 데이터가 아직 충분하지 않습니다.";
  return `${item.emoji} ${item.name} 코치 · ${item.archetype} · 최근 7일 완료 ${item.completed7d}건 · 평균 처리 ${hoursText(item.avgCycleHours)} · 마감 준수 ${pctText(item.onTimeRate)}`;
}

function bottleneckLine(item) {
  if (!item) return "우선 확인할 병목 과제는 아직 크지 않습니다.";
  const bits = [];
  if (item.overdueDays > 0) bits.push(`지연 ${item.overdueDays}일`);
  if (item.pri === "high") bits.push("긴급");
  if (item.due) bits.push(`마감 ${item.due}`);
  if (item.assignees?.length) bits.push(`담당 ${item.assignees.join(", ")}`);
  return `${item.title}${bits.length ? ` (${bits.join(" · ")})` : ""}`;
}

function fallbackAction(report) {
  const bottleneck = report?.bottlenecks?.[0];
  if (bottleneck) return `우선 ${bottleneck.title} 진행상황을 오늘 안으로 확인해 주세요.`;
  if ((report?.summary?.overdueActive || 0) > 0) return "지연 과제 회복과 마감 전 체크 루틴을 먼저 점검해 주세요.";
  return "현재 흐름은 안정적이라 반복 루틴 유지와 댓글 응답 속도 점검 정도면 충분합니다.";
}

function summaryLines(aiSummary = "") {
  return String(aiSummary || "").split(/\n+/).map((v) => v.trim()).filter(Boolean);
}

export function buildWeeklyShareText(report, me, branchName = "", aiSummary = "") {
  const summary = report?.summary || {};
  const coaches = report?.coaches || [];
  const bottlenecks = report?.bottlenecks || [];
  const aiLines = summaryLines(aiSummary);
  const lines = [
    `[좋은습관PT ${branchName} 주간 운영 공유]`,
    `- 최근 7일 완료 ${summary.completed7d || 0}건 / 진행 중 ${summary.activeCount || 0}건 / 지연 ${summary.overdueActive || 0}건`,
    `- 마감 준수율 ${pctText(summary.onTimeRate)} / 평균 처리시간 ${hoursText(summary.avgCycleHours)} / 긴급 대응속도 ${hoursText(summary.urgentResponseAvg)}`,
  ];

  if (aiLines.length) {
    lines.push("- AI 운영 요약");
    aiLines.slice(0, 5).forEach((line) => lines.push(`  · ${line}`));
  }

  if (me) {
    const meSummary = report?.meSummary;
    lines.push(`- 내 업무 페이스: ${me?.emoji || ""} ${me?.name || ""} 코치 / ${meSummary?.archetype || "데이터 축적중"} / 최근 7일 완료 ${meSummary?.completed7d || 0}건 / 현재 담당 ${meSummary?.activeCount || 0}건`);
  }

  lines.push(`- 코치 흐름: ${topCoachLine(coaches[0])}`);
  if (coaches[1]) lines.push(`- 추가 체크: ${topCoachLine(coaches[1])}`);
  lines.push(`- 우선 확인 과제: ${bottleneckLine(bottlenecks[0])}`);
  lines.push(`- 다음 액션: ${aiLines[4] || fallbackAction(report)}`);
  return lines.join("\n");
}

export function buildWeeklyEmailSubject(branchName = "") {
  return `[좋은습관PT ${branchName}] 주간 운영 리포트 공유`;
}

export function buildWeeklyEmailBody(report, me, branchName = "", aiSummary = "") {
  const summary = report?.summary || {};
  const coaches = report?.coaches || [];
  const bottlenecks = report?.bottlenecks || [];
  const meSummary = report?.meSummary;
  const aiLines = summaryLines(aiSummary);

  const lines = [
    `안녕하세요. 좋은습관PT ${branchName} 최근 7일 운영 리포트 공유드립니다.`,
    "",
    "1. 센터 핵심 지표",
    `- 최근 7일 완료: ${summary.completed7d || 0}건`,
    `- 현재 진행 중: ${summary.activeCount || 0}건`,
    `- 지연 과제: ${summary.overdueActive || 0}건`,
    `- 마감 준수율: ${pctText(summary.onTimeRate)}`,
    `- 평균 처리시간: ${hoursText(summary.avgCycleHours)}`,
    `- 긴급 대응속도: ${hoursText(summary.urgentResponseAvg)}`,
    "",
    "2. AI 운영 요약",
  ];

  if (aiLines.length) {
    aiLines.slice(0, 5).forEach((line, idx) => lines.push(`${idx + 1}) ${line}`));
  } else {
    lines.push(`1) 최근 7일 완료 ${summary.completed7d || 0}건, 진행 중 ${summary.activeCount || 0}건으로 운영 흐름을 유지 중입니다.`);
    lines.push(`2) 마감 준수율은 ${pctText(summary.onTimeRate)}, 평균 처리시간은 ${hoursText(summary.avgCycleHours)}입니다.`);
    lines.push(`3) 긴급 대응속도는 ${hoursText(summary.urgentResponseAvg)} 수준입니다.`);
    lines.push(`4) 가장 먼저 볼 병목 과제는 ${bottleneckLine(bottlenecks[0])}입니다.`);
    lines.push(`5) 다음 액션은 ${fallbackAction(report)}`);
  }

  lines.push("", "3. 코치별 흐름 요약");
  if (coaches.length) {
    coaches.slice(0, 3).forEach((item, idx) => {
      lines.push(`- ${idx + 1}. ${item.emoji} ${item.name} 코치: ${item.archetype}, 최근 7일 완료 ${item.completed7d}건, 평균 처리 ${hoursText(item.avgCycleHours)}, 마감 준수 ${pctText(item.onTimeRate)}, 긴급 대응 ${hoursText(item.urgentResponseAvg)}`);
      lines.push(`  · 강점: ${item.strength}`);
      lines.push(`  · 보완: ${item.care}`);
    });
  } else {
    lines.push("- 코치별 데이터는 축적 중입니다.");
  }

  lines.push("", "4. 개인 참고");
  if (meSummary) {
    lines.push(`- ${me?.emoji || ""} ${me?.name || ""} 코치는 현재 ${meSummary.archetype} 흐름입니다.`);
    lines.push(`- 최근 7일 완료 ${meSummary.completed7d}건 / 현재 담당 ${meSummary.activeCount}건 / 지연 ${meSummary.overdueActive}건`);
  } else {
    lines.push("- 로그인한 코치 기준 개인 리포트는 아직 데이터가 충분하지 않습니다.");
  }

  lines.push("", "5. 우선 확인 과제");
  if (bottlenecks.length) {
    bottlenecks.slice(0, 3).forEach((item, idx) => lines.push(`- ${idx + 1}. ${bottleneckLine(item)}`));
  } else {
    lines.push("- 현재 크게 밀리는 과제는 많지 않습니다.");
  }

  lines.push("", "확인 부탁드립니다.", "감사합니다.");
  return lines.join("\n");
}
