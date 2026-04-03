import { formatHours } from './report';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtPct(value) {
  return value == null ? '데이터 축적중' : `${value}%`;
}

function toneClass(archetype = '') {
  if (archetype.includes('빠른')) return 'good';
  if (archetype.includes('긴급')) return 'danger';
  if (archetype.includes('보완')) return 'warn';
  return 'slate';
}

function todayLabel() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
}

function metricBlock(label, value, sub, compact = false) {
  return `
    <div class="metric-card ${compact ? 'compact' : ''}">
      <div class="metric-label">${esc(label)}</div>
      <div class="metric-value">${esc(value)}</div>
      <div class="metric-sub">${esc(sub || '')}</div>
    </div>`;
}

function insightSummary(report) {
  const summary = report?.summary || {};
  const coaches = report?.coaches || [];
  const bestOnTime = coaches.filter((x) => x.onTimeRate != null).sort((a, b) => (b.onTimeRate - a.onTimeRate))[0];
  const fastest = coaches.filter((x) => x.avgCycleHours != null).sort((a, b) => a.avgCycleHours - b.avgCycleHours)[0];
  const urgentAce = coaches.filter((x) => x.urgentResponseAvg != null).sort((a, b) => a.urgentResponseAvg - b.urgentResponseAvg)[0];

  const lines = [];
  lines.push(`최근 7일 동안 총 ${summary.completed7d || 0}건이 완료되었고, 현재 진행 중 과제는 ${summary.activeCount || 0}건입니다.`);
  if (summary.onTimeRate != null) lines.push(`마감 준수율은 ${summary.onTimeRate}%이며, 지연 과제는 ${summary.overdueActive || 0}건입니다.`);
  if (fastest?.avgCycleHours != null) lines.push(`평균 처리속도가 가장 빠른 흐름은 ${fastest.name} 코치(${formatHours(fastest.avgCycleHours)})입니다.`);
  if (bestOnTime?.onTimeRate != null) lines.push(`마감 안정성이 가장 좋은 흐름은 ${bestOnTime.name} 코치(${bestOnTime.onTimeRate}%)입니다.`);
  if (urgentAce?.urgentResponseAvg != null) lines.push(`긴급 대응속도는 ${urgentAce.name} 코치가 가장 빠른 편(${formatHours(urgentAce.urgentResponseAvg)})입니다.`);
  return lines.slice(0, 4);
}

function summaryCoachCards(coaches = []) {
  const top = coaches.slice(0, 4);
  if (!top.length) return `<div class="highlight"><p style="margin:0;">코치별 지표가 아직 충분하지 않습니다.</p></div>`;
  return `<div class="coach-pulse-grid">${top.map((item) => `
    <div class="coach-pulse-card">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
        <div>
          <div class="coach-pulse-name">${esc(item.emoji || '')} ${esc(item.name)}</div>
          <div style="margin-top:6px;"><span class="chip ${toneClass(item.archetype)}">${esc(item.archetype)}</span></div>
        </div>
        <div style="text-align:right;">
          <div class="muted" style="font-size:11px;font-weight:800;">완료</div>
          <div style="font-size:20px;font-weight:900;color:var(--navy);">${esc(item.completed7d)}건</div>
        </div>
      </div>
      <div class="coach-pulse-meta">
        <span>처리 ${esc(formatHours(item.avgCycleHours))}</span>
        <span>마감 ${esc(fmtPct(item.onTimeRate))}</span>
      </div>
      <div class="coach-pulse-copy">${esc(item.strength)}</div>
    </div>`).join('')}</div>`;
}

