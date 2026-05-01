import { api } from './api'

const TOKEN_KEY = 'party_access_token'
const USER_KEY = 'party_user'

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setSession(session, user) {
  if (session?.access_token) {
    localStorage.setItem(TOKEN_KEY, session.access_token)
  }
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function signup(email, password) {
  const { data } = await api.post('/auth/signup', { email, password })
  return data
}

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password })
  if (data.session && data.user) {
    setSession(data.session, data.user)
  }
  return data
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me')
  return data.user
}

export function logout() {
  clearSession()
}
