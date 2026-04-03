import { useEffect, useMemo, useRef, useState } from "react";
import { canSee } from "../lib/constants";
import { getDefaultPushPrefs, getWebPushStatus, normalizePushPrefs, subscribeWebPush, unsubscribeWebPush, updateWebPushPreferences } from "../lib/push";

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function getKstParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number.parseInt(parts.hour || "0", 10),
  };
}

async function showBrowserNotification(title, options = {}) {
  try {
    if (navigator.serviceWorker?.ready) {
      const reg = await navigator.serviceWorker.ready;
      if (reg?.showNotification) {
        await reg.showNotification(title, options);
        return true;
      }
    }
    if (window.Notification?.permission === "granted") {
      new Notification(title, options);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function useNotifications({ tasks, me, branchName }) {
  const supported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  const logKey = useMemo(() => `gh-notify-log:${me.id}`, [me.id]);
  const prefKey = useMemo(() => `gh-notify-prefs:${me.id}`, [me.id]);
  const [permission, setPermission] = useState(supported ? Notification.permission : "unsupported");
  const [enabled, setEnabledState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [prefs, setPrefs] = useState(() => loadJson(prefKey, getDefaultPushPrefs()));
  const bootedRef = useRef(false);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await getWebPushStatus();
        if (cancelled) return;
        setEnabledState(!!status.enabled);
        setPrefs(normalizePushPrefs(status.preferences));
      } catch {
        if (cancelled) return;
        setEnabledState(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, me]);

  useEffect(() => {
    localStorage.setItem(prefKey, JSON.stringify(prefs));
  }, [prefs, prefKey]);

  const requestPermission = async () => {
    if (!supported) return false;
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next !== "granted") return false;
    setBusy(true);
    try {
      await subscribeWebPush(prefs);
      setEnabledState(true);
      await showBrowserNotification("좋은습관PT 웹푸시가 켜졌어요", {
        body: `${branchName || "센터"}의 새 코멘트와 긴급 과제를 백그라운드로 알려드릴게요. 마감 요약은 ${String(prefs.dueDigestHour).padStart(2, "0")}:00 기준으로 발송돼요.`,
        tag: "goodhabit-webpush-enabled",
      });
      return true;
    } finally {
      setBusy(false);
    }
  };

  const setEnabled = async (next) => {
    if (!supported) return false;
    if (next && permission !== "granted") return await requestPermission();
    setBusy(true);
    try {
      if (next) {
        await subscribeWebPush(prefs);
        setEnabledState(true);
      } else {
        await unsubscribeWebPush();
        setEnabledState(false);
      }
      return true;
    } finally {
      setBusy(false);
    }
  };

  const savePrefs = async (patch) => {
    const next = normalizePushPrefs(typeof patch === "function" ? patch(prefs) : { ...prefs, ...patch });
    setPrefs(next);
    if (!enabled || permission !== "granted") return next;
    setPrefsBusy(true);
    try {
      await updateWebPushPreferences(next);
      return next;
    } finally {
      setPrefsBusy(false);
    }
  };

  useEffect(() => {
    if (!enabled || permission !== "granted" || !prefs.dueDigest) return;
    const visibleTasks = tasks.filter((task) => !task.deleted && !task.completed && canSee(task, me));
    const dueTasks = visibleTasks.filter((task) => task.due && task.due <= getKstParts().date);
    const { date, hour } = getKstParts();
    const prev = loadJson(logKey, { dueDigest: {} });
    const next = { ...prev, dueDigest: { ...(prev.dueDigest || {}) } };
    const digestKey = `${date}:${prefs.dueDigestHour}`;

    if (!bootedRef.current) {
      if (dueTasks.length > 0 && hour >= prefs.dueDigestHour) next.dueDigest[digestKey] = true;
      localStorage.setItem(logKey, JSON.stringify(next));
      bootedRef.current = true;
      return;
    }

    if (hour < prefs.dueDigestHour || dueTasks.length === 0 || next.dueDigest[digestKey]) return;

    const overdue = dueTasks.filter((task) => task.due < date).length;
    const dueToday = dueTasks.filter((task) => task.due === date).length;
    const preview = dueTasks.slice(0, 2).map((task) => task.title).filter(Boolean).join(", ");
    const countText = [dueToday > 0 ? `오늘 ${dueToday}건` : null, overdue > 0 ? `지연 ${overdue}건` : null].filter(Boolean).join(" · ");
    showBrowserNotification(overdue > 0 ? "⚠️ 오늘 확인할 미완료 과제가 있어요" : "⏰ 오늘 마감 과제가 있어요", {
      body: `${countText}${preview ? ` · ${preview}${dueTasks.length > 2 ? ` 외 ${dueTasks.length - 2}건` : ""}` : ""}`,
      tag: `due-digest-${digestKey}`,
    });
    next.dueDigest[digestKey] = true;
    localStorage.setItem(logKey, JSON.stringify(next));
  }, [tasks, enabled, permission, prefs.dueDigest, prefs.dueDigestHour, me, logKey]);

  return {
    supported,
    permission,
    enabled,
    busy,
    prefs,
    prefsBusy,
    setPrefs: savePrefs,
    setEnabled,
    requestPermission,
  };
}
