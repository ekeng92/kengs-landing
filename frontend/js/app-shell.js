/**
 * App Shell — Shared navigation, header, and UX utilities.
 * Injected by every page after auth.js.
 * Provides: bottom nav, header with back + avatar, user menu, toast, page detection.
 *
 * author: AEON Dev | created: 2026-04-26
 */
(function () {
  'use strict';

  // ── Page detection ──────────────────────────────────────────────────
  const path = location.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';

  const NAV_ITEMS = [
    { id: 'home',     href: '/',                icon: '🏠', label: 'Home',      match: p => p === '' || p === '/' },
    { id: 'tasks',    href: '/tasks/',           icon: '📋', label: 'Tasks',     match: p => p.startsWith('/tasks') },
    { id: 'dash',     href: '/dashboard/',       icon: '📊', label: 'Dashboard', match: p => p.startsWith('/dashboard') },
    { id: 'expenses', href: '/expense-review/',  icon: '🧾', label: 'Expenses',  match: p => p.startsWith('/expense-review') },
    { id: 'bookings', href: '/booking-review/',  icon: '📅', label: 'Bookings',  match: p => p.startsWith('/booking-review') },
  ];

  const activePage = NAV_ITEMS.find(n => n.match(path));

  // ── Build bottom nav ────────────────────────────────────────────────
  function buildBottomNav() {
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Main navigation');

    nav.innerHTML = NAV_ITEMS.map(item => `
      <a class="bottom-nav-item${item === activePage ? ' active' : ''}"
         href="${item.href}" aria-label="${item.label}">
        <span class="nav-icon">${item.icon}</span>
        <span>${item.label}</span>
      </a>
    `).join('');

    document.body.appendChild(nav);
  }

  // ── Build desktop nav (inside header) ───────────────────────────────
  function buildDesktopNav() {
    const nav = document.createElement('nav');
    nav.className = 'desktop-nav';
    nav.setAttribute('aria-label', 'Desktop navigation');

    nav.innerHTML = NAV_ITEMS.map(item => `
      <a class="${item === activePage ? 'active' : ''}" href="${item.href}">${item.label}</a>
    `).join('');

    return nav;
  }

  // ── Build header ────────────────────────────────────────────────────
  function buildHeader(pageTitle) {
    const header = document.createElement('header');
    header.className = 'app-header';

    // Back button (only on sub-pages, not home)
    const isHome = !activePage || activePage.id === 'home';
    const backHtml = isHome ? '' : `<a class="app-header-back" href="/" aria-label="Home">‹</a>`;

    header.innerHTML = `
      ${backHtml}
      <div class="app-header-title">
        ${isHome ? "Keng's Landing" : (pageTitle || "Keng's Landing")}
        ${isHome ? '<small>Operations Hub</small>' : ''}
      </div>
      <div class="app-header-actions" id="app-header-actions">
        <div class="app-header-avatar" id="app-avatar" aria-label="Account menu">
          ?
          <div class="user-menu" id="user-menu">
            <div class="user-menu-email" id="user-menu-email">Loading...</div>
            <button class="user-menu-item danger" onclick="Auth.signOut()">Sign Out</button>
          </div>
        </div>
      </div>
    `;

    // Insert desktop nav after the title
    const desktopNav = buildDesktopNav();
    header.querySelector('.app-header-title').after(desktopNav);

    return header;
  }

  // ── Init Shell ──────────────────────────────────────────────────────
  function initShell() {
    // Detect if page already has a custom header
    const existingHeader = document.querySelector('header');
    const pageTitle = existingHeader
      ? (existingHeader.querySelector('h1')?.textContent?.trim() || document.title)
      : document.title;

    // Remove existing header — we replace it
    if (existingHeader) existingHeader.remove();

    // Inject app shell header at top of body
    const header = buildHeader(pageTitle);
    document.body.prepend(header);

    // Inject bottom nav
    buildBottomNav();

    // Wire avatar menu
    const avatar = document.getElementById('app-avatar');
    const menu = document.getElementById('user-menu');
    if (avatar && menu) {
      avatar.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
      });
      document.addEventListener('click', () => menu.classList.remove('open'));
    }

    // Set user email + avatar initials
    if (window.Auth) {
      Auth.getUserEmail().then(email => {
        if (email) {
          const emailEl = document.getElementById('user-menu-email');
          if (emailEl) emailEl.textContent = email;
          if (avatar) avatar.textContent = email[0].toUpperCase();
          // Also update any legacy #user-email element
          const legacy = document.getElementById('user-email');
          if (legacy) legacy.textContent = email;
        }
      });
    }

    // Inject toast container if not present
    if (!document.querySelector('.app-toast')) {
      const toast = document.createElement('div');
      toast.className = 'app-toast';
      toast.id = 'app-toast';
      document.body.appendChild(toast);
    }
  }

  // ── Toast Utility ───────────────────────────────────────────────────
  window.showToast = function(msg, duration = 3000) {
    const toast = document.getElementById('app-toast') || document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    toast.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.style.display = 'none', 200);
    }, duration);
  };

  // ── Run on DOM ready ────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShell);
  } else {
    initShell();
  }

  // ── Expose for pages that need to add header actions ────────────────
  window.AppShell = {
    getHeaderActions: () => document.getElementById('app-header-actions'),
    activePage,
    NAV_ITEMS,
    showToast: window.showToast,
  };
})();
