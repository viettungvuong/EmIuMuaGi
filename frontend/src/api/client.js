import axios from "axios";

const client = axios.create({
  baseURL: "/",
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
  withCredentials: true, // for authentication using cookie
});

export default client;
