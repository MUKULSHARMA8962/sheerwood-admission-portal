const SESSION_KEY = "sheerwood.cognito.session";
const TRANSACTION_PREFIX = "sheerwood.cognito.transaction.";
const DEFAULT_SCOPES = "openid email";
const GROUP_ROLE_PRIORITY = ["admin", "teacher", "student", "parent", "admission", "vendor"];

function base64UrlEncode(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomValue(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createCodeChallenge(verifier) {
  const encodedVerifier = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", encodedVerifier);
  return base64UrlEncode(new Uint8Array(digest));
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(decodeURIComponent(Array.from(atob(padded), (character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")));
  } catch {
    return null;
  }
}

function sanitizeReturnTo(returnTo) {
  return typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "";
}

export function deriveRole(claims) {
  const configuredClaim = import.meta.env.VITE_COGNITO_ROLE_CLAIM || "custom:role";
  const claimValue = claims?.[configuredClaim] || claims?.["custom:role"] || claims?.role;
  const groups = Array.isArray(claims?.["cognito:groups"]) ? claims["cognito:groups"] : [];
  const normalize = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  const normalizedGroups = groups.map(normalize);
  const groupRole = GROUP_ROLE_PRIORITY.find((role) => normalizedGroups.includes(role));
  return groupRole || normalize(claimValue) || normalize(import.meta.env.VITE_COGNITO_DEFAULT_ROLE || "admission");
}

function normalizeDomain(domain) {
  if (!domain) return "";
  const withProtocol = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  try {
    const url = new URL(withProtocol);
    return url.origin;
  } catch {
    return "";
  }
}

export function getCognitoConfig() {
  const domain = normalizeDomain(import.meta.env.VITE_COGNITO_DOMAIN);
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim();
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI?.trim() || `${origin}/callback`;
  const logoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI?.trim() || `${origin}/`;

  return {
    domain,
    clientId,
    redirectUri,
    logoutUri,
    scopes: import.meta.env.VITE_COGNITO_SCOPES?.trim() || DEFAULT_SCOPES,
    // Set this only when using a confidential Cognito app client. It must be
    // same-origin (normally /api/auth/cognito/token), never the client secret.
    tokenExchangeUrl: import.meta.env.VITE_COGNITO_TOKEN_EXCHANGE_URL?.trim() || "",
  };
}

export function isCognitoConfigured() {
  const { domain, clientId } = getCognitoConfig();
  return Boolean(domain && clientId);
}

export function getCognitoConfigurationError() {
  if (isCognitoConfigured()) return "";
  return "Cognito sign-in is not configured yet. Set VITE_COGNITO_DOMAIN and VITE_COGNITO_CLIENT_ID before deploying.";
}

export async function startCognitoSignIn(returnTo = "") {
  const config = getCognitoConfig();
  if (!isCognitoConfigured()) throw new Error(getCognitoConfigurationError());
  if (typeof crypto === "undefined" || !crypto.subtle) throw new Error("Your browser does not support secure Cognito sign-in.");

  const state = randomValue();
  const verifier = randomValue(64);
  const codeChallenge = await createCodeChallenge(verifier);
  sessionStorage.setItem(`${TRANSACTION_PREFIX}${state}`, JSON.stringify({ verifier, returnTo: sanitizeReturnTo(returnTo) }));

  const parameters = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  window.location.assign(`${config.domain}/oauth2/authorize?${parameters}`);
}

function saveSession(tokens) {
  const claims = decodeJwtPayload(tokens.id_token);
  if (!claims) throw new Error("Cognito returned an invalid ID token.");

  const session = {
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
    user: {
      email: claims.email || claims["cognito:username"] || "",
      name: claims.name || claims.given_name || claims.email || "User",
      role: deriveRole(claims),
      claims,
    },
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function completeCognitoSignIn(search) {
  const query = new URLSearchParams(search);
  const providerError = query.get("error");
  const state = query.get("state");
  if (providerError) {
    if (state) sessionStorage.removeItem(`${TRANSACTION_PREFIX}${state}`);
    throw new Error(query.get("error_description") || "Cognito sign-in was cancelled or could not be completed.");
  }

  const code = query.get("code");
  if (!code) throw new Error("The Cognito callback is missing its authorization code. Please start sign-in again from the portal.");
  if (!state) {
    throw new Error("This sign-in was not started from the portal. Return to sign in and use Continue with Cognito; do not open the callback URL directly.");
  }

  const transactionKey = `${TRANSACTION_PREFIX}${state}`;
  const serializedTransaction = sessionStorage.getItem(transactionKey);
  sessionStorage.removeItem(transactionKey);
  if (!serializedTransaction) throw new Error("Your sign-in session has expired. Please start again.");

  let transaction;
  try {
    transaction = JSON.parse(serializedTransaction);
  } catch {
    throw new Error("Your sign-in session could not be verified. Please start again.");
  }

  const config = getCognitoConfig();
  if (!isCognitoConfigured()) throw new Error(getCognitoConfigurationError());
  const usesBackendExchange = Boolean(config.tokenExchangeUrl);
  const response = await fetch(usesBackendExchange ? config.tokenExchangeUrl : `${config.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": usesBackendExchange ? "application/json" : "application/x-www-form-urlencoded" },
    body: usesBackendExchange
      ? JSON.stringify({ code, redirect_uri: config.redirectUri, code_verifier: transaction.verifier })
      : new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: transaction.verifier,
      }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error_description || "Cognito could not finish your sign-in. Please try again.");

  const session = saveSession(data);
  return { session, returnTo: transaction.returnTo };
}

export function getStoredCognitoSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (!session || !session.accessToken || !session.idToken || session.expiresAt <= Date.now()) {
      clearCognitoSession();
      return null;
    }
    return session;
  } catch {
    clearCognitoSession();
    return null;
  }
}

export function clearCognitoSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getDefaultRouteForRole(role) {
  return {
    parent: "/new-user-dashboard",
    student: "/student/dashboard",
    teacher: "/teacher/dashboard",
    admin: "/admin/dashboard",
    admission: "/admission-details",
    vendor: "/vendor/dashboard",
  }[role] || "/dashboard";
}

export function startCognitoSignOut() {
  const config = getCognitoConfig();
  clearCognitoSession();
  if (!isCognitoConfigured()) {
    window.location.assign("/");
    return;
  }
  const parameters = new URLSearchParams({ client_id: config.clientId, logout_uri: config.logoutUri });
  window.location.assign(`${config.domain}/logout?${parameters}`);
}
