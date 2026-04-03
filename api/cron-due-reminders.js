import {
  getCronAuthError,
  getKstDateString,
  getKstHour,
  getSupabaseAdmin,
  getWebPush,
  json,
  sendPushToRows,
  summarizeDueTasks,
  taskVisibleToCoach,
  normalizePushPrefs,
} from "../server/common.js";

async function reserveDeliveryLog(supabase, { kind, dedupeKey, coachId, endpoint, branchId, meta }) {
  const { error } = await supabase.from("push_delivery_logs").insert([
    {
      kind,
      dedupe_key: dedupeKey,
      coach_id: coachId || null,
      endpoint,
      branch_id: branchId || null,
      meta: meta || {},
    },
  ]);

  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

async function releaseDeliveryLog(supabase, dedupeKey) {
  await supabase.from("push_delivery_logs").delete().eq("dedupe_key", dedupeKey);
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, { error: "Method not allowed" });

  try {
    const authError = getCronAuthError(req);
    if (authError) return json(res, authError.message === "Unauthorized" ? 401 : 500, { error: authError.message });

    const supabase = getSupabaseAdmin();
    const { webpush } = getWebPush();
    const today = getKstDateString();
    const currentHour = getKstHour();

    const [{ data: taskRows, error: taskError }, { data: subscriptions, error: subError }, { data: branches, error: branchError }] = await Promise.all([
      supabase.from("tasks").select("id, branch_id, data"),
      supabase.from("push_subscriptions").select("endpoint, coach_id, coach_name, role, branch_id, subscription, preferences").eq("is_active", true),
      supabase.from("branches").select("id, name"),
    ]);

    if (taskError) throw taskError;
    if (subError) throw subError;
    if (branchError) throw branchError;

    const branchMap = Object.fromEntries((branches || []).map((branch) => [branch.id, branch]));
    const dueTasks = (taskRows || [])
      .map((row) => row.data)
      .filter((task) => task?.due && !task.deleted && !task.completed && task.due <= today);

    let considered = 0;
    let sent = 0;
    let skipped = 0;
    let stale = 0;

    for (const row of subscriptions || []) {
      if (!row.subscription?.endpoint) continue;
      const prefs = normalizePushPrefs(row.preferences);
      if (!prefs.dueDigest || prefs.dueDigestHour !== currentHour) continue;

      const visibleTasks = dueTasks.filter((task) => taskVisibleToCoach(task, row));
      if (visibleTasks.length === 0) continue;

      considered += 1;
      const dedupeKey = `due-digest:${today}:${currentHour}:${row.endpoint}`;
      const reserved = await reserveDeliveryLog(supabase, {
        kind: "due-digest",
        dedupeKey,
        coachId: row.coach_id,
        endpoint: row.endpoint,
        branchId: row.role === "owner" ? null : row.branch_id,
        meta: { taskIds: visibleTasks.map((task) => task.id), date: today, hour: currentHour },
      });
      if (!reserved) {
        skipped += 1;
        continue;
      }

      const summary = summarizeDueTasks(visibleTasks, branchMap);
      try {
        const { sent: rowSent, staleEndpoints } = await sendPushToRows({
          supabase,
          rows: [row],
          payload: {
            title: summary.title,
            body: summary.body,
            tag: `due-digest-${today}-${currentHour}-${row.coach_id || "anon"}`,
            url: "/",
            kind: "due-digest",
          },
          webpushInstance: webpush,
        });
        sent += rowSent;
        stale += staleEndpoints.length;
      } catch (error) {
        await releaseDeliveryLog(supabase, dedupeKey);
        throw error;
      }
    }

    return json(res, 200, {
      ok: true,
      date: today,
      hour: currentHour,
      dueTaskCount: dueTasks.length,
      considered,
      sent,
      skipped,
      stale,
    });
  } catch (error) {
    console.error("cron-due-reminders error", error);
    return json(res, 500, { error: error.message || "마감 리마인드 푸시에 실패했습니다" });
  }
}
