import {
  assertSameOrigin,
  assertValidPin,
  clearSessionCookie,
  consumeLoginAttempt,
  consumeThrottleAttempt,
  createSession,
  getLoginThrottle,
  getSupabaseAdmin,
  hashPin,
  isLegacySha256PinHash,
  isLocked,
  json,
  parseCookies,
  sanitizeCoach,
  sanitizeLoginCoach,
  sha256Hex,
  verifyPinHash,
} from "../server/common.js";

async function handleLoginOptions(res, supabase) {
  const [branchesRes, coachesRes] = await Promise.all([
    supabase.from("branches").select("id, name, color, created_at").order("created_at"),
    supabase.from("coaches").select("id, name, role, emoji, branch_id, created_at").order("created_at"),
  ]);
  if (branchesRes.error) throw branchesRes.error;
  if (coachesRes.error) throw coachesRes.error;

  const coaches = (coachesRes.data || []).map(sanitizeLoginCoach).filter(Boolean).sort((a, b) => {
    if (a.role === "owner" && b.role !== "owner") return -1;
    if (a.role !== "owner" && b.role === "owner") return 1;
    return String(a.name || "").localeCompare(String(b.name || ""), "ko");
  });

  res.setHeader("Cache-Control", "no-store");
  return json(res, 200, { ok: true, branches: branchesRes.data || [], coaches });
}

async function handleLogin(req, res, supabase) {
  assertSameOrigin(req);

  const throttle = await getLoginThrottle(supabase, req);
  if (isLocked(throttle)) {
    return json(res, 429, { error: "로그인 시도가 잠시 제한되었습니다. 15분 뒤 다시 시도해주세요." });
  }

  const coachId = String(req.body?.coachId || "").trim();
  const pin = String(req.body?.pin || "").trim();
  if (!coachId) {
    await consumeThrottleAttempt(supabase, req, false);
    return json(res, 400, { error: "로그인할 코치를 선택해주세요" });
  }
  if (!assertValidPin(pin)) {
    await consumeThrottleAttempt(supabase, req, false);
    return json(res, 400, { error: "PIN 4자리를 입력해주세요" });
  }

  const { data: credential, error: credError } = await supabase
    .from("coach_credentials")
    .select("coach_id, pin_hash, failed_attempts, locked_until")
    .eq("coach_id", coachId)
    .maybeSingle();
  if (credError) throw credError;

  if (!credential?.coach_id) {
    await consumeThrottleAttempt(supabase, req, false);
    return json(res, 401, { error: "PIN이 일치하지 않습니다" });
  }

  if (isLocked(credential)) {
    await consumeThrottleAttempt(supabase, req, false);
    return json(res, 429, { error: "이 계정의 로그인 시도가 잠시 제한되었습니다. 10분 뒤 다시 시도해주세요." });
  }

  const pinOk = verifyPinHash(pin, credential.pin_hash);
  if (!pinOk) {
    await Promise.all([
      consumeLoginAttempt(supabase, credential, false),
      consumeThrottleAttempt(supabase, req, false),
    ]);
    return json(res, 401, { error: "PIN이 일치하지 않습니다" });
  }

  const { data: coachRow, error: coachError } = await supabase
    .from("coaches")
    .select("id, name, role, emoji, branch_id, created_at")
    .eq("id", credential.coach_id)
    .maybeSingle();
  if (coachError) throw coachError;
  if (!coachRow) {
    await consumeThrottleAttempt(supabase, req, false);
    return json(res, 401, { error: "사용자 정보를 찾을 수 없습니다" });
  }

  const shouldUpgradeHash = isLegacySha256PinHash(credential.pin_hash);
  await Promise.all([
    consumeLoginAttempt(supabase, credential, true),
    consumeThrottleAttempt(supabase, req, true),
    shouldUpgradeHash
      ? supabase.from("coach_credentials").update({ pin_hash: hashPin(pin) }).eq("coach_id", credential.coach_id)
      : Promise.resolve(),
  ]);

  const coach = sanitizeCoach(coachRow);
  await createSession(supabase, coach, req, res);
  return json(res, 200, { ok: true, me: coach });
}

async function handleLogout(req, res, supabase) {
  assertSameOrigin(req);
  const token = parseCookies(req).gh_session;
  if (token) {
    await supabase.from("app_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", sha256Hex(token));
  }
  clearSessionCookie(res);
  return json(res, 200, { ok: true });
}

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin();
  try {
    if (req.method === "GET") return await handleLoginOptions(res, supabase);
    if (req.method === "POST") return await handleLogin(req, res, supabase);
    if (req.method === "DELETE") return await handleLogout(req, res, supabase);
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error("auth error", error);
    if (req.method === "DELETE") clearSessionCookie(res);
    return json(res, error?.status || 500, { error: error.message || "인증 처리에 실패했습니다" });
  }
}
