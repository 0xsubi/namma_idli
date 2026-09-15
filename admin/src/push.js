import { Capacitor } from "@capacitor/core";
import * as webPush from "./webPush.js";
import * as fcmPush from "./fcmPush.js";

// Picks the right notification backend for the environment: FCM in the
// native Android app (Capacitor WebView can't do the browser Push API),
// Web Push everywhere else.
const impl = Capacitor.isNativePlatform() ? fcmPush : webPush;

export const isPushSupported = impl.isPushSupported;
export const getPushStatus = impl.getPushStatus;
export const enablePush = impl.enablePush;
export const disablePush = impl.disablePush;
