const DEFAULT_PUSH_PREFS = {
  urgentTask: true,
  comment: true,
  dueDigest: true,
  dueDigestHour: 8,
};

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function clampHour(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return DEFAULT_PUSH_PREFS.dueDigestHour;
  return Math.min(23, Math.max(0, parsed));
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청에 실패했습니다");
  return data;
}

export function getDefaultPushPrefs() {
  return { ...DEFAULT_PUSH_PREFS };
}

export function normalizePushPrefs(prefs) {
  return {
    ...DEFAULT_PUSH_PREFS,
    ...(prefs || {}),
    dueDigestHour: clampHour(prefs?.dueDigestHour ?? DEFAULT_PUSH_PREFS.dueDigestHour),
  };
}

export async function getCurrentSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  return await reg.pushManager.getSubscription();
}

export async function getPushPublicKey() {
  const data = await jsonFetch("/api/push");
  if (!data.publicKey) throw new Error("웹푸시 공개키가 없습니다");
  return data.publicKey;
}

export async function subscribeWebPush(preferences = DEFAULT_PUSH_PREFS) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("이 기기에서는 웹푸시를 지원하지 않습니다");
  }
  const reg = await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    const publicKey = await getPushPublicKey();
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await jsonFetch("/api/push", {
    method: "POST",
    body: JSON.stringify({
      action: "subscribe",
      preferences: normalizePushPrefs(preferences),
      subscription,
    }),
  });
  return subscription;
}

export async function unsubscribeWebPush() {
  if (!("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  const endpoint = subscription?.endpoint || null;
  await jsonFetch("/api/push", {
    method: "POST",
    body: JSON.stringify({ action: "unsubscribe", endpoint }),
  }).catch(() => {});
  if (subscription) await subscription.unsubscribe().catch(() => {});
  return true;
}

export async function getWebPushStatus() {
  const subscription = await getCurrentSubscription();
  if (!subscription?.endpoint) {
    return { enabled: false, preferences: getDefaultPushPrefs(), endpoint: null };
  }
  const data = await jsonFetch("/api/push", {
    method: "POST",
    body: JSON.stringify({
      action: "status",
      endpoint: subscription.endpoint,
    }),
  }).catch(() => ({ ok: false }));
  return {
    enabled: !!subscription,
    endpoint: subscription.endpoint,
    preferences: normalizePushPrefs(data?.preferences),
  };
}

export async function updateWebPushPreferences(preferences) {
  const subscription = await getCurrentSubscription();
  if (!subscription?.endpoint) throw new Error("웹푸시가 아직 연결되지 않았습니다");
  const normalized = normalizePushPrefs(preferences);
  await jsonFetch("/api/push", {
    method: "POST",
    body: JSON.stringify({
      action: "update_preferences",
      endpoint: subscription.endpoint,
      preferences: normalized,
    }),
  });
  return normalized;
}

export async function sendPush(payload) {
  return await jsonFetch("/api/push", {
    method: "POST",
    body: JSON.stringify({ ...payload, action: "notify" }),
  });
}

export function shortenText(text = "", max = 60) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
