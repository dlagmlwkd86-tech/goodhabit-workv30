import { useState } from 'react';
import { Badge, Button, Card, CopyButton, EmptyState, ErrorBanner, Icon } from './Common';
import { callAI, weeklyReportSummaryPrompt } from '../lib/ai';
import { buildReportData, formatHours } from '../lib/report';
import { exportWeeklyDetailedPdf, exportWeeklySummaryPdf } from '../lib/reportExport';
import { buildWeeklyEmailBody, buildWeeklyEmailSubject, buildWeeklyShareText } from '../lib/reportShare';
import { useToast } from '../toast';

function MetricCard({ icon, label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: { bg: 'linear-gradient(135deg,#FFFFFF,#F8FAFC)', bd: 'var(--line)', fg: 'var(--text)', sub: 'var(--sub)' },
    blue: { bg: 'linear-gradient(135deg,#EFF6FF,#FFFFFF)', bd: '#BFDBFE', fg: '#1D4ED8', sub: '#1E40AF' },
    green: { bg: 'linear-gradient(135deg,#ECFDF5,#FFFFFF)', bd: '#A7F3D0', fg: '#047857', sub: '#065F46' },
    amber: { bg: 'linear-gradient(135deg,#FFFBEB,#FFFFFF)', bd: '#FDE68A', fg: '#B45309', sub: '#92400E' },
    red: { bg: 'linear-gradient(135deg,#FEF2F2,#FFFFFF)', bd: '#FECACA', fg: '#B91C1C', sub: '#991B1B' },
  };
  const current = tones[tone] || tones.slate;
  return (
    <div className="report-metric-card" style={{ background: current.bg, border: `1px solid ${current.bd}` }}>
      <div className="report-metric-icon" style={{ color: current.fg }}><Icon name={icon} size={16} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="report-metric-label">{label}</div>
        <div className="report-metric-value" style={{ color: current.fg }}>{value}</div>
        {sub ? <div className="report-metric-sub" style={{ color: current.sub }}>{sub}</div> : null}
      </div>
    </div>
  );
}

function CoachInsightCard({ item, me }) {
  const isMe = me?.id === item.coachId;
  return (
    <Card style={{ borderRadius: 24, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)' }}>{item.emoji} {item.name}</div>
            {isMe ? <Badge tone="blue">내 지표</Badge> : null}
            <Badge tone={item.archetype.includes('빠른') ? 'green' : item.archetype.includes('긴급') ? 'red' : item.archetype.includes('보완') ? 'amber' : 'slate'}>{item.archetype}</Badge>
          </div>
          <div style={{ marginTop: 8, color: 'var(--sub)', fontSize: 12.5, lineHeight: 1.65 }}>{item.strength}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11.5, color: 'var(--sub)', fontWeight: 800 }}>최근 7일 완료</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 2 }}>{item.completed7d}건</div>
        </div>
      </div>

      <div className="two-col-grid" style={{ marginTop: 14 }}>
        <MetricCard icon="chart" label="평균 처리시간" value={formatHours(item.avgCycleHours)} sub="생성~완료 기준" tone="blue" />
        <MetricCard icon="calendar" label="마감 준수율" value={item.onTimeRate == null ? '데이터 축적중' : `${item.onTimeRate}%`} sub="마감일 있는 업무 기준" tone="green" />
        <MetricCard icon="alert" label="긴급 반응속도" value={formatHours(item.urgentResponseAvg)} sub="첫 반응까지 걸린 시간" tone="red" />
        <MetricCard icon="task" label="현재 맡은 과제" value={`${item.activeCount}건`} sub={item.overdueActive ? `지연 ${item.overdueActive}건` : '지연 과제 없음'} tone={item.overdueActive ? 'amber' : 'slate'} />
      </div>

      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 16, background: 'linear-gradient(135deg,var(--bg-soft),#FFFFFF)', border: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 900, color: 'var(--text)' }}><Icon name="sparkle" size={14} /> 이번 주 보완 포인트</div>
        <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.7 }}>{item.care}</div>
      </div>
    </Card>
  );
}