function bottleneckCards(bottlenecks = [], limit = 4) {
  const items = bottlenecks.slice(0, limit);
  if (!items.length) return `<div class="highlight"><p style="margin:0;">현재는 긴급/지연 기준으로 크게 밀리는 과제가 보이지 않습니다.</p></div>`;
  return `<div class="bottleneck-list">${items.map((task) => `
    <div class="bottleneck-card">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
        <div style="min-width:0;">
          <div class="b-title">${esc(task.title)}</div>
          <div class="b-meta">
            ${task.pri === 'high' ? '<span class="chip danger">긴급</span>' : ''}
            ${task.overdueDays > 0 ? `<span class="chip warn">지연 ${esc(task.overdueDays)}일</span>` : ''}
            ${task.due ? `<span class="chip slate">마감 ${esc(task.due)}</span>` : ''}
          </div>
        </div>
        ${task.assignees?.length ? `<span class="chip slate">${esc(task.assignees.join(', '))}</span>` : ''}
      </div>
    </div>`).join('')}</div>`;
}

function aiSummaryBlock(aiSummary = '', title = 'AI 운영 요약') {
  const lines = String(aiSummary || '').split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 5);
  if (!lines.length) return '';
  return `<div class="section">
    <div class="section-title">${esc(title)}</div>
    <div class="section-sub">숫자만으로 보기 어려운 흐름을 대표/센터장용 문장으로 짧게 풀어낸 AI 요약입니다.</div>
    <div class="summary-copy">${lines.map((line, idx) => `<div class="summary-line"><div class="summary-line-index">${idx + 1}</div><div>${esc(line)}</div></div>`).join('')}</div>
  </div>`;
}

