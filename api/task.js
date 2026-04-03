import { assertSameOrigin, canAccessBranch, getSupabaseAdmin, json, mapTaskRow, requireAuth, taskVisibleToCoach } from "../server/common.js";

function uniq(array = []) {
  return Array.from(new Set((array || []).filter(Boolean)));
}

function normalizeTask(task) {
  return {
    ...task,
    comments: Array.isArray(task?.comments) ? task.comments : [],
    assignees: uniq(Array.isArray(task?.assignees) ? task.assignees : []),
    subs: Array.isArray(task?.subs) ? task.subs : [],
  };
}

function stripClientMeta(task) {
  const clean = { ...normalizeTask(task) };
  delete clean.__meta;
  delete clean.__mergeNotice;
  return clean;
}

function sortComments(comments = []) {
  return [...comments].sort((a, b) => {
    const av = String(a?.createdAt || a?.time || "");
    const bv = String(b?.createdAt || b?.time || "");
    return av.localeCompare(bv);
  });
}

function mergeComments(existingComments = [], incomingComments = [], changedCommentIds = []) {
  const allowed = new Set(changedCommentIds || []);
  const merged = new Map((existingComments || []).map((comment) => [comment.id, comment]));
  for (const comment of incomingComments || []) {
    if (!comment?.id) continue;
    if (!merged.has(comment.id) || allowed.has(comment.id)) merged.set(comment.id, comment);
  }
  return sortComments(Array.from(merged.values()));
}

function mergeSubs(existingSubs = [], incomingSubs = [], changedSubIds = [], removedSubIds = []) {
  const changed = new Set(changedSubIds || []);
  const removed = new Set(removedSubIds || []);
  const existingMap = new Map((existingSubs || []).map((sub) => [sub.id, sub]));
  const mergedMap = new Map();

  for (const [id, sub] of existingMap.entries()) {
    if (!removed.has(id)) mergedMap.set(id, sub);
  }

  for (const sub of incomingSubs || []) {
    if (!sub?.id) continue;
    const current = mergedMap.get(sub.id);
    if (!current || changed.has(sub.id)) mergedMap.set(sub.id, sub);
  }

  const ordered = [];
  for (const sub of incomingSubs || []) {
    if (!sub?.id || removed.has(sub.id)) continue;
    ordered.push(mergedMap.get(sub.id) || sub);
    mergedMap.delete(sub.id);
  }

  for (const [id, sub] of mergedMap.entries()) {
    if (!removed.has(id)) ordered.push(sub);
  }

  return ordered;
}

function mergeTask(existingTask, incomingTask, meta = {}) {
  const changedFields = new Set(meta.changedFields || []);
  const merged = { ...existingTask };

  const scalarFields = [
    "title",
    "cat",
    "pri",
    "due",
    "memo",
    "recur",
    "completed",
    "completedAt",
    "deleted",
    "deletedAt",
    "open",
    "firstResponseAt",
  ];

  for (const field of scalarFields) {
    if (changedFields.has(field) && field in incomingTask) merged[field] = incomingTask[field];
  }

  if (changedFields.has("assignees")) merged.assignees = uniq(incomingTask.assignees || []);
  else merged.assignees = uniq(existingTask.assignees || []);

  merged.comments = changedFields.has("comments")
    ? mergeComments(existingTask.comments || [], incomingTask.comments || [], meta.changedCommentIds || [])
    : sortComments(existingTask.comments || []);

  merged.subs = changedFields.has("subs")
    ? mergeSubs(existingTask.subs || [], incomingTask.subs || [], meta.changedSubIds || [], meta.removedSubIds || [])
    : (existingTask.subs || []);

  merged.createdAt = existingTask.createdAt || incomingTask.createdAt || new Date().toISOString();
  merged.updatedAt = new Date().toISOString();
  merged.version = Number(existingTask.version || 1) + 1;
  return merged;
}

function validateTaskInput(task) {
  if (!task?.id || !task?.branchId) return "과제 id와 branchId가 필요합니다";
  const title = String(task?.title || "").trim();
  if (!title) return "과제 제목을 입력해주세요";
  if (title.length > 120) return "과제 제목은 120자 이내로 입력해주세요";
  if (String(task?.memo || "").length > 5000) return "메모는 5000자 이내로 입력해주세요";
  if ((task?.comments || []).some((comment) => String(comment?.text || "").length > 2000)) return "댓글은 2000자 이내로 입력해주세요";
  if ((task?.subs || []).length > 100) return "세부과제는 100개 이내로 입력해주세요";
  if ((task?.comments || []).length > 200) return "댓글은 200개 이내로 입력해주세요";
  const payloadSize = Buffer.byteLength(JSON.stringify(task), "utf8");
  if (payloadSize > 65535) return "과제 데이터가 너무 커서 저장할 수 없습니다";
  return "";
}

