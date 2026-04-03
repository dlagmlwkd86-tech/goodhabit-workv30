import { getSupabaseAdmin, json, mapTaskRow, requireAuth, taskVisibleToCoach } from "../server/common.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const supabase = getSupabaseAdmin();
    const me = await requireAuth(req, res, supabase);
    if (!me) return;

    const [branchesRes, coachesRes, tasksRes] = await Promise.all([
      supabase.from("branches").select("id, name, color, created_at").order("created_at"),
      me.role === "owner"
        ? supabase.from("coaches").select("id, name, role, emoji, branch_id, created_at").order("created_at")
        : supabase.from("coaches").select("id, name, role, emoji, branch_id, created_at").or(`branch_id.eq.${me.branch_id},role.eq.owner`).order("created_at"),
      me.role === "owner"
        ? supabase.from("tasks").select("id, branch_id, data, created_at, updated_at").order("created_at")
        : supabase.from("tasks").select("id, branch_id, data, created_at, updated_at").eq("branch_id", me.branch_id).order("created_at"),
    ]);

    if (branchesRes.error) throw branchesRes.error;
    if (coachesRes.error) throw coachesRes.error;
    if (tasksRes.error) throw tasksRes.error;

    const tasks = (tasksRes.data || []).map(mapTaskRow).filter(Boolean).filter((task) => taskVisibleToCoach(task, me));
    return json(res, 200, {
      ok: true,
      me,
      branches: branchesRes.data || [],
      coaches: coachesRes.data || [],
      tasks,
    });
  } catch (error) {
    console.error("bootstrap error", error);
    return json(res, 500, { error: error.message || "초기 데이터를 불러오지 못했습니다" });
  }
}