function commonCss({ summaryMode = false } = {}) {
  return `
    :root {
      --navy:#0f172a;
      --sub:#64748b;
      --line:#e2e8f0;
      --soft:#f8fafc;
      --blue:#2563eb;
      --green:#059669;
      --amber:#d97706;
      --red:#dc2626;
      --violet:#7c3aed;
      --text:#111827;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #eef2ff; color: var(--text); font-family: "Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", Arial, sans-serif; }
    body { padding: 18px; }
    .sheet { max-width: 860px; margin: 0 auto; background: #fff; border: 1px solid var(--line); border-radius: 24px; box-shadow: 0 24px 50px rgba(15,23,42,.08); overflow: hidden; }
    .page { background: #fff; }
    .page + .page { page-break-before: always; break-before: page; }
    .hero { padding: ${summaryMode ? '20px 24px' : '24px 28px'}; background: linear-gradient(135deg,#0f172a,#1e293b 52%,#334155); color: #fff; position: relative; }
    .hero::after { content:""; position:absolute; right:-80px; top:-80px; width:220px; height:220px; border-radius:999px; background: radial-gradient(circle,rgba(37,99,235,.28),transparent 70%); }
    .hero-kicker { display:inline-flex; align-items:center; gap:8px; font-size:12px; font-weight:800; padding:7px 11px; border-radius:999px; border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.08); }
    h1 { margin: 14px 0 8px; font-size: ${summaryMode ? '25px' : '28px'}; line-height: 1.2; }
    .hero-sub { font-size: 12.5px; line-height: 1.65; color: #dbeafe; max-width: 620px; }
    .hero-meta { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
    .chip { display:inline-flex; align-items:center; gap:6px; padding:7px 11px; border-radius:999px; font-size:11.5px; font-weight:800; }
    .chip.slate { background:#f8fafc; border:1px solid #cbd5e1; color:#334155; }
    .chip.good { background:#ecfdf5; border:1px solid #a7f3d0; color:#047857; }
    .chip.warn { background:#fff7ed; border:1px solid #fed7aa; color:#c2410c; }
    .chip.danger { background:#fef2f2; border:1px solid #fecaca; color:#dc2626; }
    .section { padding: ${summaryMode ? '18px 24px' : '22px 28px'}; border-top: 1px solid var(--line); }
    .section-title { font-size: 16px; font-weight: 900; color: var(--navy); margin: 0 0 6px; }
    .section-sub { font-size: 12.5px; line-height: 1.65; color: var(--sub); margin: 0 0 14px; }
    .grid { display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
    .grid-4 { display:grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 12px; }
    .metric-card { border:1px solid var(--line); border-radius:18px; padding:14px 15px; background: linear-gradient(135deg,#fff,#f8fafc); min-height: 94px; }
    .metric-card.compact { min-height: 82px; padding: 12px 13px; }
    .metric-label { font-size:11.5px; font-weight:800; color:var(--sub); }
    .metric-value { margin-top:7px; font-size:19px; line-height:1.2; font-weight:900; color:var(--navy); }
    .metric-sub { margin-top:6px; font-size:11.5px; color:var(--sub); line-height:1.5; }
    .highlight { border:1px solid var(--line); border-radius:20px; padding:16px 18px; background: linear-gradient(135deg,#fff7ed,#fff); }
    .highlight p { margin:0; font-size:12.5px; color:var(--sub); line-height:1.7; }
    .notice { margin: 0 auto 14px; max-width:860px; padding: 12px 14px; border-radius: 16px; background: #eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; font-size:12px; line-height:1.6; }
    .summary-copy { display:grid; gap:8px; }
    .summary-line { display:flex; gap:10px; align-items:flex-start; padding:10px 12px; border-radius:14px; background:#f8fafc; border:1px solid var(--line); font-size:12.5px; line-height:1.6; color:var(--text); }
    .summary-line-index { width:22px; height:22px; border-radius:999px; display:flex; align-items:center; justify-content:center; background:#dbeafe; color:#1d4ed8; font-size:11px; font-weight:900; flex:0 0 auto; }
    .coach-pulse-grid { display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
    .coach-pulse-card { border:1px solid var(--line); border-radius:18px; padding:14px 15px; background: linear-gradient(135deg,#fff,#f8fafc); }
    .coach-pulse-name { font-size:13px; font-weight:900; color:var(--navy); }
    .coach-pulse-meta { margin-top:12px; display:flex; gap:8px; flex-wrap:wrap; font-size:11.5px; color:var(--sub); }
    .coach-pulse-meta span { padding:6px 9px; background:#fff; border:1px solid var(--line); border-radius:999px; }
    .coach-pulse-copy { margin-top:10px; font-size:12px; color:var(--sub); line-height:1.6; }
    table { width:100%; border-collapse:separate; border-spacing:0; }
    .coach-table { border:1px solid var(--line); border-radius:20px; overflow:hidden; }
    .coach-table th { text-align:left; background:#f8fafc; color:#334155; font-size:11.5px; font-weight:900; padding:12px 14px; border-bottom:1px solid var(--line); }
    .coach-table td { padding:13px 14px; border-bottom:1px solid #eef2f7; vertical-align:top; font-size:12.5px; line-height:1.55; }
    .coach-table tr:last-child td { border-bottom:none; }
    .coach-name { font-size:13px; font-weight:900; color:var(--navy); margin-bottom:5px; }
    .muted { color:var(--sub); }
    .bottleneck-list { display:grid; gap:10px; }
    .bottleneck-card { border:1px solid var(--line); border-radius:18px; padding:14px 15px; background: linear-gradient(135deg,#fff,#f8fafc); }
    .b-title { font-size:13px; font-weight:900; color:var(--navy); }
    .b-meta { margin-top:8px; display:flex; gap:6px; flex-wrap:wrap; }
    .split { display:grid; grid-template-columns: 1.1fr .9fr; gap: 12px; }
    @media print {
      @page { size: A4; margin: 11mm; }
      body { background:#fff; padding:0; }
      .sheet { box-shadow:none; border:none; border-radius:0; max-width:none; }
      .notice { display:none; }
      .section, .hero, .coach-pulse-card, .metric-card, .bottleneck-card, .highlight { break-inside: avoid; page-break-inside: avoid; }
      .coach-table tr { break-inside: avoid; page-break-inside: avoid; }
      .page.summary-only { height: 272mm; overflow: hidden; }
    }
    @media (max-width: 760px) {
      body { padding: 0; }
      .sheet { border-radius:0; border:none; }
      .hero, .section { padding-left:18px; padding-right:18px; }
      .grid, .grid-4, .coach-pulse-grid, .split { grid-template-columns: 1fr; }
    }
  `;
}

