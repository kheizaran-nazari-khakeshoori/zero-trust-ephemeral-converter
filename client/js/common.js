// Shared helpers for all pages
export function getApiBase() {
  const meta = document.querySelector('meta[name="api-base"]');
  if (meta && meta.content) return meta.content.replace(/\/$/, '');
  const stored = localStorage.getItem('apiBase');
  if (stored) return stored.replace(/\/$/, '');
  if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
    if (location.port === '5500') return 'http://127.0.0.1:5000';
  }
  return location.origin.replace(/\/$/, '');
}
export const API_BASE = getApiBase();

export function getAccessToken() {
  return sessionStorage.getItem('accessToken') || '';
}
export function setAccessToken(token) {
  if (token) sessionStorage.setItem('accessToken', token);
  else sessionStorage.removeItem('accessToken');
}
export function isLoggedIn() {
  return Boolean(getAccessToken());
}
export function clearAuth() {
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('tempAuthToken');
}

export function updateNav() {
  const loggedIn = isLoggedIn();
  document.querySelectorAll('[data-auth="logged-in"]').forEach(el => {
    el.style.display = loggedIn ? '' : 'none';
  });
  document.querySelectorAll('[data-auth="logged-out"]').forEach(el => {
    el.style.display = loggedIn ? 'none' : '';
  });
  const logoutBtn = document.getElementById('navLogoutBtn');
  if (logoutBtn) {
    logoutBtn.style.display = loggedIn ? 'inline-block' : 'none';
    logoutBtn.onclick = (e) => {
      e.preventDefault();
      clearAuth();
      updateNav();
      // if on converter page redirect to login, else just notify
      if (location.pathname.includes('converter')) {
        location.href = 'login.html';
      } else {
        // optional soft refresh
        location.reload();
      }
    };
  }
}

// Call on DOMContentLoaded for every page
export function initCommon() {
  updateNav();
  // highlight active nav link
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar-links .nav-link').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}
