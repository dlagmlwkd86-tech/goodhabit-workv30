import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const SEOUL_TZ = "Asia/Seoul";
const SESSION_COOKIE = "gh_session";
const SESSION_MAX_AGE_DAYS = 14;
const DEFAULT_PUSH_PREFS = {
  urgentTask: true,
  comment: true,
  dueDigest: true,
  dueDigestHour: 8,
};

const KIND_TO_PREF = {
  "urgent-task": "urgentTask",
  comment: "comment",
  "due-digest": "dueDigest",
};

function clampHour(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return DEFAULT_PUSH_PREFS.dueDigestHour;
  return Math.min(23, Math.max(0, parsed));
}

export function json(res, status, payload) {
  res.status(status).json(payload);
}

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 서버 환경변수가 없습니다");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getWebPush() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) throw new Error("WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY 가 없습니다");
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { webpush, publicKey };
}

export function normalizePushPrefs(prefs) {
  return {
    ...DEFAULT_PUSH_PREFS,
    ...(prefs || {}),
    dueDigestHour: clampHour(prefs?.dueDigestHour ?? DEFAULT_PUSH_PREFS.dueDigestHour),
  };
}

export function wantsNotification(row, kind) {
  const prefKey = KIND_TO_PREF[kind];
  if (!prefKey) return true;
  const prefs = normalizePushPrefs(row?.preferences);
  return !!prefs[prefKey];
}

export function getKstDateString(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}

export function getKstHour(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: SEOUL_TZ,
    hour: "2-digit",
    hour12: false,
  });
  return Number.parseInt(fmt.format(date), 10);
}

export function getKstDateTimeLabel(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL_TZ,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return fmt.format(date);
}

export function taskVisibleToCoach(task, coach) {
  if (!task || task.deleted || task.completed) return false;
  if (coach?.role === "owner") return true;
  if (!coach?.branch_id || coach.branch_id !== task.branchId) return false;
  const assignees = Array.isArray(task.assignees) ? task.assignees : [];
  return assignees.length === 0 || assignees.includes(coach.id || coach.coach_id);
}

export function summarizeDueTasks(tasks, branchesById = {}) {
  const today = getKstDateString();
  const overdue = tasks.filter((task) => task.due < today).length;
  const dueToday = tasks.filter((task) => task.due === today).length;
  const titles = tasks.slice(0, 2).map((task) => task.title).filter(Boolean);
  const title = overdue > 0 ? "⚠️ 오늘 확인할 미완료 과제가 있어요" : "⏰ 오늘 마감 과제가 있어요";

  const countParts = [];
  if (dueToday > 0) countParts.push(`오늘 마감 ${dueToday}건`);
  if (overdue > 0) countParts.push(`지연 ${overdue}건`);

  const branchNames = Array.from(new Set(tasks.map((task) => branchesById[task.branchId]?.name).filter(Boolean)));
  if (branchNames.length === 1) countParts.push(branchNames[0]);
  else if (branchNames.length > 1) countParts.push(`${branchNames[0]} 외 ${branchNames.length - 1}곳`);

  let body = countParts.join(" · ");
  if (titles.length > 0) {
    const suffix = tasks.length > titles.length ? ` 외 ${tasks.length - titles.length}건` : "";
    body += `${body ? " · " : ""}${titles.join(", ")}${suffix}`;
  }

  return { title, body: body || "과제 목록을 확인해주세요." };
}

export function getCronAuthError(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "production" ? new Error("CRON_SECRET 환경변수가 없습니다") : null;
  }
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  if (authHeader !== `Bearer ${secret}`) {
    return new Error("Unauthorized");
  }
  return null;
}


export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"] || "";
  const first = String(forwarded).split(",")[0].trim();
  return first || req.socket?.remoteAddress || "unknown";
}

export function getThrottleKey(req) {
  const ip = getClientIp(req);
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 200);
  return sha256Hex(`${ip}|${userAgent}`);
}

export async function getLoginThrottle(supabase, req) {
  const throttleKey = getThrottleKey(req);
  const { data, error } = await supabase
    .from("login_throttles")
    .select("throttle_key, failed_attempts, locked_until")
    .eq("throttle_key", throttleKey)
    .maybeSingle();
  if (error) throw error;
  return data || { throttle_key: throttleKey, failed_attempts: 0, locked_until: null };
}

export async function consumeThrottleAttempt(supabase, req, success) {
  const throttle = await getLoginThrottle(supabase, req);
  const nowIso = new Date().toISOString();
  const updates = success
    ? { failed_attempts: 0, locked_until: null, last_attempt_at: nowIso }
    : {
        failed_attempts: Math.min((throttle?.failed_attempts || 0) + 1, 50),
        locked_until: (throttle?.failed_attempts || 0) + 1 >= 10
          ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
          : throttle?.locked_until || null,
        last_attempt_at: nowIso,
      };
  const { error } = await supabase.from("login_throttles").upsert([{ throttle_key: throttle.throttle_key, ...updates }], { onConflict: "throttle_key" });
  if (error) throw error;
  return { ...throttle, ...updates };
}

export function getRequestOrigin(req) {
  const origin = req.headers.origin || req.headers.Origin || "";
  return String(origin || "").trim();
}

