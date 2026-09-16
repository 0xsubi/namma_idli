import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

// Voice order capture for the native Android app. The Capacitor WebView
// doesn't implement the browser SpeechRecognition API, so this wraps the
// on-device Android speech recognizer (free, works offline) via the
// community plugin instead. `popup: true` uses Android's own listening
// dialog, which gives us mic feedback and silence-detection for free.
export function isVoiceInputSupported() {
  return Capacitor.isNativePlatform();
}

export async function captureVoiceOrder() {
  const { available } = await SpeechRecognition.available();
  if (!available) {
    throw new Error("Speech recognition isn't available on this device.");
  }

  let { speechRecognition: status } = await SpeechRecognition.checkPermissions();
  if (status !== "granted") {
    ({ speechRecognition: status } = await SpeechRecognition.requestPermissions());
  }
  if (status !== "granted") {
    throw new Error("Microphone permission was not granted.");
  }

  const { matches } = await SpeechRecognition.start({
    language: "en-IN",
    maxResults: 1,
    prompt: 'Say the order — e.g. "2 plates of Idli"',
    popup: true,
    partialResults: false,
  });

  const transcript = matches?.[0]?.trim();
  if (!transcript) {
    throw new Error("Didn't catch that — try again.");
  }
  return transcript;
}
