import { assertSameOrigin, assertValidPin, getSupabaseAdmin, hashPin, json, requireAuth, sanitizeCoach } from "../server/common.js";

async function handleSave(req, res, supabase, me) {
  const coach = req.body?.coach || {};
  const newPin = String(coach.new_pin || coach.pin || "").trim();
  const payload = sanitizeCoach({
    id: coach.id,
    name: coach.name,
    role: coach.role || 'coach',
    emoji: coach.emoji || '🏋️',
    branch_id: coach.branch_id || null,
    created_at: coach.created_at,
  });
  if (!payload.id || !payload.name) return json(res, 400, { error: "코치 id와 이름이 필요합니다" });
  if (payload.role !== 'owner' && !payload.branch_id) return json(res, 400, { error: "코치 지점을 선택해주세요" });

  const { error } = await supabase.from("coaches").upsert([payload], { onConflict: "id" });
  if (error) throw error;

  if (newPin) {
    if (!assertValidPin(newPin)) return json(res, 400, { error: "PIN은 4자리 숫자여야 합니다" });
    const { error: credError } = await supabase.from("coach_credentials").upsert([
      {
        coach_id: payload.id,
        pin_hash: hashPin(newPin),
        failed_attempts: 0,
        locked_until: null,
      },
    ], { onConflict: "coach_id" });
    if (credError) throw credError;
  }

  return json(res, 200, { ok: true });
}

async function handleDelete(req, res, supabase, me) {
  const id = String(req.body?.id || req.query?.id || "");
  if (!id) return json(res, 400, { error: "id가 필요합니다" });
  if (id === me.id) return json(res, 400, { error: "현재 로그인한 관리자 계정은 삭제할 수 없습니다" });

  const deletions = [
    supabase.from("push_subscriptions").delete().eq("coach_id", id),
    supabase.from("app_sessions").delete().eq("coach_id", id),
    supabase.from("coach_credentials").delete().eq("coach_id", id),
  ];
  for (const deletion of deletions) {
    const { error } = await deletion;
    if (error) throw error;
  }
  const { error } = await supabase.from("coaches").delete().eq("id", id);
  if (error) throw error;
  return json(res, 200, { ok: true });
}

export default async function handler(req, res) {
  try {
    assertSameOrigin(req);
    const supabase = getSupabaseAdmin();
    const me = await requireAuth(req, res, supabase, { ownerOnly: true });
    if (!me) return;

    if (req.method === "POST") return await handleSave(req, res, supabase, me);
    if (req.method === "DELETE") return await handleDelete(req, res, supabase, me);
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error("coach error", error);
    return json(res, 500, { error: error.message || "코치 처리에 실패했습니다" });
  }
}
