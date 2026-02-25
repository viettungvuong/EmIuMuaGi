import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://b269-115-73-138-27.ngrok-free.app",
  headers: {
    "Content-Type": "application/json",
  },
});

export default client;
