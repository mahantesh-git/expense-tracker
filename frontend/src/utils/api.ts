import axios from 'axios';

let backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';

if (backendUrl) {
  // Ensure it has a protocol
  if (!backendUrl.startsWith('http')) {
    backendUrl = `https://${backendUrl}`;
  }
  // Remove trailing slash
  if (backendUrl.endsWith('/')) {
    backendUrl = backendUrl.slice(0, -1);
  }
  // Ensure it ends with /api
  if (!backendUrl.endsWith('/api')) {
    backendUrl = `${backendUrl}/api`;
  }
}

const api = axios.create({
  baseURL: backendUrl || `http://${window.location.hostname}:5000/api`,
});

api.interceptors.request.use(
  (config) => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
