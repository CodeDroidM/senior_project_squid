import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const validateUser = async (username, password) => {
  const response = await api.post('/validate-user', { username, password });
  return response.data;
};

export const connectToAccp = async (accp_id, client_host = '127.0.0.1') => {
  const response = await api.post('/connect', { accp_id, client_host });
  return response.data;
};

export const connectToAgent = async (credentials) => {
  const validationResult = await validateUser(credentials.username, credentials.password);
  
  const accpId = credentials.accp_id || validationResult.available_accps[0]?.accp_id;
  if (!accpId) {
    throw new Error('No ACCP available or specified');
  }
  
  const connectionResult = await connectToAccp(accpId, credentials.host_ip || '127.0.0.1');
  
  return {
    ...connectionResult,
    available_accps: validationResult.available_accps,
    token: validationResult.token
  };
};

export const getAccessibleObjects = async () => {
  const response = await api.get('/access');
  return response.data;
};

export const executeQuery = async (sql) => {
  const response = await api.post('/query', { sql });
  return response.data;
};

export const disconnectFromAgent = async () => {
  const response = await api.post('/disconnect');
  return response.data;
};

export const switchAccp = async (accp_id, client_host = '127.0.0.1') => {
  const response = await api.post('/switch-accp', { accp_id, client_host });
  return response.data;
};

export const getSessionInfo = async () => {
  const response = await api.get('/session-info');
  return response.data;
};

export default api;

