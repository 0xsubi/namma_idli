export const API_ORIGIN =
  import.meta.env.RUNNING_LOCALLY === "true"
    ? "http://localhost:8080"
    : "https://namma-idli-api.0xlab.in";
const BASE = `${API_ORIGIN}/api`;

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) onUnauthorized();

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

function query(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
  ).toString();
  return qs ? `?${qs}` : "";
}

async function requestBytes(path) {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (res.status === 401) onUnauthorized();
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export const api = {
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  changePassword: (currentPassword, newPassword) =>
    request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  listUsers: () => request("/users"),
  createUser: (data) => request("/users", { method: "POST", body: JSON.stringify(data) }),
  updateUserRole: (id, role) =>
    request(`/users/${id}`, { method: "PATCH", body: JSON.stringify({ role }) }),
  deleteUser: (id) => request(`/users/${id}`, { method: "DELETE" }),

  createItem: (data) =>
    request("/items", { method: "POST", body: JSON.stringify(data) }),
  listItems: () => request("/items"),
  updateItem: (id, data) =>
    request(`/items/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteItem: (id) => request(`/items/${id}`, { method: "DELETE" }),
  uploadItemImage: async (id, file) => {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch(`${BASE}/items/${id}/image`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (res.status === 401) onUnauthorized();
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const body = isJson ? await res.json().catch(() => null) : null;
    if (!res.ok) {
      throw new Error(body?.error || `Request failed (${res.status})`);
    }
    return body;
  },

  createBill: (data) =>
    request("/bills", { method: "POST", body: JSON.stringify(data) }),
  listBills: (limit) => request(`/bills${query({ limit })}`),
  getBill: (id) => request(`/bills/${id}`),
  getBillEscpos: (id) => requestBytes(`/bills/${id}/escpos`),

  createSale: (data) =>
    request("/sales", { method: "POST", body: JSON.stringify(data) }),
  listSales: (params) => request(`/sales${query(params)}`),

  getAnalytics: (params) => request(`/analytics/summary${query(params)}`),

  parseVoiceOrder: (transcript) =>
    request("/voice/parse", { method: "POST", body: JSON.stringify({ transcript }) }),

  listOrders: (status) => request(`/orders${query({ status })}`),
  getOrder: (id) => request(`/orders/${id}`),
  updateOrderStatus: (id, status) =>
    request(`/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  convertOrderToBill: (id, paymentMethod) =>
    request(`/orders/${id}/bill`, {
      method: "POST",
      body: JSON.stringify({ payment_method: paymentMethod }),
    }),

  getVapidPublicKey: () => request("/push/vapid-public-key"),
  subscribePush: (subscription) =>
    request("/push/subscribe", { method: "POST", body: JSON.stringify(subscription) }),
  unsubscribePush: (endpoint) =>
    request("/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) }),

  registerFcmToken: (token) =>
    request("/push/fcm/register", { method: "POST", body: JSON.stringify({ token }) }),
  unregisterFcmToken: (token) =>
    request("/push/fcm/unregister", { method: "POST", body: JSON.stringify({ token }) }),
};
