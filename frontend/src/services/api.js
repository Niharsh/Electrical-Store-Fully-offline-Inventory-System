import axios from "axios";

// ✅ Production-ready: Always use relative API path
// Works for:
// - Django serving React (production)
// - Electron loading from localhost:8000
// - No CORS issues

const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("access_token");
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject({
      status: error.response?.status,
      message:
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Something went wrong",
      raw: error,
    });
  }
);

export default api;