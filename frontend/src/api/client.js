import axios from "axios";

const client = axios.create({
  baseURL: "/",
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
  withCredentials: true, // for authentication using cookie
});

const REFRESH_MAX_ATTEMPTS = 4;
const REFRESH_BASE_DELAY = 300; // ms, doubled each attempt
const REFRESH_COOLDOWN = 30000; // ms to wait after a refresh is rejected outright

let refreshInFlight = null; // parallel 401s wait on one refresh, not one each
let refreshBlockedUntil = 0;

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
      return await axios.get("/api/auth/refresh", { withCredentials: true });
    } catch (err) {
      if (attempt >= REFRESH_MAX_ATTEMPTS - 1 || !isWorthRetrying(err)) throw err;
      // 300ms, 600ms, 1200ms... plus jitter so several tabs do not line up
      await sleep(REFRESH_BASE_DELAY * 2 ** attempt + Math.random() * 200);
    }
  }
}

// Shared so that a page firing /api/me and /api/items at once refreshes once
function refreshOnce() {
  if (!refreshInFlight) {
    refreshInFlight = refreshWithBackoff().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// Response Interceptor for Automatic Refresh
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 (Unauthorized) and we haven't tried to refresh yet
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes("/api/auth/login") &&
      !originalRequest.url.includes("/api/auth/refresh")
    ) {
      originalRequest._retry = true;

      // A refresh that was just rejected will be rejected again for a while
      if (Date.now() < refreshBlockedUntil) {
        return Promise.reject(error);
      }

      try {
        // Attempt to refresh the token using the refresh_token cookie
        await refreshOnce();

        // Retry the original request (it will now use the new access_token cookie)
        return client(originalRequest);
      } catch (refreshError) {
        refreshBlockedUntil = Date.now() + REFRESH_COOLDOWN;

        // If refresh fails (e.g., refresh token also expired), redirect to login
        // Only redirect if we're not already heading to the login page
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/login?expired=true";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default client;
