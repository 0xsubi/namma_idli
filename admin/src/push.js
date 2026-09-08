import { api } from "./api.js";

// Web Push requires a secure context (HTTPS, or localhost). It is not
// supported on iOS Safari at all.
export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

export async function getPushStatus() {
  if (!isPushSupported()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return "disabled";
  const sub = await reg.pushManager.getSubscription();
  return sub ? "enabled" : "disabled";
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function enablePush() {
  if (!isPushSupported()) {
    throw new Error(
      "Push notifications aren't supported in this browser (use Chrome/Edge over HTTPS)."
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const { public_key } = await api.getVapidPublicKey();
  if (!public_key) {
    throw new Error("Push isn't configured on the server yet (missing VAPID keys).");
  }

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(public_key),
  });

  await api.subscribePush(subscription.toJSON());
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return;

  await api.unsubscribePush(subscription.endpoint);
  await subscription.unsubscribe();
}
