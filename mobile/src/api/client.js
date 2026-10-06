// The web frontend's client (frontend/src/api/client.js), for React Native.
// The backend keeps the session in access_token / refresh_token cookies; React
// Native's networking stores and resends those itself, like a browser does.
import axios from 'axios';
import { API_URL } from './config';

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
  withCredentials: true, // send the session cookies
});

const REFRESH_MAX_ATTEMPTS = 4;
const REFRESH_BASE_DELAY = 300; // ms, doubled each attempt
const REFRESH_COOLDOWN = 30000; // ms to wait after a refresh is rejected outright

let refreshInFlight = null; // parallel 401s wait on one refresh, not one each
let refreshBlockedUntil = 0;

// The web app redirects to /login?expired=true here; the app shows its login screen
let onSessionExpired = () => {};
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A 401/403 means the refresh token itself is finished, so asking again would
// never help. Only network errors and server errors are worth another try.
const isWorthRetrying = (err) => {
  const status = err.response?.status;
  return status === undefined || status >= 500;
};

async function refreshWithBackoff() {
  for (let attempt = 0; ; attempt++) {
    try {
      return await axios.get(`${API_URL}/api/auth/refresh`, { withCredentials: true });
    } catch (err) {
      if (attempt >= REFRESH_MAX_ATTEMPTS - 1 || !isWorthRetrying(err)) throw err;
      // 300ms, 600ms, 1200ms... plus jitter
      await sleep(REFRESH_BASE_DELAY * 2 ** attempt + Math.random() * 200);
    }
  }
}

// Shared so that a screen firing /api/me and /api/items at once refreshes once
function refreshOnce() {
  if (!refreshInFlight) {
    refreshInFlight = refreshWithBackoff().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // A 401 (Unauthorized) we haven't tried to recover from yet
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/api/auth/login') &&
      !originalRequest.url.includes('/api/auth/refresh')
    ) {
      originalRequest._retry = true;

      // A refresh that was just rejected will be rejected again for a while
      if (Date.now() < refreshBlockedUntil) {
        return Promise.reject(error);
      }

      try {
        // Gets a new access_token cookie from the refresh_token cookie
        await refreshOnce();
        return client(originalRequest);
      } catch (refreshError) {
        refreshBlockedUntil = Date.now() + REFRESH_COOLDOWN;
        onSessionExpired();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default client;
