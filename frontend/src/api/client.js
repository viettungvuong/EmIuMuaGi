import axios from "axios";

const client = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "https://nonspherical-ethelene-pangenetically.ngrok-free.dev",
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
  withCredentials: true, // for authentication using cookie
});

export default client;
