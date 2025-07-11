import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const register = async (userData) => {
  return await api.post('/register', userData);
};

export const login = async (credentials) => {
  const response = await api.post('/login', credentials);
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
  }
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    };
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

// Patient-specific API calls
export const getHealthData = async () => {
  try {
    const response = await api.get('/patient/health-data');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const addHealthData = async (data) => {
  try {
    const response = await api.post('/patient/health-data', data);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getRiskScore = async () => {
  try {
    const response = await api.get('/patient/risk-score');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getMedications = async () => {
  try {
    const response = await api.get('/patient/medications');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getAlerts = async () => {
  try {
    const response = await api.get('/patient/alerts');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getAppointments = async () => {
  try {
    const response = await api.get('/patient/appointments');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getPoints = async () => {
  try {
    const response = await api.get('/patient/points');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getDoctors = async () => {
  try {
    const response = await api.get('/doctors');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const requestTelemedicine = async (data) => {
  try {
    const response = await api.post('/telemedicine/request', data);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getVitals = async () => {
  try {
    const response = await api.get('/patient/vitals');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Add these to your existing api.js
export const getDoctorPatients = async () => {
  try {
    const response = await api.get('/doctor/patients');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getDoctorAppointments = async (params = {}) => {
  try {
    const response = await api.get('/doctor/appointments', { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getDoctorAlerts = async (params = {}) => {
  try {
    const response = await api.get('/doctor/alerts', { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const markAlertAsRead = async (alertId) => {
  try {
    const response = await api.post(`/doctor/alerts/${alertId}/read`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export default api;