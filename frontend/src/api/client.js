import axios from "axios";

const client = axios.create({
  baseURL: "/",
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
  withCredentials: true, // for authentication using cookie
});

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

      try {
        // Attempt to refresh the token using the refresh_token cookie
        await axios.get("/api/auth/refresh", { withCredentials: true });

        // Retry the original request (it will now use the new access_token cookie)
        return client(originalRequest);
      } catch (refreshError) {
        // If refresh fails (e.g., refresh token also expired), redirect to login
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default client;
