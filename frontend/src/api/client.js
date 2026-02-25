import axios from "axios";

const client = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL || "https://c188-115-73-138-27.ngrok-free.app",
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

export default client;