function buildSummaryHtml(report, me, branchName = '', options = {}) {
  const summary = report?.summary || {};
  const meSummary = report?.meSummary;
  const coaches = report?.coaches || [];
  const generatedAt = todayLabel();
  const periodLabel = '최근 7일 기준';
  const aiSummary = options?.aiSummary || '';
  const lines = insightSummary(report);

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(branchName || '센터')} 주간 운영 리포트 요약</title>
  <style>${commonCss({ summaryMode: true })}</style>
</head>
<body>
  <div class="notice">브라우저 인쇄창이 열리면 <strong>대상: PDF로 저장</strong>을 선택하세요. 이 문서는 센터장/대표용 1장 요약본입니다.</div>
  <div class="sheet">
    <div class="page summary-only">
      <div class="hero">
        <div class="hero-kicker">좋은습관PT 대표용 요약</div>
        <h1>${esc(branchName || '센터')} 주간 운영 요약 1장</h1>
        <div class="hero-sub">${esc(periodLabel)} · 빠르게 봐야 하는 핵심 지표와 리스크, 코치별 흐름만 1장에 압축했습니다.</div>
        <div class="hero-meta">
          <span class="chip slate">생성일 ${esc(generatedAt)}</span>
          <span class="chip slate">${esc(periodLabel)}</span>
          <span class="chip ${summary.overdueActive ? 'warn' : 'good'}">지연 ${esc(summary.overdueActive || 0)}건</span>
        </div>
      </div>

      <div class="section">
        <div class="grid-4">
          ${metricBlock('최근 7일 완료', `${summary.completed7d || 0}건`, `${summary.activeCount || 0}건 진행 중`, true)}
          ${metricBlock('마감 준수율', fmtPct(summary.onTimeRate), '마감일 있는 완료 업무 기준', true)}
          ${metricBlock('평균 처리시간', formatHours(summary.avgCycleHours), '생성부터 완료까지 평균', true)}
          ${metricBlock('긴급 대응속도', formatHours(summary.urgentResponseAvg), '첫 반응까지 걸린 시간', true)}
        </div>
      </div>

      <div class="section">
        <div class="split">
          <div>
            <div class="section-title">운영 한눈 요약</div>
            <div class="section-sub">숫자를 해석한 핵심 메시지만 짧게 정리했습니다.</div>
            <div class="summary-copy">${lines.map((line, idx) => `<div class="summary-line"><div class="summary-line-index">${idx + 1}</div><div>${esc(line)}</div></div>`).join('')}</div>
          </div>
          <div>
            <div class="section-title">개인 페이스 참고</div>
            <div class="section-sub">로그인한 코치 기준 참고용 요약입니다.</div>
            <div class="highlight">
              <p>${meSummary ? `${esc(me?.emoji || '')} ${esc(me?.name || '')} 코치는 <strong>${esc(meSummary.archetype)}</strong> 흐름입니다. 최근 7일 완료 ${esc(meSummary.completed7d)}건, 평균 처리시간 ${esc(formatHours(meSummary.avgCycleHours))}, 마감 준수율 ${esc(fmtPct(meSummary.onTimeRate))}입니다.` : '개인 리포트를 만들 데이터가 아직 충분하지 않습니다.'}</p>
            </div>
            <div style="margin-top:10px;">${metricBlock('현재 담당', `${meSummary?.activeCount || 0}건`, meSummary?.overdueActive ? `지연 ${meSummary.overdueActive}건` : '지연 없음', true)}</div>
          </div>
        </div>
      </div>

      ${aiSummaryBlock(aiSummary, 'AI 한 줄 요약')}

      <div class="section">
        <div class="section-title">코치별 흐름 요약</div>
        <div class="section-sub">가장 확인할 가치가 높은 코치 흐름 4개까지만 요약했습니다.</div>
        ${summaryCoachCards(coaches)}
      </div>

      <div class="section">
        <div class="section-title">우선 확인할 병목 과제</div>
        <div class="section-sub">대표/센터장이 바로 체크해야 할 긴급·지연 과제만 골라냈습니다.</div>
        ${bottleneckCards(report?.bottlenecks || [], 3)}
      </div>
    </div>
  </div>
  <script>
    window.addEventListener('load', function(){
      setTimeout(function(){ try { window.focus(); window.print(); } catch (e) {} }, 350);
    });
  </script>
