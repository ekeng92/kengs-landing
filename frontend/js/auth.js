// Shared Supabase Auth module — loaded before app scripts on every page.
// Exposes window.Auth with helpers used by all frontend pages.
//
// Supabase anon (publishable) key is safe to include here — it is not a secret.
// Replace SUPABASE_ANON_KEY if you rotate the key in your Supabase project.

(function () {
  const SUPABASE_URL = 'https://ubfvhzepyizfjmghkhyh.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZnZoemVweWl6ZmptZ2hraHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzI2NDcsImV4cCI6MjA5MjMwODY0N30.DxXuQSPvcPetNMN3F9BWJ9bxTisolB3eRQRhgr_Z_hE';

  // Resolve paths relative to the site root regardless of which subdirectory
  // the page is in (e.g. /dashboard/, /booking-review/).
  function rootPath(path) {
    const origin = location.origin;
    return origin + path;
  }

  const API = location.hostname === 'localhost' ? 'http://localhost:8787' : 'https://kengs-landing-api.kengs-landing.workers.dev';

  let _client = null;
  let _workspace = null;

  function getClient() {
    if (!_client) {
      // supabase global is loaded by the CDN script tag before this file
      _client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          storageKey: 'kl-auth',
        },
      });
    }
    return _client;
  }

  async function getSession() {
    const { data, error } = await getClient().auth.getSession();
    // If session expired, try to refresh
    if (!data.session) {
      const { data: refreshed } = await getClient().auth.refreshSession();
      return refreshed.session;
    }
    return data.session;
  }

  /**
   * Redirect to /login.html if no active session.
   * Call this at the top of DOMContentLoaded in every protected page.
   */
  async function requireLogin() {
    const session = await getSession();
    if (!session) {
      location.href = rootPath('/login.html');
    }
    return session;
  }

  /**
   * Returns headers object with Authorization bearer token.
   * Use this in every fetch() call to the API.
   */
  async function getHeaders(extra) {
    const session = await getSession();
    if (!session) {
      location.href = rootPath('/login.html');
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      ...extra,
    };
  }

  /**
   * Returns headers for JSON API calls.
   */
  async function jsonHeaders() {
    return getHeaders({ 'Content-Type': 'application/json' });
  }

  async function signIn(email, password) {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    return { data, error };
  }

  async function signUp(email, password) {
    const { data, error } = await getClient().auth.signUp({ email, password });
    return { data, error };
  }

  async function signOut() {
    await getClient().auth.signOut();
    location.href = rootPath('/login.html');
  }

  async function getUserEmail() {
    const session = await getSession();
    return session?.user?.email ?? null;
  }

  // Listen for auth state changes (e.g. token refresh, sign-out from another tab)
  getClient().auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      _workspace = null;
      location.href = rootPath('/login.html');
    }
    if (event === 'TOKEN_REFRESHED') {
      // Session auto-refreshed by Supabase client — nothing to do
      console.debug('[Auth] Token refreshed');
    }
  });

  /**
   * Load the user's workspace. Caches after first call.
   * Returns { id, name } or null if none found.
   */
  async function getWorkspace() {
    if (_workspace) return _workspace;
    const headers = await getHeaders();
    const res = await fetch(API + '/workspaces', { headers });
    if (!res.ok) return null;
    const { data } = await res.json();
    if (data && data.length > 0) {
      // API returns { workspace_id, role, workspaces: { id, name, ... } }
      const row = data[0];
      _workspace = row.workspaces ?? row;
      _workspace.workspace_id = row.workspace_id ?? _workspace.id;
    }
    return _workspace;
  }

  /**
   * Returns the workspace ID. Convenience shortcut.
   */
  async function getWorkspaceId() {
    const ws = await getWorkspace();
    return ws?.workspace_id ?? ws?.id ?? null;
  }

  /**
   * Authenticated fetch wrapper for the backend API.
   * Automatically attaches JWT and Content-Type headers.
   */
  async function apiFetch(path, opts = {}) {
    const headers = await jsonHeaders();
    return fetch(API + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  }

  window.Auth = { requireLogin, getSession, getHeaders, jsonHeaders, signIn, signUp, signOut, getUserEmail, getWorkspace, getWorkspaceId, apiFetch, API };
})();
