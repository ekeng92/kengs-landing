// Shared Supabase Auth module — loaded before app scripts on every page.
// Exposes window.Auth with helpers used by all frontend pages.
//
// Supabase anon (publishable) key is safe to include here — it is not a secret.
// Replace SUPABASE_ANON_KEY if you rotate the key in your Supabase project.

(function () {
  const SUPABASE_URL = 'https://ubfvhzepyizfjmghkhyh.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_FiK5az3hZgHDDfA430j94g_JkAMznHQ';

  // Resolve paths relative to the site root regardless of which subdirectory
  // the page is in (e.g. /dashboard/, /booking-review/).
  function rootPath(path) {
    const origin = location.origin;
    return origin + path;
  }

  let _client = null;

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
    const { data } = await getClient().auth.getSession();
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
  getClient().auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      location.href = rootPath('/login.html');
    }
  });

  window.Auth = { requireLogin, getSession, getHeaders, jsonHeaders, signIn, signUp, signOut, getUserEmail };
})();
