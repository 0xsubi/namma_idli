const STORAGE_KEY = "admin_token";

export function isAuthed() {
  return !!sessionStorage.getItem(STORAGE_KEY);
}

export function getToken() {
  return sessionStorage.getItem(STORAGE_KEY) || "";
}

export function setToken(token) {
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function logout() {
  sessionStorage.removeItem(STORAGE_KEY);
}
