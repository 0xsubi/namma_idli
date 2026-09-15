import { PushNotifications } from "@capacitor/push-notifications";
import { api } from "./api.js";

// Native Android push, delivered via Firebase Cloud Messaging through the
// Capacitor push-notifications plugin. Counterpart to webPush.js, which
// handles the same UI contract (isPushSupported/getPushStatus/enablePush/
// disablePush) for browser tabs.
const TOKEN_KEY = "fcm_token";

export function isPushSupported() {
  return true;
}

export async function getPushStatus() {
  const { receive } = await PushNotifications.checkPermissions();
  return receive === "granted" && localStorage.getItem(TOKEN_KEY) ? "enabled" : "disabled";
}

export async function enablePush() {
  let { receive } = await PushNotifications.checkPermissions();
  if (receive !== "granted") {
    ({ receive } = await PushNotifications.requestPermissions());
  }
  if (receive !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  await PushNotifications.removeAllListeners();

  await new Promise((resolve, reject) => {
    PushNotifications.addListener("registration", async (token) => {
      try {
        await api.registerFcmToken(token.value);
        localStorage.setItem(TOKEN_KEY, token.value);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
    PushNotifications.addListener("registrationError", (err) => {
      reject(new Error(err.error || "FCM registration failed."));
    });
    PushNotifications.register();
  });
}

export async function disablePush() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  await api.unregisterFcmToken(token);
  localStorage.removeItem(TOKEN_KEY);
}
