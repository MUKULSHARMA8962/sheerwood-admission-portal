const SIGNED_OUT_KEY = "sherwood.cognito.signed-out";

function safeStorage(callback) {
  try {
    callback(window.sessionStorage);
    callback(window.localStorage);
  } catch {
    // Private browsing or storage policies must never prevent a user logging out.
  }
}

export function markSignedOut() {
  try {
    window.sessionStorage.setItem(SIGNED_OUT_KEY, "true");
  } catch {
    // The Cognito redirect still completes when browser storage is unavailable.
  }
}

export function wasSignedOut() {
  try {
    return window.sessionStorage.getItem(SIGNED_OUT_KEY) === "true";
  } catch {
    return false;
  }
}

export function clearSignedOutMarker() {
  try {
    window.sessionStorage.removeItem(SIGNED_OUT_KEY);
  } catch {
    // Nothing else is required before a new Cognito sign-in attempt.
  }
}

export function clearBrowserAuthStorage() {
  safeStorage((storage) => {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean);
    keys.forEach((key) => {
      if (key.startsWith("oidc.user:") || key === "sheerwood.cognito.session" || key.startsWith("sheerwood.cognito.transaction.")) {
        storage.removeItem(key);
      }
    });
  });
}
