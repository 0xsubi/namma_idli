import { api } from "./api.js";

let currentUser = null;

export async function fetchMe() {
  try {
    currentUser = await api.me();
  } catch {
    currentUser = null;
  }
  return currentUser;
}

export function getUser() {
  return currentUser;
}

export function isAuthed() {
  return !!currentUser;
}

export function isAdmin() {
  return currentUser?.role === "admin";
}

export function setUser(user) {
  currentUser = user;
}

export async function logout() {
  try {
    await api.logout();
  } catch {
    // already logged out server-side, or the request failed — either way
    // clear local state so the UI reflects a logged-out session.
  }
  currentUser = null;
}
