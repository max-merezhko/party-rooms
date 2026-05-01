import { io } from 'socket.io-client'
import { API_ORIGIN } from './api'

let socket = null
let lastToken = null

export function getSocket() {
  return socket
}

/** Connects or returns existing socket; reconnects if token changed. */
export function connectSocket() {
  const token = localStorage.getItem('party_access_token')
  if (!token) return null

  if (socket?.connected && lastToken === token) {
    return socket
  }

  lastToken = token
  socket?.disconnect()
  socket = io(API_ORIGIN, {
    auth: { token },
    transports: ['websocket', 'polling'],
  })
  return socket
}

export function disconnectSocket() {
  lastToken = null
  socket?.disconnect()
  socket = null
}
