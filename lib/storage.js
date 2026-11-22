const PREFIX = "paperdesk";

function storageAvailable() {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

export function attemptStorageKey(paperId, mode = "owner") {
  return `${PREFIX}:attempt:${mode}:${paperId}`;
}

export function readLocalAttempt(key) {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalAttempt(key, value) {
  if (!storageAvailable()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalAttempt(key) {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function readPreference(key, fallback) {
  if (!storageAvailable()) return fallback;
  try {
    const raw = window.localStorage.getItem(`${PREFIX}:pref:${key}`);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writePreference(key, value) {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(`${PREFIX}:pref:${key}`, JSON.stringify(value));
  } catch {
    // ignore
  }
}
