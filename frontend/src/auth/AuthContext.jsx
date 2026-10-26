
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiRequest, clearStoredTokens } from "../api";

const AuthContext = createContext(null);

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const WORKSPACE_KEY = "current_workspace";

function readStoredWorkspace() {
  return localStorage.getItem(WORKSPACE_KEY) || "";
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem(ACCESS_KEY)
  );

  const [refreshToken, setRefreshToken] = useState(
    () => localStorage.getItem(REFRESH_KEY)
  );

  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);

  const [currentWorkspace, setCurrentWorkspaceState] =
    useState(readStoredWorkspace);

  const [loading, setLoading] = useState(
    () =>
      Boolean(
        localStorage.getItem(ACCESS_KEY) ||
          localStorage.getItem(REFRESH_KEY)
      )
  );

  const storeTokens = useCallback((tokens) => {
    if (tokens?.access) {
      localStorage.setItem(ACCESS_KEY, tokens.access);
      setAccessToken(tokens.access);
    }

    if (tokens?.refresh) {
      localStorage.setItem(REFRESH_KEY, tokens.refresh);
      setRefreshToken(tokens.refresh);
    }
  }, []);

  const setCurrentWorkspace = useCallback((slug) => {
    const nextSlug = slug || "";

    if (nextSlug) {
      localStorage.setItem(WORKSPACE_KEY, nextSlug);
    } else {
      localStorage.removeItem(WORKSPACE_KEY);
    }

    setCurrentWorkspaceState(nextSlug);
  }, []);

  const updateWorkspaces = useCallback(
    (items) => {
      setWorkspaces(items);

      const savedSlug = localStorage.getItem(WORKSPACE_KEY);
      const savedExists = items.some(
        (workspace) => workspace.slug === savedSlug
      );

      if (!savedExists && items.length > 0) {
        setCurrentWorkspace(items[0].slug);
      } else if (items.length === 0) {
        setCurrentWorkspace("");
      }
    },
    [setCurrentWorkspace]
  );

  const logout = useCallback(() => {
    clearStoredTokens();
    localStorage.removeItem(WORKSPACE_KEY);
    localStorage.removeItem("user");

    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setWorkspaces([]);
    setCurrentWorkspaceState("");
    setLoading(false);
  }, []);

  const loadCurrentUser = useCallback(async () => {
    const profile = await apiRequest("/auth/me/");

    setUser(profile);

    const items = Array.isArray(profile?.workspaces)
      ? profile.workspaces
      : [];

    updateWorkspaces(items);

    return profile;
  }, [updateWorkspaces]);

  const loadWorkspaces = useCallback(async () => {
    const profile = await loadCurrentUser();
    return profile.workspaces ?? [];
  }, [loadCurrentUser]);

  const login = useCallback(
    async (credentials) => {
      const data = await apiRequest("/auth/login/", {
        method: "POST",
        body: JSON.stringify(credentials),
      });

      // Your backend returns tokens inside data.tokens.
      const tokens = data?.tokens ?? data;

      if (!tokens?.access || !tokens?.refresh) {
        throw new Error(
          "Login response is missing access or refresh tokens."
        );
      }

      storeTokens({
        access: tokens.access,
        refresh: tokens.refresh,
      });

      // The login response already includes the user.
      setUser(data.user ?? null);

      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      setLoading(false);

      // Load workspaces using the existing /auth/me/ endpoint.
      try {
        const profile = await apiRequest("/auth/me/");

        setUser(profile);

        const items = Array.isArray(profile?.workspaces)
          ? profile.workspaces
          : [];

        updateWorkspaces(items);
      } catch (error) {
        console.error("Could not load user workspaces:", error);
        // Login remains successful even if workspace loading fails.
      }

      return data;
    },
    [storeTokens, updateWorkspaces]
  );

  const signup = useCallback(
    async (details) => {
      const data = await apiRequest("/auth/signup/", {
        method: "POST",
        body: JSON.stringify(details),
      });

      const tokens = data?.tokens ?? data;

      if (tokens?.access && tokens?.refresh) {
        storeTokens({
          access: tokens.access,
          refresh: tokens.refresh,
        });
      }

      return data;
    },
    [storeTokens]
  );

  useEffect(() => {
    let active = true;

    async function initialize() {
      if (!accessToken && !refreshToken) {
        setUser(null);
        setWorkspaces([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const profile = await apiRequest("/auth/me/");

        if (!active) return;

        setUser(profile);

        const items = Array.isArray(profile?.workspaces)
          ? profile.workspaces
          : [];

        updateWorkspaces(items);
      } catch (error) {
        if (!active) return;

        console.error("Could not restore the current user:", error);
        setUser(null);
        setWorkspaces([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [accessToken, refreshToken, updateWorkspaces]);

  const value = useMemo(
    () => ({
      accessToken,
      refreshToken,
      user,
      workspaces,
      currentWorkspace,
      setCurrentWorkspace,
      loading,
      login,
      signup,
      logout,
      loadCurrentUser,
      loadWorkspaces,
    }),
    [
      accessToken,
      refreshToken,
      user,
      workspaces,
      currentWorkspace,
      setCurrentWorkspace,
      loading,
      login,
      signup,
      logout,
      loadCurrentUser,
      loadWorkspaces,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
