import axios from 'axios'

const raw = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3000'
export const API_ORIGIN = String(raw).replace(/\/$/, '')

export const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('party_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('party_access_token')
      localStorage.removeItem('party_user')
    }
    return Promise.reject(err)
  },
)
