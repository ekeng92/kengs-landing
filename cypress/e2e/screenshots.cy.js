// Screenshot spec for all Kengs Landing views
// Takes desktop (1440x900) and mobile (390x844) screenshots of every page
// Iteration number is passed via CYPRESS_ITERATION env var (default: 1)

const ITERATION = Cypress.env('ITERATION') || '1';

const VIEWS = [
  { name: 'login', path: '/login.html', auth: false },
  { name: 'register', path: '/register/', auth: false },
  { name: 'hub', path: '/', auth: true },
  { name: 'dashboard', path: '/dashboard/', auth: true },
  { name: 'tasks', path: '/tasks/', auth: true },
  { name: 'expense-review', path: '/expense-review/', auth: true },
  { name: 'booking-review', path: '/booking-review/', auth: true },
  { name: 'operations', path: '/operations/', auth: true },
  { name: 'cleaning', path: '/cleaning/', auth: true },
  { name: 'users', path: '/users/', auth: true },
  { name: 'settings', path: '/settings/', auth: true },
];

const SUPABASE_URL = 'https://ubfvhzepyizfjmghkhyh.supabase.co';
const API = 'https://kengs-landing-api.kengs-landing.workers.dev';

// Mock session matching Supabase JS v2 storage format
const MOCK_USER = {
  id: 'test-user-id',
  email: 'ekeng92@gmail.com',
  role: 'authenticated',
  aud: 'authenticated',
  app_metadata: { provider: 'email' },
  user_metadata: { display_name: 'Eric Keng' },
  created_at: '2026-01-01T00:00:00Z',
};

function buildMockSession() {
  return {
    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZnZoemVweWl6ZmptZ2hraHloIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJleHAiOjk5OTk5OTk5OTksImlhdCI6MTcxNDYwMDAwMH0.fake-sig-for-cypress',
    refresh_token: 'mock-refresh-token',
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    token_type: 'bearer',
    user: MOCK_USER,
  };
}

const MOCK_WORKSPACE = {
  data: [{
    workspace_id: 'test-workspace-id',
    role: 'owner',
    display_name: 'Eric Keng',
    email: 'ekeng92@gmail.com',
    feature_access: {},
    workspaces: { id: 'test-workspace-id', name: "Keng's Landing" },
  }],
};

function setupAllIntercepts() {
  const session = buildMockSession();

  // ── Supabase Auth intercepts ──
  // getSession() calls POST /token?grant_type=refresh_token
  cy.intercept('POST', `${SUPABASE_URL}/auth/v1/token*`, {
    statusCode: 200,
    body: session,
  }).as('authToken');

  // getUser() calls GET /auth/v1/user
  cy.intercept('GET', `${SUPABASE_URL}/auth/v1/user`, {
    statusCode: 200,
    body: MOCK_USER,
  }).as('authUser');

  // signOut calls POST /auth/v1/logout
  cy.intercept('POST', `${SUPABASE_URL}/auth/v1/logout`, {
    statusCode: 200,
    body: {},
  });

  // ── Backend API intercepts ──
  cy.intercept('GET', `${API}/workspaces`, {
    statusCode: 200,
    body: MOCK_WORKSPACE,
  }).as('workspaces');

  cy.intercept('GET', `${API}/workspaces/*/members`, { statusCode: 200, body: { data: [] } });
  cy.intercept('GET', `${API}/workspaces/*/profile`, { statusCode: 200, body: { data: { id: 'mem-1', user_id: 'test-user-id', role: 'owner', display_name: 'Eric Keng', email: 'ekeng92@gmail.com', feature_access: {} } } });
  cy.intercept('GET', `${API}/tasks*`, { statusCode: 200, body: { data: [] } });
  cy.intercept('GET', `${API}/expenses*`, { statusCode: 200, body: { data: [] } });
  cy.intercept('GET', `${API}/bookings*`, { statusCode: 200, body: { data: [] } });
  cy.intercept('GET', `${API}/properties*`, { statusCode: 200, body: { data: [] } });
  cy.intercept('GET', `${API}/mileage*`, { statusCode: 200, body: { data: [] } });
  cy.intercept('GET', `${API}/dashboard*`, { statusCode: 200, body: { data: {} } });
  cy.intercept('GET', `${API}/invites*`, { statusCode: 200, body: { data: [] } });
  cy.intercept('GET', `${API}/cleaning*`, { statusCode: 200, body: { data: [] } });
  cy.intercept('GET', `${API}/imports*`, { statusCode: 200, body: { data: [] } });
  cy.intercept('GET', `${API}/csv-templates*`, { statusCode: 200, body: { data: [] } });
  cy.intercept('GET', `${API}/property-tasks*`, { statusCode: 200, body: { data: [] } });
  cy.intercept('GET', `${API}/ical-sync*`, { statusCode: 200, body: { data: [] } });
}

function visitWithAuth(path) {
  const session = buildMockSession();

  // Supabase JS v2 stores under the configured storageKey ('kl-auth')
  // Format: JSON string of the session object directly
  const storageValue = JSON.stringify(session);

  setupAllIntercepts();

  cy.visit(path, {
    failOnStatusCode: false,
    onBeforeLoad(win) {
      // Set both possible storage keys the SDK might check
      win.localStorage.setItem('kl-auth', storageValue);
      // Also prevent any redirect by stubbing location.href setter
      // after the real page scripts have a chance to read localStorage
    },
  });

  // Wait for page to settle — auth check + API calls + rendering
  cy.wait(2500);

  // Verify we're NOT on the login page (auth bypass worked)
  cy.url().then((url) => {
    if (url.includes('/login') && !path.includes('/login')) {
      // Auth bypass failed — try alternative: stub window.Auth before page loads
      cy.log('⚠️ Auth redirect detected, retrying with Auth stub');
      setupAllIntercepts();
      cy.visit(path, {
        failOnStatusCode: false,
        onBeforeLoad(win) {
          win.localStorage.setItem('kl-auth', storageValue);
          // Directly stub the Auth module on window before scripts run
          Object.defineProperty(win, '__cypressAuthBypass__', { value: true });
        },
      });
      cy.wait(2500);
    }
  });
}

VIEWS.forEach((view) => {
  describe(`${view.name}`, () => {
    it(`desktop`, () => {
      cy.viewport(1440, 900);
      if (view.auth) {
        visitWithAuth(view.path);
      } else {
        cy.visit(view.path, { failOnStatusCode: false });
        cy.wait(2000);
      }
      cy.screenshot(`${view.name}-desktop-${ITERATION}`, { capture: 'fullPage' });
    });

    it(`mobile`, () => {
      cy.viewport(390, 844);
      if (view.auth) {
        visitWithAuth(view.path);
      } else {
        cy.visit(view.path, { failOnStatusCode: false });
        cy.wait(2000);
      }
      cy.screenshot(`${view.name}-mobile-${ITERATION}`, { capture: 'fullPage' });
    });
  });
});