export function assertSameOrigin(req) {
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite && fetchSite === "cross-site") {
    const error = new Error("Cross-site request blocked");
    error.status = 403;
    throw error;
  }
  const origin = getRequestOrigin(req);
  if (!origin) return;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    const error = new Error("Invalid Origin");
    error.status = 403;
    throw error;
  }
  const host = String(req.headers.host || "").trim();
  if (originHost && host && originHost !== host) {
    const error = new Error("Origin mismatch");
    error.status = 403;
    throw error;
  }
}

export async function sendPushToRows({ supabase, rows, payload, webpushInstance }) {
  const uniqueRows = Array.from(new Map((rows || []).map((row) => [row.endpoint, row])).values())
    .filter((row) => wantsNotification(row, payload?.kind));
  let sent = 0;
  const staleEndpoints = [];

  await Promise.all(uniqueRows.map(async (row) => {
    try {
      await webpushInstance.sendNotification(row.subscription, JSON.stringify(payload));
      sent += 1;
    } catch (error) {
      const statusCode = error?.statusCode || error?.status;
      if (statusCode === 404 || statusCode === 410) {
        staleEndpoints.push(row.endpoint);
        return;
      }
      console.error("webpush send error", row.endpoint, error?.body || error?.message || error);
      throw error;
    }
  }));

  if (staleEndpoints.length > 0) {
    await supabase.from("push_subscriptions").update({ is_active: false }).in("endpoint", staleEndpoints);
  }

  return { sent, staleEndpoints };
}

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function isBcryptHash(value) {
  return /^\$2[aby]\$\d{2}\$/.test(String(value || ""));
}

export function isLegacySha256PinHash(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || "")) && !isBcryptHash(value);
}

export function hashPin(pin) {
  return bcrypt.hashSync(String(pin || ""), 10);
}

export function verifyPinHash(pin, storedHash) {
  const normalized = String(storedHash || "");
  if (!normalized) return false;
  if (isBcryptHash(normalized)) return bcrypt.compareSync(String(pin || ""), normalized);
  if (isLegacySha256PinHash(normalized)) return sha256Hex(pin) === normalized;
  return false;
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}

export function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  const maxAge = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;
  const cookie = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    isProd ? "Secure" : "",
  ].filter(Boolean).join("; ");
  res.setHeader("Set-Cookie", cookie);
}

export function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === "production";
  const cookie = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    isProd ? "Secure" : "",
  ].filter(Boolean).join("; ");
  res.setHeader("Set-Cookie", cookie);
}

export async function createSession(supabase, coach, req, res) {
  const token = createSessionToken();
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const userAgent = req.headers["user-agent"] || null;
  const { error } = await supabase.from("app_sessions").insert([
    {
      coach_id: coach.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      user_agent: userAgent,
      last_seen_at: new Date().toISOString(),
    },
  ]);
  if (error) throw error;
  setSessionCookie(res, token);
}

export function sanitizeLoginCoach(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    role: row.role || "coach",
    emoji: row.emoji || "🏋️",
    branch_id: row.branch_id || null,
    created_at: row.created_at || null,
  };
}

export function sanitizeCoach(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    role: row.role || "coach",
    emoji: row.emoji || "🏋️",
    branch_id: row.branch_id || null,
    created_at: row.created_at || null,
  };
}

export async function getSessionCoach(req, supabase) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = sha256Hex(token);
  const nowIso = new Date().toISOString();
  const { data: session, error: sessionError } = await supabase
    .from("app_sessions")
    .select("id, coach_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session?.coach_id) return null;

  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("id, name, role, emoji, branch_id, created_at")
    .eq("id", session.coach_id)
    .maybeSingle();
  if (coachError) throw coachError;
  if (!coach) return null;

  await supabase.from("app_sessions").update({ last_seen_at: nowIso }).eq("id", session.id);
  return sanitizeCoach(coach);
}

export async function requireAuth(req, res, supabase, options = {}) {
  const coach = await getSessionCoach(req, supabase);
  if (!coach) {
    json(res, 401, { error: "로그인이 필요합니다" });
    return null;
  }
  if (options.ownerOnly && coach.role !== "owner") {
    json(res, 403, { error: "권한이 없습니다" });
    return null;
  }
  return coach;
}

export function assertValidPin(pin) {
  return /^\d{4}$/.test(String(pin || ""));
}

export async function consumeLoginAttempt(supabase, credential, success) {
  const updates = success
    ? { failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() }
    : {
        failed_attempts: Math.min((credential?.failed_attempts || 0) + 1, 20),
        locked_until: (credential?.failed_attempts || 0) + 1 >= 5
          ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
          : credential?.locked_until || null,
      };
  await supabase.from("coach_credentials").update(updates).eq("coach_id", credential.coach_id);
}

export function isLocked(credential) {
  if (!credential?.locked_until) return false;
  return new Date(credential.locked_until).getTime() > Date.now();
}

export function mapTaskRow(row) {
  if (!row?.data) return null;
  return {
    ...row.data,
    branchId: row.data.branchId || row.branch_id,
    createdAt: row.data.createdAt || row.created_at || null,
    updatedAt: row.data.updatedAt || row.updated_at || null,
    version: Number(row.data.version || 1),
  };
}

export function canAccessBranch(coach, branchId) {
  return coach?.role === "owner" || (!!coach?.branch_id && coach.branch_id === branchId);
}