</body>
</html>`;
}

function buildDetailedHtml(report, me, branchName = '', options = {}) {
  const summary = report?.summary || {};
  const meSummary = report?.meSummary;
  const coaches = report?.coaches || [];
  const generatedAt = todayLabel();
  const periodLabel = '최근 7일 기준';
  const aiSummary = options?.aiSummary || '';

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(branchName || '센터')} 주간 운영 리포트 상세</title>
  <style>${commonCss({ summaryMode: false })}</style>
</head>
<body>
  <div class="notice">브라우저 인쇄창이 열리면 <strong>대상: PDF로 저장</strong>을 선택하세요. 이 문서는 센터장/대표용 상세 리포트입니다.</div>
  <div class="sheet">
    <div class="page">
      <div class="hero">
        <div class="hero-kicker">좋은습관PT 상세 운영 리포트</div>
        <h1>${esc(branchName || '센터')} 주간 운영 상세 리포트</h1>
        <div class="hero-sub">${esc(periodLabel)} · 완료량, 마감 준수, 긴급 반응, 개인 페이스, 병목 과제를 2페이지 이상으로 자세히 정리했습니다.</div>
        <div class="hero-meta">
          <span class="chip slate">생성일 ${esc(generatedAt)}</span>
          <span class="chip slate">${esc(periodLabel)}</span>
          <span class="chip ${summary.overdueActive ? 'warn' : 'good'}">지연 ${esc(summary.overdueActive || 0)}건</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">센터 핵심 지표</div>
        <div class="section-sub">단순 완료 개수보다 운영 흐름을 보여주는 지표를 중심으로 정리했습니다.</div>
        <div class="grid-4">
          ${metricBlock('최근 7일 완료', `${summary.completed7d || 0}건`, `${summary.activeCount || 0}건 진행 중`)}
          ${metricBlock('마감 준수율', fmtPct(summary.onTimeRate), '마감일 있는 완료 업무 기준')}
          ${metricBlock('평균 처리시간', formatHours(summary.avgCycleHours), '과제 생성부터 완료까지 평균')}
          ${metricBlock('긴급 대응속도', formatHours(summary.urgentResponseAvg), '첫 반응까지 걸린 시간')}
        </div>
      </div>

      ${aiSummaryBlock(aiSummary, 'AI 운영 요약')}

      ${meSummary ? `
      <div class="section">
        <div class="section-title">${esc(me?.name || '')} 코치 개인 인사이트</div>
        <div class="section-sub">개인 지표는 평가용이 아니라 업무 리듬을 파악하고 보완 포인트를 찾기 위한 참고용입니다.</div>
        <div class="highlight">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
            <div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <span class="chip warn">내 업무 페이스</span>
                <span class="chip ${toneClass(meSummary.archetype)}">${esc(meSummary.archetype)}</span>
              </div>
              <div style="margin-top:12px;font-size:18px;font-weight:900;color:var(--navy);">${esc((me?.emoji || '') + ' ' + (me?.name || ''))} 코치 최근 흐름</div>
              <p style="margin-top:8px;">${esc(meSummary.strength)} ${esc(meSummary.care)}</p>
            </div>
            <div style="min-width:110px;text-align:right;">
              <div class="muted" style="font-size:11.5px;font-weight:800;">최근 7일 완료</div>
              <div style="font-size:28px;font-weight:900;color:var(--blue);margin-top:2px;">${esc(meSummary.completed7d)}건</div>
            </div>
          </div>
          <div class="grid" style="margin-top:16px;">
            ${metricBlock('평균 처리시간', formatHours(meSummary.avgCycleHours), '과제 생성부터 완료까지')}
            ${metricBlock('마감 준수율', fmtPct(meSummary.onTimeRate), '마감 있는 업무 기준')}
            ${metricBlock('긴급 반응속도', formatHours(meSummary.urgentResponseAvg), '첫 체크/코멘트까지')}
            ${metricBlock('현재 담당', `${meSummary.activeCount}건`, meSummary.overdueActive ? `지연 ${meSummary.overdueActive}건` : '지연 없음')}
          </div>
        </div>
      </div>` : ''}

      <div class="section">
        <div class="section-title">병목 과제 체크</div>
        <div class="section-sub">지연되었거나 긴급도가 높은 과제를 먼저 확인할 수 있도록 정리했습니다.</div>
        ${bottleneckCards(report?.bottlenecks || [], 6)}
      </div>
    </div>

    <div class="page">
      <div class="section" style="border-top:none;">
        <div class="section-title">코치별 운영 흐름 상세</div>
        <div class="section-sub">빠른 실행/마감 안정/긴급 대응 등 강점이 보이도록 유형화했습니다. 절대평가가 아닌 운영 참고용 인사이트입니다.</div>
        <div class="coach-table">
          <table>
            <thead>
              <tr>
                <th style="width:20%;">코치</th>
                <th style="width:14%;">최근 7일 완료</th>
                <th style="width:14%;">평균 처리시간</th>
                <th style="width:14%;">마감 준수율</th>
                <th style="width:14%;">긴급 반응속도</th>
                <th style="width:24%;">유형 / 코멘트</th>
              </tr>
            </thead>
            <tbody>
              ${coaches.length ? coaches.map((item) => `
                <tr>
                  <td>
                    <div class="coach-name">${esc(item.emoji || '')} ${esc(item.name)}</div>
                    <div class="muted">현재 담당 ${esc(item.activeCount)}건${item.overdueActive ? ` · 지연 ${esc(item.overdueActive)}건` : ''}</div>
                  </td>
                  <td>${esc(item.completed7d)}건</td>
                  <td>${esc(formatHours(item.avgCycleHours))}</td>
                  <td>${esc(fmtPct(item.onTimeRate))}</td>
                  <td>${esc(formatHours(item.urgentResponseAvg))}</td>
                  <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
                      <span class="chip ${toneClass(item.archetype)}">${esc(item.archetype)}</span>
                    </div>
                    <div class="muted">${esc(item.strength)} ${esc(item.care)}</div>
                  </td>
                </tr>`).join('') : `<tr><td colspan="6" class="muted">코치별 지표를 계산할 데이터가 아직 충분하지 않습니다.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  <script>
    window.addEventListener('load', function(){
      setTimeout(function(){ try { window.focus(); window.print(); } catch (e) {} }, 350);
    });
  </script>
</body>
</html>`;
}

function openPrintable(html) {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
  const popup = window.open('', '_blank', 'width=980,height=1200');
  if (!popup) return { ok: false, reason: 'popup-blocked' };
  try { popup.opener = null; } catch (e) {}
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  return { ok: true };
}

export function exportWeeklySummaryPdf(report, me, branchName = '', options = {}) {
  return openPrintable(buildSummaryHtml(report, me, branchName, options));
}

export function exportWeeklyDetailedPdf(report, me, branchName = '', options = {}) {
  return openPrintable(buildDetailedHtml(report, me, branchName, options));
}

export function buildWeeklyReportHtml(report, me, branchName = '', options = {}) {
  return buildSummaryHtml(report, me, branchName, options);
}

export function exportWeeklyReportPdf(report, me, branchName = '', options = {}) {
  return exportWeeklySummaryPdf(report, me, branchName, options);
}
