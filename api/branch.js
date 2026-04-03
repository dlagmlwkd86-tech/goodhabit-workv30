import { assertSameOrigin, getSupabaseAdmin, json, requireAuth } from "../server/common.js";

async function handleSave(req, res, supabase, me) {
  const branch = req.body?.branch;
  if (!branch?.id || !branch?.name) return json(res, 400, { error: "지점 id와 이름이 필요합니다" });
  const { error } = await supabase.from("branches").upsert([{ id: branch.id, name: branch.name, color: branch.color || '#3B82F6' }], { onConflict: "id" });
  if (error) throw error;
  return json(res, 200, { ok: true });
}

async function handleDelete(req, res, supabase, me) {
  const id = String(req.body?.id || req.query?.id || "");
  if (!id) return json(res, 400, { error: "id가 필요합니다" });
  const { error } = await supabase.from("branches").delete().eq("id", id);
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
    console.error("branch error", error);
    return json(res, 500, { error: error.message || "지점 처리에 실패했습니다" });
  }
}
