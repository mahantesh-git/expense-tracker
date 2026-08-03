import api from './api';

let pingerInterval: number | null = null;

// Ping the backend every 10 minutes to prevent Render free-tier cold starts
export const startKeepAlive = () => {
  if (pingerInterval) return;

  const ping = async () => {
    try {
      // Use the header to bypass cache for the ping
      await api.get('/health', { headers: { 'x-no-cache': 'true' } });
      console.log('Keep-alive ping sent to backend');
    } catch (e) {
      console.warn('Keep-alive ping failed');
    }
  };

  // Ping immediately on start
  ping();

  // Ping every 10 minutes (600,000 ms)
  pingerInterval = window.setInterval(ping, 600000);
};

export const stopKeepAlive = () => {
  if (pingerInterval) {
    clearInterval(pingerInterval);
    pingerInterval = null;
  }
};
