import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000', // Change this if your backend uses a different port
});

// 1. Send the token with every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 2. 🛑 THE FIX: Listen for Expired Tokens Globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // The token is expired or invalid! 
      // Clear it and immediately kick the user back to the login screen.
      localStorage.removeItem('access_token');
      window.location.href = '/'; 
    }
    return Promise.reject(error);
  }
);

export default api;