import { assertSameOrigin, canAccessBranch, getSupabaseAdmin, getWebPush, json, normalizePushPrefs, requireAuth, sendPushToRows } from "../server/common.js";

async function handlePublicKey(res) {
  const { publicKey } = getWebPush();
  return json(res, 200, { publicKey });
}

async function handleSubscriptionAction(req, res, supabase, me) {
  const { action, subscription, endpoint, preferences } = req.body || {};

  if (action === "subscribe") {
    if (!subscription?.endpoint) return json(res, 400, { error: "subscription 이 필요합니다" });
    const normalizedPreferences = normalizePushPrefs(preferences);
    const { error } = await supabase.from("push_subscriptions").upsert([
      {
        endpoint: subscription.endpoint,
        coach_id: me.id,
        coach_name: me.name,
        role: me.role || "coach",
        branch_id: me.branch_id || null,
        subscription,
        preferences: normalizedPreferences,
        user_agent: req.headers["user-agent"] || null,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      },
    ], { onConflict: "endpoint" });
    if (error) throw error;
    return json(res, 200, { ok: true, preferences: normalizedPreferences });
  }

  if (action === "status") {
    if (!endpoint) return json(res, 400, { error: "endpoint 가 필요합니다" });
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, is_active, preferences")
      .eq("endpoint", endpoint)
      .eq("coach_id", me.id)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return json(res, 200, {
      ok: true,
      enabled: !!data?.endpoint,
      preferences: normalizePushPrefs(data?.preferences),
    });
  }

  if (action === "update_preferences") {
    if (!endpoint) return json(res, 400, { error: "endpoint 가 필요합니다" });
    const nextPreferences = normalizePushPrefs(preferences);
    const { error } = await supabase.from("push_subscriptions").update({
      preferences: nextPreferences,
      is_active: true,
      last_seen_at: new Date().toISOString(),
    }).eq("endpoint", endpoint).eq("coach_id", me.id);
    if (error) throw error;
    return json(res, 200, { ok: true, preferences: nextPreferences });
  }

  if (action === "unsubscribe") {
    if (!endpoint) return json(res, 400, { error: "endpoint 가 필요합니다" });
    const { error } = await supabase.from("push_subscriptions").update({ is_active: false, last_seen_at: new Date().toISOString() }).eq("endpoint", endpoint).eq("coach_id", me.id);
    if (error) throw error;
    return json(res, 200, { ok: true });
  }

  return json(res, 400, { error: "지원하지 않는 action 입니다" });
}

async function handleNotify(req, res, supabase, me) {
  const { webpush } = getWebPush();
  const {
    branchId,
    recipients,
    excludeCoachId,
    title,
    body,
    tag,
    url = "/",
    taskId = null,
    kind = "general",
    includeOwners = true,
  } = req.body || {};

  if (!title || !body) return json(res, 400, { error: "title 과 body 가 필요합니다" });
  if (branchId && !canAccessBranch(me, branchId)) return json(res, 403, { error: "다른 지점 알림은 보낼 수 없습니다" });

  let query = supabase
    .from("push_subscriptions")
    .select("endpoint, coach_id, role, branch_id, subscription, preferences")
    .eq("is_active", true);

  if (branchId) {
    query = includeOwners
      ? query.or(`branch_id.eq.${branchId},role.eq.owner`)
      : query.eq("branch_id", branchId);
  } else if (me.role !== 'owner') {
    query = includeOwners
      ? query.or(`branch_id.eq.${me.branch_id},role.eq.owner`)
      : query.eq("branch_id", me.branch_id);
  }

  const { data, error } = await query;
  if (error) throw error;

  const strictRecipients = Array.isArray(recipients) && recipients.length > 0;
  const rows = (data || [])
    .filter((row) => row.subscription?.endpoint)
    .filter((row) => !branchId || row.branch_id === branchId || (includeOwners && row.role === "owner"))
    .filter((row) => !strictRecipients || (includeOwners && row.role === "owner") || recipients.includes(row.coach_id))
    .filter((row) => row.coach_id !== excludeCoachId);

  const { sent, staleEndpoints } = await sendPushToRows({
    supabase,
    rows,
    payload: { title, body, tag, url, taskId, kind },
    webpushInstance: webpush,
  });

  return json(res, 200, { ok: true, sent, stale: staleEndpoints.length });
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") return await handlePublicKey(res);
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    assertSameOrigin(req);
    const supabase = getSupabaseAdmin();
    const me = await requireAuth(req, res, supabase);
    if (!me) return;

    if (req.body?.action === "notify") return await handleNotify(req, res, supabase, me);
    return await handleSubscriptionAction(req, res, supabase, me);
  } catch (error) {
    console.error("push error", error);
    return json(res, 500, { error: error.message || "웹푸시 처리에 실패했습니다" });
  }
}