export default function ReportTab({ tasks, coaches, me, branchName, onGoTasks }) {
  const report = buildReportData(tasks, coaches, me, branchName);
  const toast = useToast();
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const shareText = buildWeeklyShareText(report, me, branchName, aiSummary);
  const emailSubject = buildWeeklyEmailSubject(branchName);
  const emailBody = buildWeeklyEmailBody(report, me, branchName, aiSummary);
  const emailBundle = `제목: ${emailSubject}\n\n${emailBody}`;

  async function handleGenerateAiSummary() {
    setAiLoading(true);
    setAiError('');
    try {
      const text = await callAI(weeklyReportSummaryPrompt(report, branchName));
      setAiSummary(text.trim());
      toast.success('대표/센터장용 AI 요약을 만들었어요.', { title: 'AI 리포트 완료', duration: 1700 });
    } catch (err) {
      const message = err?.message || 'AI 요약을 만드는 중 문제가 생겼어요.';
      setAiError(message);
      toast.error(message, { title: 'AI 리포트 생성 실패' });
    } finally {
      setAiLoading(false);
    }
  }

  function handleExportSummaryPdf() {
    const result = exportWeeklySummaryPdf(report, me, branchName, { aiSummary });
    if (result.ok) {
      toast.info(`인쇄창에서 "PDF로 저장"을 선택하면 센터장용 요약 1장 PDF를 바로 저장할 수 있어요.${aiSummary ? ' 생성한 AI 요약도 함께 들어갑니다.' : ''}`, { title: '요약 리포트를 열었어요', duration: 3600 });
    } else {
      toast.error('브라우저 팝업 차단을 해제한 뒤 다시 시도해주세요.', { title: '요약 리포트를 열지 못했어요' });
    }
  }

  function handleExportDetailedPdf() {
    const result = exportWeeklyDetailedPdf(report, me, branchName, { aiSummary });
    if (result.ok) {
      toast.info(`인쇄창에서 "PDF로 저장"을 선택하면 상세 운영 리포트를 바로 저장할 수 있어요.${aiSummary ? ' 생성한 AI 요약도 함께 들어갑니다.' : ''}`, { title: '상세 리포트를 열었어요', duration: 3600 });
    } else {
      toast.error('브라우저 팝업 차단을 해제한 뒤 다시 시도해주세요.', { title: '상세 리포트를 열지 못했어요' });
    }
  }

  if (!report.hasData) {
    return (
      <EmptyState
        icon="chart"
        title="운영 리포트가 아직 비어 있어요"
        message="과제를 조금 더 운영하면 처리속도, 마감 준수율, 긴급 대응 속도를 자동으로 요약해드릴게요. 새 과제를 추가하고 완료 데이터를 쌓아보세요."
        tone="blue"
        action={<Button onClick={onGoTasks}>과제 보드로 이동</Button>}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {report.meSummary ? (
        <Card tone="warm" style={{ borderRadius: 26, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge tone="amber" icon="coach">내 업무 페이스</Badge>
                <Badge tone="slate">{report.meSummary.archetype}</Badge>
              </div>
              <div style={{ marginTop: 10, fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>{me.emoji} {me.name} 코치의 최근 흐름</div>
              <div style={{ marginTop: 6, color: 'var(--sub)', fontSize: 12.5, lineHeight: 1.7 }}>
                {report.meSummary.strength} {report.meSummary.care}
              </div>
            </div>
            <div style={{ minWidth: 92, textAlign: 'right' }}>
              <div style={{ fontSize: 11.5, color: 'var(--sub)', fontWeight: 800 }}>최근 7일 완료</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--primary)', marginTop: 2 }}>{report.meSummary.completed7d}</div>
            </div>
          </div>

          <div className="summary-grid" style={{ marginTop: 16 }}>
            <MetricCard icon="chart" label="평균 처리시간" value={formatHours(report.meSummary.avgCycleHours)} sub="과제 생성부터 완료까지" tone="blue" />
            <MetricCard icon="calendar" label="마감 준수율" value={report.meSummary.onTimeRate == null ? '데이터 축적중' : `${report.meSummary.onTimeRate}%`} sub="마감 있는 업무 기준" tone="green" />
            <MetricCard icon="alert" label="긴급 반응속도" value={formatHours(report.meSummary.urgentResponseAvg)} sub="첫 체크/코멘트까지" tone="red" />
            <MetricCard icon="task" label="현재 담당" value={`${report.meSummary.activeCount}건`} sub={report.meSummary.overdueActive ? `지연 ${report.meSummary.overdueActive}건` : '지연 없음'} tone={report.meSummary.overdueActive ? 'amber' : 'slate'} />
          </div>
        </Card>
      ) : null}

      <Card style={{ borderRadius: 26, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge tone="blue" icon="chart">운영 리포트</Badge>
              <Badge tone="slate">최근 7일 · {branchName}</Badge>
            </div>
            <div style={{ marginTop: 10, fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>센터 운영 흐름을 숫자로 정리했어요</div>
            <div style={{ marginTop: 6, color: 'var(--sub)', fontSize: 12.5, lineHeight: 1.7 }}>
              처리속도만 보지 않고 마감 준수, 긴급 반응, 현재 지연 과제까지 함께 봅니다.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge tone="green">완료 {report.summary.completed7d}건</Badge>
            <Badge tone={report.summary.overdueActive ? 'amber' : 'blue'}>지연 {report.summary.overdueActive}건</Badge>
            <Button variant="dark" icon="robot" onClick={handleGenerateAiSummary} disabled={aiLoading}>{aiLoading ? 'AI 요약 생성 중...' : aiSummary ? 'AI 요약 새로고침' : 'AI 요약 생성'}</Button>
            <Button variant="secondary" icon="printer" onClick={handleExportSummaryPdf}>요약 1장 PDF</Button>
            <Button variant="warm" icon="download" onClick={handleExportDetailedPdf}>상세 리포트 PDF</Button>
          </div>
        </div>

        <div className="summary-grid" style={{ marginTop: 16 }}>
          <MetricCard icon="check" label="최근 7일 완료" value={`${report.summary.completed7d}건`} sub={`${report.summary.activeCount}건 진행 중`} tone="blue" />
          <MetricCard icon="calendar" label="마감 준수율" value={report.summary.onTimeRate == null ? '데이터 축적중' : `${report.summary.onTimeRate}%`} sub="마감일이 있는 완료 업무 기준" tone="green" />
          <MetricCard icon="chart" label="평균 처리시간" value={formatHours(report.summary.avgCycleHours)} sub="생성부터 완료까지 평균" tone="amber" />
          <MetricCard icon="alert" label="긴급 대응속도" value={formatHours(report.summary.urgentResponseAvg)} sub="첫 반응까지 걸린 시간" tone="red" />
        </div>
      </Card>

      <Card style={{ borderRadius: 24, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge tone="violet" icon="megaphone">공유용 문안</Badge>
              <Badge tone="slate">보고 · 카톡 · 메일</Badge>
            </div>
            <div style={{ marginTop: 10, fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>숫자와 AI 요약을 바로 공유용 문장으로 정리했어요</div>
            <div style={{ marginTop: 6, color: 'var(--sub)', fontSize: 12.5, lineHeight: 1.7 }}>
              센터장 보고, 단톡방 공유, 메일 본문까지 복사해서 바로 붙여넣을 수 있습니다. AI 요약을 만들면 문구도 더 자연스럽게 반영돼요.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <CopyButton text={shareText} tone="blue" label="공유용 텍스트 복사" copiedLabel="텍스트 복사됨" />
            <CopyButton text={emailSubject} tone="slate" label="메일 제목 복사" copiedLabel="제목 복사됨" />
            <CopyButton text={emailBody} tone="green" label="메일 본문 복사" copiedLabel="본문 복사됨" />
            <CopyButton text={emailBundle} tone="amber" label="제목+본문 복사" copiedLabel="전체 복사됨" />
          </div>
        </div>

        <div className="two-col-grid" style={{ marginTop: 16 }}>
          <div style={{ border: '1px solid var(--line)', borderRadius: 18, background: 'linear-gradient(135deg,#FFFFFF,#F8FAFC)', padding: '14px 15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 900, color: 'var(--text)' }}><Icon name="task" size={14} /> 공유용 텍스트</div>
              <Badge tone="blue">짧게 공유</Badge>
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{shareText}</div>
          </div>

          <div style={{ border: '1px solid var(--line)', borderRadius: 18, background: 'linear-gradient(135deg,#FFFFFF,#F8FAFC)', padding: '14px 15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 900, color: 'var(--text)' }}><Icon name="mail" size={14} /> 메일 본문 미리보기</div>
              <Badge tone="green">정식 보고용</Badge>
            </div>
            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
              <div style={{ padding: '10px 12px', borderRadius: 14, background: 'var(--bg-soft)', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 800 }}>메일 제목</div>
                <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--text)', fontWeight: 800 }}>{emailSubject}</div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 280, overflow: 'auto', paddingRight: 4 }}>{emailBody}</div>
            </div>
          </div>
        </div>
      </Card>

      <Card tone="dark" style={{ borderRadius: 24, padding: 18, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', right: -30, top: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 900 }}><Icon name="sparkle" size={16} /> AI 운영 요약</div>
              <div style={{ marginTop: 6, fontSize: 12.5, color: '#CBD5E1', lineHeight: 1.65 }}>
                대표/센터장이 바로 읽을 수 있게 최근 7일 흐름을 5줄 안으로 압축해드려요. 생성해두면 PDF에도 같이 넣을 수 있어요.
              </div>
            </div>
            {aiSummary ? <CopyButton text={aiSummary} tone="blue" /> : null}
          </div>
          {aiError ? <div style={{ marginTop: 14 }}><ErrorBanner message={aiError} onDismiss={() => setAiError('')} tone="info" /></div> : null}
          {aiSummary ? (
            <div style={{ marginTop: 14, padding: '14px 15px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'grid', gap: 8 }}>
                {aiSummary.split(/\n+/).filter(Boolean).map((line, idx) => (
                  <div key={`${idx}-${line.slice(0, 12)}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 999, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff', flex: '0 0 auto' }}>{idx + 1}</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.7, color: '#F8FAFC' }}>{line}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <EmptyState compact icon="robot" title="AI 운영 요약을 아직 만들지 않았어요" message="숫자만으로 보기 어려운 흐름을 대표/센터장용 문장으로 정리해드려요. 버튼 한 번이면 생성됩니다." tone="blue" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)' }} action={<Button variant="secondary" icon="sparkle" onClick={handleGenerateAiSummary} disabled={aiLoading}>{aiLoading ? '생성 중...' : 'AI 요약 생성'}</Button>} />
            </div>
          )}
        </div>
      </Card>

      <Card style={{ borderRadius: 24, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 900, color: 'var(--text)' }}><Icon name="alert" size={15} /> 병목 과제 체크</div>
        <div style={{ marginTop: 4, color: 'var(--sub)', fontSize: 12.5 }}>지연되었거나 긴급도가 높은 과제를 먼저 확인하세요.</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {report.bottlenecks.length ? report.bottlenecks.map((task) => (
            <div key={task.id} style={{ border: '1px solid var(--line)', borderRadius: 18, padding: '12px 14px', background: 'linear-gradient(135deg,#FFFFFF,#F8FAFC)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{task.title}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {task.pri === 'high' ? <Badge tone="red">긴급</Badge> : null}
                    {task.overdueDays > 0 ? <Badge tone="amber">지연 {task.overdueDays}일</Badge> : null}
                    {task.due ? <Badge tone="slate">마감 {task.due}</Badge> : null}
                  </div>
                </div>
                {task.assignees.length ? <Badge tone="slate">{task.assignees.join(', ')}</Badge> : null}
              </div>
            </div>
          )) : <EmptyState compact icon="check" title="병목 과제가 많지 않아요" message="현재는 긴급/지연 기준으로 크게 밀리는 과제가 보이지 않아요." tone="green" />}
        </div>
      </Card>

      <div style={{ display: 'grid', gap: 14 }}>
        {report.coaches.length ? report.coaches.map((item) => <CoachInsightCard key={item.coachId} item={item} me={me} />) : (
          <EmptyState compact icon="coach" title="코치별 지표를 준비 중이에요" message="코치가 맡은 과제가 쌓이면 개인별 처리 흐름이 자동으로 정리돼요." tone="blue" />
        )}
      </div>
    </div>
  );
}
