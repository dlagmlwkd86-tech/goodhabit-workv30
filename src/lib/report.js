import { parseDateStr, todayStr } from './constants';

const DAY = 24 * 60 * 60 * 1000;

export function startOfKstDay(offsetDays = 0) {
  const base = parseDateStr(todayStr()) || new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + offsetDays);
  return base;
}

export function endOfKstDay(offsetDays = 0) {
  const d = startOfKstDay(offsetDays);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function parseTs(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function hoursBetween(a, b) {
  const da = parseTs(a);
  const db = parseTs(b);
  if (!da || !db) return null;
  return Math.max(0, (db.getTime() - da.getTime()) / 3600000);
}

export function formatHours(hours) {
  if (hours == null || Number.isNaN(hours)) return '데이터 축적중';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}분`;
  if (hours < 24) {
    const whole = Math.floor(hours);
    const min = Math.round((hours - whole) * 60);
    return min ? `${whole}시간 ${min}분` : `${whole}시간`;
  }
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem ? `${days}일 ${rem}시간` : `${days}일`;
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pct(num, den) {
  if (!den) return null;
  return Math.round((num / den) * 100);
}

function completionDate(task) {
  return parseTs(task.completedAt);
}

function createdDate(task) {
  return parseTs(task.createdAt);
}

function dueEnd(task) {
  if (!task?.due) return null;
  const d = parseDateStr(task.due);
  if (!d) return null;
  d.setHours(23, 59, 59, 999);
  return d;
}

function isCompletedInWindow(task, start, end) {
  const completed = completionDate(task);
  return !!completed && completed >= start && completed <= end;
}

function firstResponseHours(task) {
  return hoursBetween(task.createdAt, task.firstResponseAt);
}

function cycleHours(task) {
  return hoursBetween(task.createdAt, task.completedAt);
}

function onTime(task) {
  const completed = completionDate(task);
  const due = dueEnd(task);
  if (!completed || !due) return null;
  return completed.getTime() <= due.getTime();
}

function coachTasks(tasks, coachId) {
  return tasks.filter((task) => Array.isArray(task.assignees) && task.assignees.includes(coachId));
}

function deriveArchetype(summary, peerMedianCycle) {
  if (!summary.completed7d) return '데이터 축적중';
  if ((summary.overdueActive || 0) >= 3 || (summary.onTimeRate ?? 100) < 55) return '지연 관리 보완 필요';
  if ((summary.urgentResponseAvg ?? 99) <= 4 && summary.urgentHandled >= 2) return '긴급 대응형';
  if ((summary.onTimeRate ?? 0) >= 85) return '마감 안정형';
  if (summary.avgCycleHours != null && peerMedianCycle != null && summary.avgCycleHours <= peerMedianCycle * 0.85) return '빠른 실행형';
  if ((summary.completed7d || 0) >= 5) return '꾸준한 수행형';
  return '안정적 수행형';
}

function deriveStrength(summary) {
  if (!summary.completed7d) return '새 데이터가 쌓이는 중이에요.';
  if ((summary.urgentResponseAvg ?? 99) <= 4 && summary.urgentHandled >= 2) return '긴급 과제 반응이 빠른 편이에요.';
  if ((summary.onTimeRate ?? 0) >= 85) return '마감 전에 끝내는 비율이 높아요.';
  if ((summary.avgCycleHours ?? 999) <= 24) return '처리 속도가 전반적으로 빠른 편이에요.';
  return '맡은 업무를 꾸준히 처리하고 있어요.';
}

function deriveCare(summary) {
  if (!summary.completed7d) return '과제가 완료되면 리포트가 더 정확해져요.';
  if ((summary.overdueActive || 0) >= 2) return '지연된 과제 회복에 먼저 집중해보세요.';
  if ((summary.onTimeRate ?? 100) < 65) return '마감 하루 전 체크 루틴을 강화하면 좋아요.';
  if ((summary.urgentResponseAvg ?? 0) > 6 && summary.urgentHandled >= 1) return '긴급 과제는 첫 반응을 조금 더 당겨보세요.';
  return '코멘트나 후속 확인 속도를 조금 더 당기면 좋아요.';
}

function firstActionTs(task) {
  const timestamps = [];
  if (task.firstResponseAt) timestamps.push(parseTs(task.firstResponseAt)?.getTime());
  for (const sub of task.subs || []) {
    const ts = parseTs(sub.doneAtISO)?.getTime();
    if (ts) timestamps.push(ts);
  }
  for (const comment of task.comments || []) {
    const ts = parseTs(comment.createdAt)?.getTime();
    if (ts) timestamps.push(ts);
  }
  if (!timestamps.length) return null;
  return new Date(Math.min(...timestamps));
}

export function buildReportData(tasks = [], coaches = [], me, branchName = '') {
  const windowStart = startOfKstDay(-6);
  const windowEnd = endOfKstDay(0);
  const completed7d = tasks.filter((task) => isCompletedInWindow(task, windowStart, windowEnd));
  const dueTasks7d = completed7d.filter((task) => task.due);
  const onTimeCompleted = dueTasks7d.filter((task) => onTime(task) === true).length;
  const cycleValues = completed7d.map(cycleHours).filter((v) => v != null);
  const urgentResponseValues = tasks
    .filter((task) => task.pri === 'high')
    .map((task) => task.firstResponseAt ? firstResponseHours(task) : hoursBetween(task.createdAt, firstActionTs(task)?.toISOString()))
    .filter((v) => v != null);
  const overdueActive = tasks.filter((task) => !task.completed && !task.deleted && task.due && dueEnd(task) && dueEnd(task).getTime() < Date.now()).length;
  const activeTasks = tasks.filter((task) => !task.completed && !task.deleted);

  const coachList = coaches.filter((coach) => coach.role === 'coach');
  const peerCycle = [];

  const coachSummaries = coachList.map((coach) => {
    const mine = coachTasks(tasks, coach.id);
    const mineCompleted = mine.filter((task) => isCompletedInWindow(task, windowStart, windowEnd));
    const mineCycleValues = mineCompleted.map(cycleHours).filter((v) => v != null);
    const mineDueCompleted = mineCompleted.filter((task) => task.due);
    const mineOnTime = mineDueCompleted.filter((task) => onTime(task) === true).length;
    const mineUrgent = mine.filter((task) => task.pri === 'high');
    const mineUrgentHandled = mineUrgent.filter((task) => task.firstResponseAt || firstActionTs(task)).length;
    const urgentAvg = mean(mineUrgent.map((task) => task.firstResponseAt ? firstResponseHours(task) : hoursBetween(task.createdAt, firstActionTs(task)?.toISOString())).filter((v) => v != null));
    const summary = {
      coachId: coach.id,
      name: coach.name,
      emoji: coach.emoji,
      completed7d: mineCompleted.length,
      avgCycleHours: mean(mineCycleValues),
      onTimeRate: pct(mineOnTime, mineDueCompleted.length),
      urgentResponseAvg: urgentAvg,
      urgentHandled: mineUrgentHandled,
      activeCount: mine.filter((task) => !task.completed && !task.deleted).length,
      overdueActive: mine.filter((task) => !task.completed && !task.deleted && task.due && dueEnd(task) && dueEnd(task).getTime() < Date.now()).length,
      lastActionAt: mine.map((task) => parseTs(task.updatedAt)?.getTime()).filter(Boolean).sort((a, b) => b - a)[0] || null,
    };
    if (summary.avgCycleHours != null) peerCycle.push(summary.avgCycleHours);
    return summary;
  });

  const peerMedianCycle = median(peerCycle);
  const enrichedCoaches = coachSummaries.map((summary) => ({
    ...summary,
    archetype: deriveArchetype(summary, peerMedianCycle),
    strength: deriveStrength(summary),
    care: deriveCare(summary),
  }));

  const meSummary = enrichedCoaches.find((summary) => summary.coachId === me?.id) || null;

  const bottlenecks = activeTasks
    .map((task) => ({
      id: task.id,
      title: task.title,
      due: task.due,
      pri: task.pri,
      overdueDays: task.due && dueEnd(task) ? Math.max(0, Math.ceil((Date.now() - dueEnd(task).getTime()) / DAY)) : 0,
      assignees: (task.assignees || []).map((id) => coaches.find((coach) => coach.id === id)?.name).filter(Boolean),
    }))
    .filter((task) => task.overdueDays > 0 || task.pri === 'high')
    .sort((a, b) => (b.overdueDays - a.overdueDays) || (a.pri === 'high' ? -1 : 1))
    .slice(0, 4);

  const summary = {
    branchName,
    completed7d: completed7d.length,
    onTimeRate: pct(onTimeCompleted, dueTasks7d.length),
    avgCycleHours: mean(cycleValues),
    medianCycleHours: median(cycleValues),
    urgentResponseAvg: mean(urgentResponseValues),
    overdueActive,
    activeCount: activeTasks.length,
    coachesWithData: enrichedCoaches.filter((coach) => coach.completed7d > 0).length,
  };

  return {
    summary,
    coaches: enrichedCoaches.sort((a, b) => (b.completed7d - a.completed7d) || ((a.avgCycleHours ?? 9999) - (b.avgCycleHours ?? 9999))),
    meSummary,
    bottlenecks,
    hasData: completed7d.length > 0 || activeTasks.length > 0,
  };
}
