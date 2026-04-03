import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth";
import { db } from "../lib/db";
import { addDaysStr, canSee, CATS, dday, ddayColor, ddayLabel, nextDue, nowIso, todayStr, uid } from "../lib/constants";
import { sendPush, shortenText } from "../lib/push";
import { Badge, Button, Card, EmptyState, ErrorBanner, Icon, Pill, StatCard, ThemeSwitcher } from "./Common";
import { useToast } from "../toast";
import TaskTree from "./TaskTree";
import TemplateModal from "./TemplateModal";
import AdminPanel from "./AdminPanel";
import RecurModal from "./RecurModal";
import AddTaskModal from "./AddTaskModal";
import AiAssistantTab from "./AiAssistantTab";
import ReportTab from "./ReportTab";
import { useNotifications } from "../hooks/useNotifications";
import { useConfirm } from "../confirm";


const TRACKED_FIELDS = ["title", "cat", "pri", "due", "memo", "recur", "assignees", "completed", "completedAt", "deleted", "deletedAt", "open", "firstResponseAt"];

function stableJson(value) {
  return JSON.stringify(value ?? null);
}

function diffSubIds(prevSubs = [], nextSubs = []) {
  const prevMap = new Map((prevSubs || []).map((sub) => [sub.id, stableJson(sub)]));
  const nextMap = new Map((nextSubs || []).map((sub) => [sub.id, stableJson(sub)]));
  const changed = [];
  for (const [id, sig] of nextMap.entries()) {
    if (prevMap.get(id) !== sig) changed.push(id);
  }
  return changed;
}

function removedSubIds(prevSubs = [], nextSubs = []) {
  const nextIds = new Set((nextSubs || []).map((sub) => sub.id));
  return (prevSubs || []).map((sub) => sub.id).filter((id) => !nextIds.has(id));
}

function diffCommentIds(prevComments = [], nextComments = []) {
  const prevMap = new Map((prevComments || []).map((comment) => [comment.id, stableJson(comment)]));
  const changed = [];
  for (const comment of nextComments || []) {
    if (prevMap.get(comment.id) !== stableJson(comment)) changed.push(comment.id);
  }
  return changed;
}

function buildTaskMeta(prevTask, nextTask) {
  const changedFields = [];
  for (const field of TRACKED_FIELDS) {
    if (stableJson(prevTask?.[field]) !== stableJson(nextTask?.[field])) changedFields.push(field);
  }

  const changedSubIds = diffSubIds(prevTask?.subs || [], nextTask?.subs || []);
  const removedSubs = removedSubIds(prevTask?.subs || [], nextTask?.subs || []);
  if (changedSubIds.length || removedSubs.length) changedFields.push("subs");

  const changedCommentIds = diffCommentIds(prevTask?.comments || [], nextTask?.comments || []);
  if (changedCommentIds.length) changedFields.push("comments");

  return {
    baseVersion: Number(prevTask?.version || 0),
    changedFields: Array.from(new Set(changedFields)),
    changedSubIds,
    removedSubIds: removedSubs,
    changedCommentIds,
  };
}

