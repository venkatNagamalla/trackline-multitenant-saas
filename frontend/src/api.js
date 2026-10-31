
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

let refreshPromise = null;

function getStoredTokens() {
  try {
    return {
      access: localStorage.getItem("access_token"),
      refresh: localStorage.getItem("refresh_token"),
    };
  } catch {
    return { access: null, refresh: null };
  }
}

function saveTokens(tokens) {
  if (tokens?.access) {
    localStorage.setItem("access_token", tokens.access);
  }

  if (tokens?.refresh) {
    localStorage.setItem("refresh_token", tokens.refresh);
  }
}

export function clearStoredTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

async function refreshAccessToken() {
  const { refresh } = getStoredTokens();

  if (!refresh) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.access) {
          clearStoredTokens();
          return null;
        }

        saveTokens(data);
        return data.access;
      })
      .catch(() => {
        clearStoredTokens();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function apiFetch(path, options = {}, config = {}) {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const isRefreshRequest = path.includes("/auth/refresh/");
  const isLoginRequest = path.includes("/auth/login/");
  const isSignupRequest = path.includes("/auth/signup/");

  const makeRequest = (accessToken) => {
    const headers = new Headers(options.headers || {});

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    } else {
      headers.delete("Authorization");
    }

    const workspace =
      config.workspace ?? localStorage.getItem("current_workspace");

    if (workspace) {
      headers.set("X-Workspace", workspace);
    } else {
      headers.delete("X-Workspace");
    }

    if (options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(url, { ...options, headers });
  };

  const { access } = getStoredTokens();
  let response = await makeRequest(
    isLoginRequest || isSignupRequest ? null : access
  );

  if (
    response.status === 401 &&
    !isRefreshRequest &&
    !isLoginRequest &&
    !isSignupRequest
  ) {
    const newAccess = await refreshAccessToken();

    if (newAccess) {
      response = await makeRequest(newAccess);
    }
  }

  return response;
}

export async function apiRequest(path, options = {}, config = {}) {
  const response = await apiFetch(path, options, config);

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
  response.status === 402
    ? data?.detail || "Your plan limit has been reached. Please upgrade to Pro."
    : data?.detail ||
      data?.message ||
      data?.non_field_errors?.[0] ||
      (typeof data === "string" ? data : null) ||
      `Request failed with status ${response.status}`;

    const error = new Error(message);
    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

export { API_BASE_URL };
