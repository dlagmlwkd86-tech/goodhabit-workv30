const bootstrapCache = {
  data: null,
  time: 0,
};

async function api(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || "요청에 실패했습니다");
    error.status = res.status;
    throw error;
  }
  return data;
}

async function getBootstrapCached(force = false) {
  const fresh = Date.now() - bootstrapCache.time < 3000;
  if (!force && bootstrapCache.data && fresh) return bootstrapCache.data;
  const data = await api("/api/bootstrap");
  bootstrapCache.data = data;
  bootstrapCache.time = Date.now();
  return data;
}

export const db = {
  async bootstrap(force = false) {
    return await getBootstrapCached(force);
  },
  async loginOptions() {
    return await api("/api/auth");
  },
  async login(coachId, pin) {
    const data = await api("/api/auth", { method: "POST", body: JSON.stringify({ coachId, pin }) });
    bootstrapCache.data = null;
    bootstrapCache.time = 0;
    return data;
  },
  async logout() {
    const data = await api("/api/auth", { method: "DELETE" });
    bootstrapCache.data = null;
    bootstrapCache.time = 0;
    return data;
  },
  async loadBranches() {
    const data = await getBootstrapCached();
    return data.branches || [];
  },
  async loadCoaches() {
    const data = await getBootstrapCached();
    return data.coaches || [];
  },
  async loadTasks(branchId) {
    const query = new URLSearchParams();
    if (branchId) query.set("branchId", branchId);
    const data = await api(`/api/task${query.toString() ? `?${query}` : ""}`);
    return data.tasks || [];
  },
  async loadAllTasks() {
    const data = await api("/api/task?scope=all");
    return data.tasks || [];
  },
  async saveTask(task) {
    const data = await api("/api/task", { method: "POST", body: JSON.stringify({ task }) });
    return data.task || task;
  },
  async saveTaskMany(tasks) {
    if (!tasks?.length) return [];
    const data = await api("/api/task", { method: "POST", body: JSON.stringify({ tasks }) });
    return data.tasks || tasks;
  },
  async deleteTask(id) {
    await api("/api/task", { method: "DELETE", body: JSON.stringify({ id }) });
  },
  async saveBranch(branch) {
    await api("/api/branch", { method: "POST", body: JSON.stringify({ branch }) });
  },
  async deleteBranch(id) {
    await api("/api/branch", { method: "DELETE", body: JSON.stringify({ id }) });
  },
  async saveCoach(coach) {
    await api("/api/coach", { method: "POST", body: JSON.stringify({ coach }) });
  },
  async deleteCoach(id) {
    await api("/api/coach", { method: "DELETE", body: JSON.stringify({ id }) });
  },
};