function createFreshTask(incomingTask) {
  return {
    ...incomingTask,
    version: 1,
    createdAt: incomingTask.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function handleList(req, res, supabase, me) {
  const scope = String(req.query?.scope || "");
  const branchId = String(req.query?.branchId || "");
  let query = supabase.from("tasks").select("id, branch_id, data, created_at, updated_at").order("created_at");
  if (me.role !== "owner" || scope !== "all") query = query.eq("branch_id", me.branch_id);
  else if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query;
  if (error) throw error;
  const tasks = (data || []).map(mapTaskRow).filter(Boolean).filter((task) => taskVisibleToCoach(task, me));
  return json(res, 200, { ok: true, tasks });
}

async function handleSave(req, res, supabase, me) {
  const { task, tasks } = req.body || {};
  const input = (Array.isArray(tasks) ? tasks : [task]).filter(Boolean).map(normalizeTask);
  if (input.length === 0) return json(res, 400, { error: "저장할 과제가 없습니다" });

  for (const item of input) {
    const validationError = validateTaskInput(item);
    if (validationError) return json(res, 400, { error: validationError });
    if (!canAccessBranch(me, item.branchId)) return json(res, 403, { error: "다른 지점 과제는 수정할 수 없습니다" });
  }

  const ids = input.map((item) => item.id);
  const { data: existingRows, error: loadError } = await supabase
    .from("tasks")
    .select("id, branch_id, data, created_at, updated_at")
    .in("id", ids);
  if (loadError) throw loadError;
  const existingMap = new Map((existingRows || []).map((row) => [row.id, row]));

  const rowsToSave = [];
  const savedTasks = [];
  const mergedIds = [];

  for (const item of input) {
    const meta = item.__meta || {};
    const incomingTask = stripClientMeta(item);
    const currentRow = existingMap.get(item.id);
    const currentTask = currentRow?.data ? normalizeTask(currentRow.data) : null;
    const currentVersion = Number(currentTask?.version || 0);
    const baseVersion = Number(meta.baseVersion || 0);
    const isConflict = !!currentTask && baseVersion < currentVersion;

    const finalTask = currentTask
      ? (isConflict ? mergeTask(currentTask, incomingTask, meta) : {
          ...currentTask,
          ...incomingTask,
          comments: incomingTask.comments || [],
          assignees: uniq(incomingTask.assignees || []),
          subs: incomingTask.subs || [],
          createdAt: currentTask.createdAt || incomingTask.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: currentVersion + 1,
        })
      : createFreshTask(incomingTask);

    rowsToSave.push({
      id: finalTask.id,
      branch_id: finalTask.branchId,
      data: finalTask,
      updated_at: new Date().toISOString(),
    });

    savedTasks.push({
      ...finalTask,
      ...(isConflict ? { __mergeNotice: "다른 코치의 최신 변경과 함께 자동 병합했어요." } : {}),
    });
    if (isConflict) mergedIds.push(finalTask.id);
  }

  const { error } = await supabase.from("tasks").upsert(rowsToSave, { onConflict: "id" });
  if (error) throw error;

  return json(res, 200, {
    ok: true,
    count: rowsToSave.length,
    task: savedTasks[0] || null,
    tasks: savedTasks,
    mergedIds,
    conflictCount: mergedIds.length,
  });
}

async function handleDelete(req, res, supabase, me) {
  const id = String(req.body?.id || req.query?.id || "");
  if (!id) return json(res, 400, { error: "id가 필요합니다" });

  const { data: row, error: rowError } = await supabase.from("tasks").select("id, branch_id").eq("id", id).maybeSingle();
  if (rowError) throw rowError;
  if (!row) return json(res, 404, { error: "과제를 찾을 수 없습니다" });
  if (me.role !== "owner" && row.branch_id !== me.branch_id) return json(res, 403, { error: "권한이 없습니다" });

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
  return json(res, 200, { ok: true });
}

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdmin();
    const method = req.method || "GET";
    if (method !== "GET") assertSameOrigin(req);
    const me = await requireAuth(req, res, supabase);
    if (!me) return;

    if (method === "GET") return await handleList(req, res, supabase, me);
    if (method === "POST") return await handleSave(req, res, supabase, me);
    if (method === "DELETE") return await handleDelete(req, res, supabase, me);
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error("task error", error);
    return json(res, error.status || 500, { error: error.message || "과제 처리에 실패했습니다" });
  }
}