export default function Dashboard({ coaches: initCoaches, branches: initBranches, initialTasks = [], onLoggedOut }) {
  const me = useAuth();
  const isOwner = me.role === "owner";
  const [coaches, setCoaches] = useState(initCoaches);
  const [branches, setBranches] = useState(initBranches);
  const [curBranch, setCurBranch] = useState(isOwner ? initBranches[0]?.id : me.branch_id);
  const [viewTab, setViewTab] = useState("tasks");
  const tabOrder = ["tasks", "reports", "ai"];
  const br = branches.find((b) => b.id === curBranch);
  const branchName = br?.name || "";
  const branchCoaches = coaches.filter((c) => c.branch_id === curBranch || c.role === "owner");

  const [allTasks, setAllTasks] = useState(initialTasks);
  const [loaded, setLoaded] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [hideCompleted, setHideCompleted] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [nf, setNf] = useState({ title: "", cat: "member", pri: "mid", due: "", subsText: "", recur: "none", assignees: [] });
  const [recurModal, setRecurModal] = useState(null);
  const [commentSeen, setCommentSeen] = useState({});
  const commentSeenKey = `gh-comment-seen:${me.id}`;
  const [syncing, setSyncing] = useState(false);
  const [banner, setBanner] = useState("");
  const toast = useToast();
  const confirmAction = useConfirm();
  const allTasksRef = useRef([]);
  const syncCountRef = useRef(0);

  useEffect(() => {
    allTasksRef.current = allTasks;
  }, [allTasks]);

  useEffect(() => {
    setAllTasks(initialTasks || []);
    setLoaded(true);
  }, [initialTasks]);


  useEffect(() => {
    try {
      const raw = localStorage.getItem(commentSeenKey);
      if (raw) setCommentSeen(JSON.parse(raw));
    } catch {}
  }, [commentSeenKey]);

  useEffect(() => {
    localStorage.setItem(commentSeenKey, JSON.stringify(commentSeen));
  }, [commentSeen, commentSeenKey]);

  const notifyError = useCallback((message, title = "문제가 있어요") => {
    setBanner(message);
    toast.error(message, { title });
  }, [toast]);

  const beginSync = () => {
    syncCountRef.current += 1;
    setSyncing(true);
  };
  const endSync = () => {
    syncCountRef.current = Math.max(0, syncCountRef.current - 1);
    if (syncCountRef.current === 0) setSyncing(false);
  };

  const refreshTasks = useCallback(async () => {
    const data = isOwner ? await db.loadAllTasks() : await db.loadTasks(me.branch_id);
    setAllTasks(data || []);
  }, [isOwner, me.branch_id]);

  const persistTask = useCallback(async (task) => {
    beginSync();
    try {
      const saved = await db.saveTask(task);
      if (saved?.id) {
        setAllTasks((prev) => prev.map((item) => item.id === saved.id ? saved : item));
      }
      if (saved?.__mergeNotice) {
        toast.info(saved.__mergeNotice, { title: "다른 변경과 병합됨" });
      }
    } catch (error) {
      console.error(error);
      notifyError("저장 중 오류가 발생해 최신 데이터를 다시 불러왔어요.", "저장 실패");
      await refreshTasks();
    } finally {
      endSync();
    }
  }, [notifyError, refreshTasks, toast]);

  const persistTaskMany = useCallback(async (tasks) => {
    beginSync();
    try {
      const savedTasks = await db.saveTaskMany(tasks);
      if (savedTasks?.length) {
        const mergedMap = new Map(savedTasks.map((item) => [item.id, item]));
        setAllTasks((prev) => {
          const updated = prev.map((item) => mergedMap.get(item.id) || item);
          const existingIds = new Set(updated.map((item) => item.id));
          for (const item of savedTasks) {
            if (!existingIds.has(item.id)) updated.push(item);
          }
          return updated;
        });
      }
      const mergedCount = (savedTasks || []).filter((item) => item.__mergeNotice).length;
      if (mergedCount > 0) {
        toast.info(`동시에 수정된 과제 ${mergedCount}건을 안전하게 병합했어요.`, { title: "자동 병합 완료" });
      }
    } catch (error) {
      console.error(error);
      notifyError("저장 중 오류가 발생해 최신 데이터를 다시 불러왔어요.", "저장 실패");
      await refreshTasks();
    } finally {
      endSync();
    }
  }, [notifyError, refreshTasks, toast]);

  const refreshData = useCallback(async () => {
    const data = await db.bootstrap();
    setCoaches(data.coaches || []);
    setBranches(data.branches || []);
    setAllTasks(data.tasks || []);
  }, []);


  const annotateTaskForSave = useCallback((nextTask, prevTask = null) => {
    const stamped = { ...nextTask };
    const now = nowIso();
    stamped.createdAt = prevTask?.createdAt || stamped.createdAt || now;
    stamped.updatedAt = now;
    stamped.version = Number(prevTask?.version || stamped.version || 0);

    const prevDoneCount = (prevTask?.subs || []).filter((sub) => sub.done).length;
    const nextDoneCount = (stamped.subs || []).filter((sub) => sub.done).length;
    const prevCommentCount = (prevTask?.comments || []).length;
    const nextCommentCount = (stamped.comments || []).length;

    if (!stamped.firstResponseAt && prevTask && (nextDoneCount > prevDoneCount || nextCommentCount > prevCommentCount)) {
      stamped.firstResponseAt = now;
    }

    if (!stamped.firstResponseAt && !prevTask && ((stamped.comments || []).length || (stamped.subs || []).some((sub) => sub.done))) {
      stamped.firstResponseAt = now;
    }

    if (stamped.completed) stamped.completedAt = stamped.completedAt || now;
    else stamped.completedAt = null;

    stamped.__meta = buildTaskMeta(prevTask, stamped);
    return stamped;
  }, []);

  useEffect(() => {
    const runRefresh = () => {
      if (document.visibilityState === "hidden" || syncCountRef.current > 0 || !navigator.onLine) return;
      refreshData().catch((error) => {
        console.error("poll refresh data", error);
        setBanner("자동 동기화가 잠시 지연되고 있어요. 잠시 후 다시 시도합니다.");
      });
    };
    const timer = setInterval(runRefresh, 45000);
    const handleVisible = () => runRefresh();
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("online", handleVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("online", handleVisible);
    };
  }, [refreshData]);

  let vis = allTasks.filter((t) => t.branchId === curBranch && !t.deleted && canSee(t, me));
  if (hideCompleted) vis = vis.filter((t) => !t.completed);
  if (search.trim()) {
    const q = search.toLowerCase();
    vis = vis.filter((t) => t.title.toLowerCase().includes(q) || t.subs.some((s) => s.t.toLowerCase().includes(q)) || (t.comments || []).some((c) => c.text.toLowerCase().includes(q)));
  }
  const completedCount = allTasks.filter((t) => t.branchId === curBranch && t.completed && !t.deleted).length;
  const trashedTasks = allTasks.filter((t) => t.branchId === curBranch && t.deleted);
  const active = allTasks.filter((t) => t.branchId === curBranch && !t.completed && !t.deleted && canSee(t, me));
  const urgentN = active.filter((t) => t.pri === "high" && t.subs.some((s) => !s.done)).length;
  const overdueN = active.filter((t) => t.due && dday(t.due) < 0 && t.subs.some((s) => !s.done)).length;
  const totalS = vis.reduce((a, t) => a + t.subs.length, 0);
  const doneS = vis.reduce((a, t) => a + t.subs.filter((s) => s.done).length, 0);
  const pct = totalS === 0 ? 0 : Math.round((doneS / totalS) * 100);

  const notifications = useNotifications({ tasks: active, me, branchName });

  const maybePushTaskUpdate = useCallback(async (nextTask, prevTask) => {
    if (!nextTask || nextTask.deleted || nextTask.completed) return;

    const becameUrgent = nextTask.pri === "high" && (!prevTask || prevTask.pri !== "high");
    if (becameUrgent) {
      await sendPush({
        branchId: nextTask.branchId,
        recipients: nextTask.assignees?.length ? nextTask.assignees : null,
        excludeCoachId: me.id,
        title: "🔴 긴급 과제가 등록됐어요",
        body: `${nextTask.title} · ${branchName || "센터"}`,
        tag: `urgent-${nextTask.id}`,
        url: "/",
        taskId: nextTask.id,
        kind: "urgent-task",
      }).catch((error) => console.error("push urgent", error));
    }

    const prevComments = prevTask?.comments || [];
    const nextComments = nextTask.comments || [];
    if (nextComments.length > prevComments.length) {
      const last = nextComments[nextComments.length - 1];
      if (last?.coachId && last.coachId !== me.id) return;
      const commentRecipients = Array.isArray(nextTask.assignees) ? nextTask.assignees.filter(Boolean) : [];
      if (commentRecipients.length === 0) return;
      await sendPush({
        branchId: nextTask.branchId,
        recipients: commentRecipients,
        includeOwners: false,
        excludeCoachId: me.id,
        title: "💬 새 코멘트가 도착했어요",
        body: `${nextTask.title} · ${last?.name || "누군가"}: ${shortenText(last?.text || "메시지", 80)}`,
        tag: `comment-${nextTask.id}`,
        url: "/",
        taskId: nextTask.id,
        kind: "comment",
      }).catch((error) => console.error("push comment", error));
    }
  }, [branchName, me.id]);

  const upd = useCallback((task) => {
    const prevTask = allTasksRef.current.find((x) => x.id === task.id);
    const stampedTask = annotateTaskForSave(task, prevTask);
    setAllTasks((prev) => prev.map((x) => (x.id === task.id ? stampedTask : x)));
    persistTask(stampedTask);
    maybePushTaskUpdate(stampedTask, prevTask);
  }, [annotateTaskForSave, maybePushTaskUpdate, persistTask]);

  const softDel = useCallback(async (id) => {
    const ok = await confirmAction({
      title: "휴지통으로 이동할까요?",
      message: "지금은 목록에서 사라지지만, 휴지통에서 다시 복원할 수 있어요.",
      confirmLabel: "휴지통으로 이동",
      tone: "warm",
    });
    if (!ok) return;
    const prevTask = allTasksRef.current.find((t) => t.id === id);
    if (!prevTask) return;
    const nextTask = annotateTaskForSave({ ...prevTask, deleted: true, deletedAt: new Date().toISOString() }, prevTask);
    setAllTasks((prev) => prev.map((t) => t.id === id ? nextTask : t));
    persistTask(nextTask);
  }, [confirmAction, persistTask]);

  const restore = useCallback((id) => {
    const prevTask = allTasksRef.current.find((t) => t.id === id);
    if (!prevTask) return;
    const nextTask = annotateTaskForSave({ ...prevTask, deleted: false, deletedAt: null }, prevTask);
    setAllTasks((prev) => prev.map((t) => t.id === id ? nextTask : t));
    persistTask(nextTask);
  }, [persistTask]);

  const permDel = useCallback(async (id) => {
    const ok = await confirmAction({
      title: "과제를 영구 삭제할까요?",
      message: "삭제한 과제는 되돌릴 수 없어요. 기록과 코멘트도 함께 사라집니다.",
      details: "휴지통에 있는 과제를 완전히 지울 때만 사용해 주세요.",
      confirmLabel: "영구 삭제",
      tone: "danger",
    });
    if (!ok) return;
    setAllTasks((prev) => prev.filter((t) => t.id !== id));
    beginSync();
    try {
      await db.deleteTask(id);
      toast.success("과제를 완전히 삭제했어요.", { title: "삭제 완료" });
    } catch (error) {
      console.error(error);
      notifyError("삭제 중 오류가 발생해 최신 데이터를 다시 불러왔어요.", "삭제 실패");
      await refreshTasks();
    } finally {
      endSync();
    }
  }, [confirmAction, notifyError, refreshTasks, toast]);

  const complete = useCallback((id) => {
    const prevTask = allTasksRef.current.find((t) => t.id === id);
    if (!prevTask) return;
    const nextTask = annotateTaskForSave({ ...prevTask, completed: true }, prevTask);
    setAllTasks((prev) => prev.map((t) => t.id === id ? nextTask : t));
    persistTask(nextTask);
  }, [persistTask]);

  const doRecreate = useCallback(() => {
    if (!recurModal) return;
    const task = allTasksRef.current.find((x) => x.id === recurModal);
    if (!task) return;
    const finishedTask = annotateTaskForSave({ ...task, completed: true }, task);
    const created = annotateTaskForSave({
      ...task,
      id: uid(),
      completed: false,
      open: true,
      due: nextDue(task.due, task.recur),
      subs: task.subs.map((s) => ({ ...s, id: uid(), done: false, doneBy: null, doneEmoji: null, doneAt: null, doneAtISO: null })),
      comments: [],
      firstResponseAt: null,
      deleted: false,
      deletedAt: null,
    }, null);
    setAllTasks((prev) => prev.map((x) => x.id === recurModal ? finishedTask : x).concat(created));
    persistTaskMany([finishedTask, created]);
    maybePushTaskUpdate(created, null);
    setRecurModal(null);
  }, [maybePushTaskUpdate, persistTaskMany, recurModal]);

  const resetForm = () => setNf({ title: "", cat: "member", pri: "mid", due: "", subsText: "", recur: "none", assignees: [] });
  const add = () => {
    if (!nf.title.trim()) {
      toast.info("과제명을 먼저 입력해 주세요.", { title: "과제 추가" });
      return;
    }
    setBanner("");
    const subs = nf.subsText.split("\n").map((s) => s.trim()).filter(Boolean).map((s) => ({ id: uid(), t: s, done: false }));
    const task = annotateTaskForSave({ id: uid(), title: nf.title.trim(), cat: nf.cat, pri: nf.pri, due: nf.due, memo: "", open: true, recur: nf.recur, assignees: nf.assignees, branchId: curBranch, subs, comments: [], completed: false, deleted: false, firstResponseAt: null }, null);
    setAllTasks((prev) => [...prev, task]);
    persistTask(task);
    maybePushTaskUpdate(task, null);
    resetForm();
    setShowAdd(false);
  };

  const loadTemplate = (tp) => {
    setNf({ title: tp.title, cat: tp.cat, pri: tp.pri, due: addDaysStr(todayStr(), tp.dueOffset || 0), subsText: tp.subs.join("\n"), recur: tp.recur, assignees: [] });
    setShowTemplates(false);
    setShowAdd(true);
  };

  const markCommentsSeen = useCallback((taskId, count) => setCommentSeen((prev) => (prev[taskId] === count ? prev : { ...prev, [taskId]: count })), []);

  const switchBr = (bid) => {
    setBanner("");
    setCurBranch(bid);
    setFilter("all");
    setSearch("");
    setShowTrash(false);
  };

  const focus = vis.filter((t) => t.due && dday(t.due) !== null && dday(t.due) <= 3 && t.subs.some((s) => !s.done)).sort((a, b) => dday(a.due) - dday(b.due));
  const list = (filter === "all" ? [...vis] : vis.filter((t) => t.cat === filter)).sort((a, b) => {
    const ad = a.subs.every((s) => s.done) && a.subs.length > 0;
    const bd = b.subs.every((s) => s.done) && b.subs.length > 0;
    if (ad !== bd) return ad ? 1 : -1;
    const order = { high: 0, mid: 1, low: 2 };
    if (order[a.pri] !== order[b.pri]) return order[a.pri] - order[b.pri];
    if (a.due && b.due) return a.due.localeCompare(b.due);
    return a.due ? -1 : 1;
  });

  const logout = async () => {
    try {
      await db.logout();
    } finally {
      onLoggedOut?.();
      window.location.reload();
    }
  };

  const unseenCommentTotal = useMemo(() => list.reduce((sum, task) => sum + Math.max(0, (task.comments || []).length - (commentSeen[task.id] || 0)), 0), [list, commentSeen]);
  const todayLabel = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

  if (!loaded) return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 12, background: "var(--body-gradient)" }}><span className="ai-spin" style={{ color: "var(--primary)" }}><Icon name="sparkle" size={24} /></span><span style={{ color: "var(--sub)", fontSize: 14, fontWeight: 700 }}>불러오는 중...</span></div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--body-gradient)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -120, right: -90, width: 320, height: 320, borderRadius: "50%", background: "var(--hero-accent-a)" }} />
      <div style={{ position: "absolute", top: 240, left: -120, width: 280, height: 280, borderRadius: "50%", background: "var(--hero-accent-b)" }} />

      <div className="app-shell">
        <Card style={{ borderRadius: 28, overflow: "hidden", marginBottom: 16, padding: 0 }}>
          <div style={{ background: "var(--hero-gradient)", padding: "22px 18px 20px", color: "#fff", position: "relative" }}>
            <div style={{ position: "absolute", right: -40, top: -30, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 68%)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, position: "relative" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.4 }}>좋은습관<span style={{ color: "#FF9C73" }}>PT</span></span>
                  <span style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", fontSize: 11.5, color: "#E2E8F0", fontWeight: 700 }}>{todayLabel}</span>
                  {syncing && <span style={{ fontSize: 11.5, color: "#FDBA74", fontWeight: 800 }}>저장 중…</span>}
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: "#CBD5E1", lineHeight: 1.6 }}>
                  {branchName}의 오늘 할 일과 팀 진행 상황을 한눈에 확인하세요.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                  <Badge tone="dark" icon="pin">{branchName}</Badge>
                  <Badge tone="dark">{me.emoji} {me.name}</Badge>
                  <Badge tone="dark" icon="comment" style={{ color: unseenCommentTotal > 0 ? "#FDE68A" : "#E2E8F0" }}>새 코멘트 {unseenCommentTotal}</Badge>
                </div>
                <div style={{ marginTop: 14, maxWidth: 260 }}><ThemeSwitcher compact /></div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {isOwner && <Button onClick={() => setShowAdmin(true)} variant="ghost" icon="settings" style={{ background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.08)", color: "#E2E8F0", padding: "10px 12px" }} /> }
                <Button onClick={logout} variant="ghost" icon="logout" style={{ background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.08)", color: "#E2E8F0", padding: "10px 12px", fontSize: 12 }}>로그아웃</Button>
              </div>
            </div>

            <div className="summary-grid" style={{ marginTop: 18 }}>
              <StatCard icon="chart" label="진행률" value={`${pct}%`} sub={`${doneS}/${totalS} 세부과제 완료`} tone="blue" progress={pct} />
              <StatCard icon="alert" label="긴급" value={urgentN} sub="즉시 확인이 필요한 과제" tone="red" />
              <StatCard icon="calendar" label="지연" value={overdueN} sub="마감이 지난 과제" tone="amber" />
              <StatCard icon="check" label="완료" value={completedCount} sub="누적 완료 처리" tone="green" />
            </div>
          </div>
        </Card>

        <div className="scroll-row" style={{ marginBottom: 14 }}>
          {isOwner ? branches.map((b) => (
            <button key={b.id} onClick={() => switchBr(b.id)} style={{ padding: "10px 16px", borderRadius: 16, border: curBranch === b.id ? "none" : "1px solid #E2E8F0", cursor: "pointer", fontSize: 12.5, fontWeight: 800, fontFamily: "inherit", background: curBranch === b.id ? `linear-gradient(135deg,${b.color},${b.color}CC)` : "rgba(255,255,255,0.82)", color: curBranch === b.id ? "#fff" : "#334155", whiteSpace: "nowrap", boxShadow: curBranch === b.id ? "0 12px 24px rgba(15,23,42,0.12)" : "0 8px 18px rgba(148,163,184,0.08)" }}><Icon name="pin" size={13} /> {b.name}</button>
          )) : <div style={{ padding: "10px 16px", borderRadius: 16, background: `linear-gradient(135deg,${br?.color || "#FF6B35"},${br?.color || "#FF6B35"}CC)`, fontSize: 12.5, fontWeight: 800, color: "#fff", boxShadow: "0 12px 24px rgba(15,23,42,0.12)" }}><Icon name="pin" size={13} /> {branchName}</div>}
        </div>


        {banner ? <ErrorBanner message={banner} onDismiss={() => setBanner("")} /> : null}

        <Card className="tab-switcher" style={{ borderRadius: 22, padding: 8, marginBottom: 16, position: "relative", overflow: "hidden" }}>
          <div
            className={`tab-switcher-indicator ${viewTab === "ai" ? "is-ai" : "is-tasks"}`}
            style={{
              position: "absolute",
              top: 8,
              bottom: 8,
              left: `calc(${tabOrder.indexOf(viewTab)} * (100% / 3) + 8px)`,
              width: "calc((100% / 3) - 11px)",
              borderRadius: 16,
              background: viewTab === "ai" ? "linear-gradient(135deg,var(--navy),#334155)" : viewTab === "reports" ? "linear-gradient(135deg,#2563EB,#14B8A6)" : "var(--primary-gradient)",
              boxShadow: viewTab === "ai" ? "0 14px 26px rgba(15,23,42,0.18)" : viewTab === "reports" ? "0 14px 26px rgba(37,99,235,0.2)" : "0 14px 26px rgba(255,107,53,0.24)",
            }}
          />
          <div style={{ display: "flex", gap: 8, position: "relative", zIndex: 1 }}>
            <button className={`tab-pill ${viewTab === "tasks" ? "is-active" : ""}`} onClick={() => setViewTab("tasks")} style={{ color: viewTab === "tasks" ? "#fff" : "#475569" }}><Icon name="task" size={14} /> 과제 보드</button>
            <button className={`tab-pill ${viewTab === "reports" ? "is-active" : ""}`} onClick={() => setViewTab("reports")} style={{ color: viewTab === "reports" ? "#fff" : "#475569" }}><Icon name="chart" size={14} /> 운영 리포트</button>
            <button className={`tab-pill ${viewTab === "ai" ? "is-active" : ""}`} onClick={() => setViewTab("ai")} style={{ color: viewTab === "ai" ? "#fff" : "#475569" }}><Icon name="robot" size={14} /> AI 실무 탭</button>
          </div>
        </Card>

        <div key={viewTab} className="tab-panel-enter">
        {viewTab === "tasks" ? (
          <>
            <div className="glass-card" style={{ borderRadius: 22, padding: 14, marginBottom: 14 }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: "#94A3B8" }}><Icon name="search" size={15} /></span>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="과제명, 세부과제, 코멘트 검색" style={{ width: "100%", padding: "13px 42px 13px 40px", borderRadius: 16, border: "1.5px solid #E2E8F0", fontSize: 13.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "rgba(248,250,252,0.92)" }} />
                {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#CBD5E1" }}><Icon name="close" size={14} /></button>}
              </div>
              <div className="two-col-grid" style={{ marginTop: 12 }}>
                <button onClick={() => setShowTemplates(true)} style={{ padding: 13, borderRadius: 16, border: "1px solid #FDE68A", background: "linear-gradient(135deg,#FFFBEB,#FFF7ED)", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, color: "#B45309", textAlign: "left" }}>
                  <div style={{ fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}><Icon name="task" size={14} /> 루틴 템플릿</div>
                  <div style={{ fontSize: 11.5, color: "#C2410C", marginTop: 4, fontWeight: 600 }}>자주 쓰는 과제를 바로 불러오기</div>
                </button>
                <button onClick={() => { resetForm(); setShowAdd(true); }} style={{ padding: 13, borderRadius: 16, border: "1px solid #FED7AA", background: "linear-gradient(135deg,#FFF7ED,#FFFFFF)", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, color: "#C2410C", textAlign: "left" }}>
                  <div style={{ fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}><Icon name="plus" size={14} /> 새 과제 만들기</div>
                  <div style={{ fontSize: 11.5, color: "#9A3412", marginTop: 4, fontWeight: 600 }}>오늘 할 일을 바로 추가</div>
                </button>
              </div>
            </div>

            {focus.length > 0 && !search && (
              <div className="glass-card" style={{ borderRadius: 22, padding: 16, marginBottom: 14, background: "linear-gradient(135deg,rgba(255,248,243,.96),rgba(255,255,255,.9))" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#C2410C", display: "flex", alignItems: "center", gap: 8 }}><Icon name="alert" size={15} /> 집중 과제</div>
                    <div style={{ fontSize: 11.5, color: "#9A3412", marginTop: 4 }}>오늘 우선 볼 필요가 있는 과제만 모았어요.</div>
                  </div>
                  <Badge tone="orange" icon="alert" style={{ background: "rgba(255,255,255,0.88)" }}>{focus.length}건</Badge>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {focus.slice(0, 4).map((task) => {
                    const cat = CATS[task.cat];
                    const done = task.subs.filter((s) => s.done).length;
                    const next = task.subs.find((s) => !s.done);
                    return <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, background: "rgba(255,255,255,0.88)", border: "1px solid rgba(253,220,184,0.9)" }}><span style={{ fontSize: 12, fontWeight: 900, color: ddayColor(task.due), minWidth: 52, textAlign: "center", background: dday(task.due) <= 0 ? "#FEE2E2" : "#FFF7ED", padding: "6px 8px", borderRadius: 10 }}>{ddayLabel(task.due)}</span><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}><Icon name={task.cat === "member" ? "users" : task.cat === "coach" ? "coach" : task.cat === "marketing" ? "megaphone" : "settings"} size={14} /> {task.title}</div>{next && <div style={{ fontSize: 11.5, color: "#D97706", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>다음: {next.t}</div>}</div><span style={{ fontSize: 11.5, fontWeight: 800, color: cat.color, background: cat.bg, padding: "6px 8px", borderRadius: 10 }}>{done}/{task.subs.length}</span></div>;
                  })}
                </div>
              </div>
            )}

            <div className="scroll-row" style={{ marginBottom: 10 }}>
              <Pill active={filter === "all"} onClick={() => setFilter("all")} color="#475569" icon="task">전체 {vis.length}</Pill>
              {Object.entries(CATS).map(([k, v]) => <Pill key={k} active={filter === k} onClick={() => setFilter(filter === k ? "all" : k)} color={v.color} icon={k === "member" ? "users" : k === "coach" ? "coach" : k === "marketing" ? "megaphone" : "settings"}>{v.label}</Pill>)}
            </div>

            <div className="glass-card" style={{ borderRadius: 18, padding: 12, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {completedCount > 0 && <button onClick={() => setHideCompleted(!hideCompleted)} style={{ fontSize: 12, color: "#475569", background: hideCompleted ? "#F8FAFC" : "#ECFDF5", border: "1px solid #E2E8F0", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, padding: "8px 12px" }}>✅ 완료과제 {completedCount}건 {hideCompleted ? "보기" : "숨김"}</button>}
                {(trashedTasks.length > 0 || showTrash) && <button onClick={() => setShowTrash(!showTrash)} style={{ fontSize: 12, color: showTrash ? "#DC2626" : "#64748B", background: showTrash ? "#FEF2F2" : "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, padding: "8px 12px" }}><Icon name="trash" size={13} /> 휴지통 {trashedTasks.length}건</button>}
              </div>
              <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Icon name={filter === "all" ? "task" : filter === "member" ? "users" : filter === "coach" ? "coach" : filter === "marketing" ? "megaphone" : "settings"} size={13} /> {filter === "all" ? "전체 보드" : `${CATS[filter]?.label} 보드`}</div>
            </div>

            {showTrash && <div className="glass-card" style={{ marginBottom: 14, padding: "14px 16px", borderRadius: 20 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#475569", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><Icon name="trash" size={14} /> 휴지통</div>
              {trashedTasks.length > 0 ? trashedTasks.map((task) => <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}><span style={{ flex: 1, fontSize: 13, color: "#64748B" }}>{task.title}</span><button onClick={() => restore(task.id)} style={{ fontSize: 11.5, color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, padding: "6px 10px" }}>복원</button><button onClick={() => permDel(task.id)} style={{ fontSize: 11.5, color: "#EF4444", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, padding: "6px 10px" }}>영구삭제</button></div>) : <EmptyState icon="🗑" title="휴지통이 비어 있어요" message="삭제한 과제가 없어요. 과제를 휴지통으로 보내면 여기서 다시 복원할 수 있어요." tone="red" compact action={<Button variant="secondary" onClick={() => setShowTrash(false)}>닫기</Button>} />}
            </div>}

            <div style={{ paddingBottom: 12 }}>
              {list.length === 0 ? (
                <EmptyState
                  icon={search ? "search" : filter === "all" ? "task" : "sparkle"}
                  title={search ? "검색 결과가 없어요" : filter === "all" ? "등록된 과제가 아직 없어요" : `${CATS[filter]?.label || "선택한 분야"} 과제가 비어 있어요`}
                  message={search
                    ? "과제명, 세부과제, 코멘트에서 찾지 못했어요. 검색어를 조금 더 짧게 바꾸거나 필터를 전체로 돌려보세요."
                    : filter === "all"
                      ? "루틴 템플릿을 불러오거나 새 과제를 추가해서 오늘 보드를 채워보세요."
                      : `지금은 ${CATS[filter]?.label || "이 분야"}에 남아 있는 과제가 없어요. 다른 분야를 보거나 새 과제를 추가할 수 있어요.`}
                  tone={search ? "blue" : filter === "all" ? "amber" : "slate"}
                  action={search ? <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}><Button variant="secondary" onClick={() => setSearch("")}>검색 지우기</Button><Button variant="ghost" onClick={() => setFilter("all")}>전체 보기</Button></div> : <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}><Button variant="secondary" onClick={() => setShowTemplates(true)}>루틴 템플릿</Button><Button onClick={() => { resetForm(); setShowAdd(true); }}>새 과제 추가</Button></div>}
                />
              ) : list.map((task) => <TaskTree key={task.id} task={task} onChange={upd} onSoftDelete={softDel} onComplete={complete} onShowRecur={(id) => setRecurModal(id)} coaches={branchCoaches} branchName={branchName} commentSeen={commentSeen[task.id] || 0} onMarkCommentsSeen={markCommentsSeen} />)}
            </div>

            <button onClick={() => { resetForm(); setShowAdd(true); }} className="fab-btn" style={{ background: "var(--primary-gradient)", color: "#fff", border: "3px solid rgba(255,255,255,0.72)", fontSize: 0, cursor: "pointer", boxShadow: "var(--primary-shadow)" }}><Icon name="plus" size={28} /></button>
          </>
        ) : viewTab === "reports" ? (
          <ReportTab tasks={allTasks.filter((task) => task.branchId === curBranch && !task.deleted && canSee(task, me))} coaches={branchCoaches} me={me} branchName={branchName} onGoTasks={() => setViewTab("tasks")} />
        ) : <AiAssistantTab branchName={branchName} visibleTasks={vis} notifications={notifications} />}
        </div>
      </div>

      {showAdd && <AddTaskModal branchName={branchName} nf={nf} setNf={setNf} branchCoaches={branchCoaches} onClose={() => setShowAdd(false)} onAdd={add} />}
      {showTemplates && <TemplateModal onClose={() => setShowTemplates(false)} onUse={loadTemplate} />}
      {showAdmin && <AdminPanel branches={branches} coaches={coaches} onClose={() => setShowAdmin(false)} refreshData={refreshData} />}
      {recurModal && <RecurModal task={allTasks.find((t) => t.id === recurModal)} onRecreate={doRecreate} onFinish={() => { complete(recurModal); setRecurModal(null); }} onCancel={() => setRecurModal(null)} />}
    </div>
  );
}
