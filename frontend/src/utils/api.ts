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

// Simple in-memory cache for GET requests
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

api.interceptors.request.use(
  (config) => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
    }

    // Check Cache for GET requests (except auth/me or sensitive ones if any)
    if (config.method?.toLowerCase() === 'get' && config.headers['x-no-cache'] !== 'true') {
      const cached = cache.get(config.url || '');
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        // Axios hack to return cached response without hitting network
        config.adapter = () => {
          return Promise.resolve({
            data: cached.data,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
            request: {}
          });
        };
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    // Cache successful GET responses
    if (response.config.method?.toLowerCase() === 'get') {
      cache.set(response.config.url || '', {
        data: response.data,
        timestamp: Date.now()
      });
    } else {
      // Clear cache on any mutation to ensure fresh data
      if (['post', 'put', 'delete', 'patch'].includes(response.config.method?.toLowerCase() || '')) {
        cache.clear();
      }
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      const message: string = error.response?.data?.message || '';
      // Only log out if the current user's own account is deactivated/unauthorized
      // Not when admin is receiving data about another user
      if (
        message.toLowerCase().includes('deactivated') ||
        message.toLowerCase().includes('no token') ||
        message.toLowerCase().includes('token failed') ||
        error.response?.status === 401
      ) {
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
