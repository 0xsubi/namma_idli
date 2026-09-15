import { getToken } from "./auth.js";

const API_ORIGIN =
  import.meta.env.RUNNING_LOCALLY === "true"
    ? "http://localhost:8080"
    : "https://namma-idli-api.0xlab.in";
const BASE = `${API_ORIGIN}/api`;

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Token": getToken(),
      ...options.headers,
    },
  });

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
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-Admin-Token": getToken() },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export const api = {
  createItem: (data) =>
    request("/items", { method: "POST", body: JSON.stringify(data) }),
  listItems: () => request("/items"),
  updateItem: (id, data) =>
    request(`/items/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteItem: (id) => request(`/items/${id}`, { method: "DELETE" }),

  createBill: (data) =>
    request("/bills", { method: "POST", body: JSON.stringify(data) }),
  listBills: (limit) => request(`/bills${query({ limit })}`),
  getBill: (id) => request(`/bills/${id}`),
  getBillEscpos: (id) => requestBytes(`/bills/${id}/escpos`),

  createSale: (data) =>
    request("/sales", { method: "POST", body: JSON.stringify(data) }),
  listSales: (params) => request(`/sales${query(params)}`),

  getAnalytics: (params) => request(`/analytics/summary${query(params)}`),

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
};
