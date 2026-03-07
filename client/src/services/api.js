import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' }, withCredentials: true });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('nf_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
}, err => Promise.reject(err));

api.interceptors.response.use(res => res, err => {
  if (err.response?.status === 401) {
    // Don't redirect when on login/register — prevents 404 flash on wrong password
    const onAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';
    if (!onAuthPage) {
      localStorage.removeItem('nf_token');
      localStorage.removeItem('nf_user');
      window.location.href = '/login';
    }
  }
  return Promise.reject(err);
});

export const authAPI = {
  register: (d) => api.post('/auth/register', d),
  login: (d) => api.post('/auth/login', d),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  updateProfile: (d) => api.put('/auth/profile', d),
  changePassword: (d) => api.put('/auth/change-password', d),
  deleteAccount: (d) => api.delete('/auth/account', { data: d }),
};

export const userAPI = {
  search: (q) => api.get(`/users/search?username=${encodeURIComponent(q)}`),
  getById: (id) => api.get(`/users/${id}`),
  block: (userId) => api.post(`/users/block/${userId}`),
  checkBlocked: (userId) => api.get(`/users/blocked/${userId}`),
  saveContact: (d) => api.post('/users/contacts', d),
  getContacts: () => api.get('/users/contacts'),
  pinChat: (chatId) => api.post('/users/pin-chat', { chatId }),
  muteChat: (chatId, duration) => api.post('/users/mute-chat', { chatId, duration }),
  deleteChat: (chatId) => api.post('/users/delete-chat', { chatId }),
  lockChat: (chatId, pin) => api.post('/users/lock-chat', { chatId, pin }),
  verifyPin: (pin) => api.post('/users/verify-pin', { pin }),
  updatePrivacy: (d) => api.put('/users/privacy', d),
  toggleOnline: () => api.post('/users/toggle-online'),
  getSessions: () => api.get('/users/sessions'),
  revokeSession: (sessionId) => api.delete(`/users/sessions/${sessionId}`),
  revokeAllSessions: () => api.delete('/users/sessions'),
};

export const convAPI = {
  create: (receiverId) => api.post('/conversations', { receiverId }),
  getAll: () => api.get('/conversations'),
  getMessages: (id, page=1) => api.get(`/messages/${id}?page=${page}&limit=50`),
  sendMessage: (d) => api.post('/messages', d),
  markSeen: (id) => api.put(`/messages/seen/${id}`),
  deleteMessage: (id, forEveryone=false) => api.delete(`/messages/${id}`, { data: { forEveryone } }),
  editMessage: (id, messageText) => api.put(`/messages/${id}/edit`, { messageText }),
  reactToMessage: (id, emoji) => api.put(`/messages/${id}/react`, { emoji }),
  starMessage: (id) => api.put(`/messages/${id}/star`),
  getStarred: () => api.get('/messages/starred'),
  searchMessages: (q, conversationId) => api.get(`/messages/search?q=${encodeURIComponent(q)}&conversationId=${conversationId}`),
  clearHistory: (conversationId) => api.post('/messages/clear', { conversationId }),
};

export const groupAPI = {
  create: (d) => api.post('/groups', d),
  getAll: () => api.get('/groups'),
  update: (id, d) => api.put(`/groups/${id}`, d),
  delete: (id) => api.delete(`/groups/${id}`),
  leave: (id) => api.post(`/groups/${id}/leave`),
  addMember: (id, userId) => api.post(`/groups/${id}/members`, { userId }),
  removeMember: (id, userId) => api.delete(`/groups/${id}/members/${userId}`),
  makeAdmin: (id, userId) => api.post(`/groups/${id}/make-admin`, { userId }),
  removeAdmin: (id, userId) => api.delete(`/groups/${id}/admin/${userId}`),
  getMessages: (id, page=1) => api.get(`/messages/group/${id}?page=${page}&limit=50`),
  searchMessages: (q, groupId) => api.get(`/messages/search?q=${encodeURIComponent(q)}&groupId=${groupId}`),
  clearHistory: (groupId) => api.post('/messages/clear', { groupId }),
  generateInviteLink: (id) => api.post(`/groups/${id}/invite-link`),
  joinViaLink: (link) => api.get(`/groups/join/${link}`),
  approveRequest: (id, userId, approve) => api.post(`/groups/${id}/approve`, { userId, approve }),
};

export const statusAPI = {
  create: (d) => api.post('/statuses', d),
  getAll: () => api.get('/statuses'),
  view: (id) => api.put(`/statuses/${id}/view`),
  delete: (id) => api.delete(`/statuses/${id}`),
};

export default api;
