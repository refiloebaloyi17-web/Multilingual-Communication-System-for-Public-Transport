import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000'; // Change to your backend URL

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authAPI = {
  register: (userData) => api.post('/register', userData),
  login: (credentials) => api.post('/login', credentials),
};

export const translationAPI = {
  getLanguages: () => api.get('/languages'),
  translate: (text, sourceLang, targetLang) => 
    api.post('/translate', { text, source_lang: sourceLang, target_lang: targetLang }),
  sendMessage: (messageData) => api.post('/messages', messageData),
  getUserMessages: (userId) => api.get(`/users/${userId}/messages`),
  updateLanguagePreference: (userId, languagePref) => 
    api.put(`/users/${userId}/language?language_pref=${languagePref}`),
};

export default api;