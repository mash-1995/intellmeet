import axios from 'axios';

const api = axios.create({ baseURL: process.env.REACT_APP_API_URL || '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('intellmeet_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const errorMessage = (err, fallback = 'Something went wrong. Try again.') =>
  err?.response?.data?.message || fallback;

export default api;
