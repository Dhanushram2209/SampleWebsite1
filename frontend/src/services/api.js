import axios from 'axios';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

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

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Auto logout if 401 response returned from api
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// Auth API
export const register = async (userData) => {
  try {
    const response = await api.post('/register', userData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const login = async (credentials) => {
  try {
    const response = await api.post('/login', credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
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
      role: payload.role,
      firstName: payload.firstName,
      lastName: payload.lastName
    };
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

// Patient API
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

export const getVitals = async () => {
  try {
    const response = await api.get('/patient/vitals');
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

export const markMedicationTaken = async (medicationId) => {
  try {
    const response = await api.post(`/patient/medications/${medicationId}/taken`);
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

export const markAlertAsRead = async (alertId) => {
  try {
    const response = await api.post(`/patient/alerts/${alertId}/read`);
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

export const createAppointment = async (appointmentData) => {
  try {
    const response = await api.post('/patient/appointments', appointmentData);
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

export const getProfile = async () => {
  try {
    const response = await api.get('/profile');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Doctor API
export const getDoctors = async () => {
  try {
    const response = await api.get('/doctors');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getDoctorPatients = async () => {
  try {
    const response = await api.get('/doctor/patients');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getDoctorPatientDetails = async (patientId) => {
  try {
    const response = await api.get(`/doctor/patient/${patientId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getDoctorAppointments = async () => {
  try {
    const response = await api.get('/doctor/appointments');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getDoctorAlerts = async () => {
  try {
    const response = await api.get('/doctor/alerts');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const prescribeMedication = async (prescriptionData) => {
  try {
    const response = await api.post('/doctor/prescribe-medication', prescriptionData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Telemedicine API
export const requestTelemedicine = async (requestData) => {
  try {
    const response = await api.post('/telemedicine/request', requestData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getVideoToken = async (identity, room) => {
  try {
    const response = await api.post('/video/token', { identity, room });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const startVideoCall = async (appointmentId) => {
  try {
    const response = await api.post(`/appointments/${appointmentId}/start-call`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// AI API
export const getAIPredictions = async () => {
  try {
    const response = await api.get('/patient/ai-predictions');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getAIRecommendations = async () => {
  try {
    const response = await api.get('/patient/ai-recommendations');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getAIAssistantResponse = async (message) => {
  try {
    const response = await api.post('/patient/ai-assistant', { message });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export default api;