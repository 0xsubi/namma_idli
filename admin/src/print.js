// Prints raw ESC/POS bytes to a Bluetooth Low Energy thermal printer via the
// Web Bluetooth API. Supported in Chrome/Edge on Android and desktop; NOT
// supported on iOS (WebKit blocks Web Bluetooth entirely), and requires a
// secure context (HTTPS, or localhost during dev).
//
// Cheap BLE thermal printers clone one of a handful of transparent-serial
// GATT profiles. We try the common ones in order and use the first writable
// characteristic we find.
const CANDIDATE_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // common BLE thermal printer profile
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART service
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC/HM-10 transparent UART
];

// Conservative default ATT MTU (23 bytes, 20 usable) that works reliably
// across cheap printers that don't negotiate a larger MTU.
const CHUNK_SIZE = 20;
const CHUNK_DELAY_MS = 15;

let device = null;
let characteristic = null;

async function findWritableCharacteristic(server) {
  for (const serviceUUID of CANDIDATE_SERVICES) {
    let service;
    try {
      service = await server.getPrimaryService(serviceUUID);
    } catch {
      continue; // this device doesn't expose that service
    }
    const chars = await service.getCharacteristics();
    const writable = chars.find(
      (c) => c.properties.write || c.properties.writeWithoutResponse
    );
    if (writable) return writable;
  }
  throw new Error(
    "No writable Bluetooth characteristic found on this printer — it may use an unsupported BLE profile."
  );
}

export function isPrinterConnected() {
  return !!(device?.gatt?.connected && characteristic);
}

export async function connectPrinter() {
  if (!navigator.bluetooth) {
    throw new Error(
      "Web Bluetooth isn't available. Use Chrome or Edge, and make sure the page is served over HTTPS."
    );
  }

  const picked = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: CANDIDATE_SERVICES,
  });

  const server = await picked.gatt.connect();
  const writable = await findWritableCharacteristic(server);

  picked.addEventListener("gattserverdisconnected", () => {
    device = null;
    characteristic = null;
  });

  device = picked;
  characteristic = writable;
  return device.name || "printer";
}

export async function printBytes(bytes) {
  if (!isPrinterConnected()) {
    await connectPrinter();
  }

  const withoutResponse = characteristic.properties.writeWithoutResponse;
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
    if (withoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
  }
}
