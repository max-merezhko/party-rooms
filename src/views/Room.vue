<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Navbar from '@/components/Navbar.vue'
import VideoPlayer from '@/components/VideoPlayer.vue'
import Queue from '@/components/Queue.vue'
import Chat from '@/components/Chat.vue'
import SearchBar from '@/components/SearchBar.vue'
import { api } from '@/services/api'
import { getStoredUser } from '@/services/auth'
import { connectSocket, disconnectSocket, getSocket } from '@/services/socket'

const route = useRoute()
const router = useRouter()

const roomId = computed(() => route.params.id)

/** Plaintext password only exists here after creating a private room on this browser (sessionStorage). */
const invitePasswordStored = computed(() => {
  try {
    const raw = sessionStorage.getItem(`party_room_share_${roomId.value}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed.password === 'string' ? parsed.password : null
  } catch {
    return null
  }
})

const queueItems = ref([])
const messages = ref([])
const loadError = ref('')
const joinNeedsPassword = ref(false)
const joinPassword = ref('')
const joinBusy = ref(false)
const joined = ref(false)

const currentYoutubeId = ref(null)
const remotePlayback = ref(null)
const voteBusy = ref(null)

const roomMeta = ref(null)
const inviteOpen = ref(false)
const copyHint = ref('')
const members = ref([])
const membersLoading = ref(false)

const myUserId = computed(() => getStoredUser()?.id ?? null)

let socketHandlersBound = false
let realtimeStarted = false

async function fetchQueue() {
  try {
    const { data } = await api.get(`/rooms/${roomId.value}/queue`)
    queueItems.value = data.items || []
  } catch (e) {
    loadError.value = e.response?.data?.error || e.message || 'Failed to load queue'
  }
}

async function fetchRoomMeta() {
  try {
    const { data } = await api.get(`/rooms/${roomId.value}`)
    roomMeta.value = data.room
  } catch {
    roomMeta.value = null
  }
}

async function fetchMembers() {
  membersLoading.value = true
  try {
    const { data } = await api.get(`/rooms/${roomId.value}/members`)
    members.value = data.members || []
  } catch {
    members.value = []
  } finally {
    membersLoading.value = false
  }
}

function memberLabel(m) {
  if (m.email) return m.email
  const id = m.user_id || ''
  return id ? `Guest (${id.slice(0, 8)}…)` : 'Guest'
}

async function copyText(label, text) {
  copyHint.value = ''
  try {
    await navigator.clipboard.writeText(text)
    copyHint.value = `${label} copied`
    setTimeout(() => {
      copyHint.value = ''
    }, 2200)
  } catch {
    copyHint.value = 'Copy failed — select and copy manually'
  }
}

async function joinRoom(body = {}) {
  joinBusy.value = true
  loadError.value = ''
  try {
    await api.post(`/rooms/${roomId.value}/join`, body)
    joinNeedsPassword.value = false
    joined.value = true
    await fetchQueue()
    await fetchRoomMeta()
    await fetchMembers()
  } catch (e) {
    joined.value = false
    const msg = e.response?.data?.error || ''
    if (
      e.response?.status === 400 &&
      typeof msg === 'string' &&
      msg.toLowerCase().includes('password')
    ) {
      joinNeedsPassword.value = true
    } else {
      loadError.value = msg || e.message || 'Could not join room'
    }
  } finally {
    joinBusy.value = false
  }
}

function setupRealtime() {
  if (realtimeStarted) return
  realtimeStarted = true
  connectSocket()
  bindSocket()
}

function bindSocket() {
  const s = getSocket()
  if (!s || socketHandlersBound) {
    console.log('[party-player] bindSocket skipped', { hasSocket: !!s, socketHandlersBound })
    return
  }
  socketHandlersBound = true

  s.on('chat:message', (msg) => {
    if (msg.roomId === roomId.value) messages.value.push(msg)
  })

  s.on('player:sync', (payload) => {
    console.log('[party-player] socket player:sync (others)', payload)
    if (payload.roomId !== roomId.value) return
    remotePlayback.value = { ...payload, ts: payload.ts || Date.now() }
    if (payload.videoId) currentYoutubeId.value = payload.videoId
  })

  s.on('queue:refresh', (payload) => {
    if (payload.roomId === roomId.value) fetchQueue()
  })

  s.on('members:refresh', (payload) => {
    if (payload.roomId === roomId.value) fetchMembers()
  })

  s.emit(
    'room:join',
    { roomId: roomId.value },
    (ack) => {
      console.log('[party-player] room:join ack', ack)
      if (ack?.playback?.videoId) {
        currentYoutubeId.value = ack.playback.videoId
        remotePlayback.value = { ...ack.playback, ts: Date.now() }
      }
    },
  )
}

function unbindSocket() {
  const s = getSocket()
  if (s) {
    s.emit('room:leave', { roomId: roomId.value })
    s.off('chat:message')
    s.off('player:sync')
    s.off('queue:refresh')
    s.off('members:refresh')
  }
  socketHandlersBound = false
  realtimeStarted = false
}

onMounted(async () => {
  await joinRoom({})
  if (joined.value) {
    setupRealtime()
  }
})

async function submitJoinPassword() {
  await joinRoom({ password: joinPassword.value })
  joinPassword.value = ''
  if (joined.value) {
    setupRealtime()
  }
}

onUnmounted(() => {
  unbindSocket()
  disconnectSocket()
})

async function leaveRoom() {
  try {
    await api.delete(`/rooms/${roomId.value}/leave`)
  } catch {
    /* ignore */
  }
  router.push({ name: 'rooms' })
}

function notifyQueueRefresh() {
  const s = getSocket()
  s?.emit('queue:refresh', { roomId: roomId.value })
}

async function onPickSong(item) {
  console.log('[party-player] onPickSong', item)
  if (!item?.videoId) return
  try {
    await api.post(`/rooms/${roomId.value}/queue`, {
      youtube_video_id: item.videoId,
      title: item.title || 'Untitled',
      thumbnail: item.thumbnail,
    })
    await fetchQueue()
    notifyQueueRefresh()
    if (!currentYoutubeId.value) currentYoutubeId.value = item.videoId
    console.log('[party-player] onPickSong done', {
      currentYoutubeId: currentYoutubeId.value,
      queueLen: queueItems.value.length,
    })
  } catch (e) {
    alert(e.response?.data?.error || e.message || 'Could not add song')
  }
}

async function onVote({ id, direction }) {
  voteBusy.value = id
  try {
    await api.post(`/queue/${id}/vote`, { direction })
    await fetchQueue()
    notifyQueueRefresh()
  } catch (e) {
    alert(e.response?.data?.error || e.message || 'Vote failed')
  } finally {
    voteBusy.value = null
  }
}

async function onRemove(id) {
  try {
    await api.delete(`/queue/${id}`)
    await fetchQueue()
    notifyQueueRefresh()
  } catch (e) {
    alert(e.response?.data?.error || e.message || 'Remove failed')
  }
}

async function onLike(id) {
  try {
    await api.post(`/queue/${id}/like`)
  } catch (e) {
    alert(e.response?.data?.error || e.message || 'Like failed')
  }
}

function onPlayRow(row) {
  console.log('[party-player] onPlayRow', row)
  if (!row?.youtube_video_id) {
    console.warn('[party-player] onPlayRow missing youtube_video_id', row)
  }
  applyLocalPlayback({
    videoId: row.youtube_video_id,
    isPlaying: true,
    currentTime: 0,
  })
  emitPlayback({ videoId: row.youtube_video_id, isPlaying: true, currentTime: 0 })
}

function onEnded() {
  const items = [...queueItems.value].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
  const idx = items.findIndex((i) => i.youtube_video_id === currentYoutubeId.value)
  const next = items[idx + 1]
  if (next) {
    applyLocalPlayback({
      videoId: next.youtube_video_id,
      isPlaying: true,
      currentTime: 0,
    })
    emitPlayback({
      videoId: next.youtube_video_id,
      isPlaying: true,
      currentTime: 0,
    })
  }
}

function emitPlayback(extra) {
  const s = getSocket()
  const payload = {
    roomId: roomId.value,
    videoId: extra.videoId ?? currentYoutubeId.value,
    isPlaying: extra.isPlaying ?? true,
    currentTime: typeof extra.currentTime === 'number' ? extra.currentTime : 0,
  }
  console.log('[party-player] emitPlayback', {
    payload,
    socketConnected: !!s?.connected,
    socketId: s?.id,
  })
  s?.emit('player:sync', payload)
}

/** Socket uses `to(room)` so the sender never gets `player:sync`; apply the same intent locally so the iframe plays/pauses. */
function applyLocalPlayback(extra) {
  const videoId = extra.videoId ?? currentYoutubeId.value
  if (videoId) currentYoutubeId.value = videoId
  remotePlayback.value = {
    roomId: roomId.value,
    videoId,
    isPlaying: extra.isPlaying ?? true,
    currentTime: typeof extra.currentTime === 'number' ? extra.currentTime : 0,
    ts: Date.now(),
  }
  console.log('[party-player] applyLocalPlayback', remotePlayback.value)
}

function onLocalSync(payload) {
  const s = getSocket()
  s?.emit('player:sync', {
    roomId: roomId.value,
    videoId: payload.videoId,
    isPlaying: payload.isPlaying,
    currentTime: payload.currentTime,
  })
}

function sendChat(text) {
  const s = getSocket()
  s?.emit('chat:message', { roomId: roomId.value, text })
}
</script>

<template>
  <div class="layout">
    <Navbar />
    <main v-if="joinNeedsPassword" class="main narrow">
      <h1>Private room</h1>
      <p>This room requires a password.</p>
      <form class="join-form" @submit.prevent="submitJoinPassword">
        <input
          v-model="joinPassword"
          type="password"
          placeholder="Password"
          required
        />
        <button type="submit" class="btn-primary" :disabled="joinBusy">Join</button>
      </form>
      <p v-if="loadError" class="error">{{ loadError }}</p>
    </main>

    <main v-else-if="loadError && !queueItems.length" class="main narrow">
      <p class="error">{{ loadError }}</p>
      <button type="button" class="btn-secondary" @click="router.push({ name: 'rooms' })">
        Back to rooms
      </button>
    </main>

    <main v-else class="main grid">
      <section class="primary">
        <div class="top">
          <h1>{{ roomMeta?.name || 'Room' }}</h1>
          <div class="actions">
            <button
              v-if="roomMeta && roomMeta.is_public === false"
              type="button"
              class="btn-info"
              title="Room ID and password (only you can see the saved password on this device)"
              @click="inviteOpen = true"
            >
              Invite info
            </button>
            <button type="button" class="btn-secondary" @click="leaveRoom">Leave</button>
          </div>
        </div>
        <p v-if="loadError" class="error">{{ loadError }}</p>

        <VideoPlayer
          :video-id="currentYoutubeId"
          :remote="remotePlayback"
          @ended="onEnded"
          @sync="onLocalSync"
        />

        <Queue
          :items="queueItems"
          :busy-id="voteBusy"
          @vote="onVote"
          @remove="onRemove"
          @play="onPlayRow"
          @like="onLike"
        />

        <SearchBar @pick="onPickSong" />
      </section>

      <aside class="side">
        <section class="members-panel">
          <h3 class="members-title">People here</h3>
          <p v-if="membersLoading" class="members-empty">Loading members…</p>
          <p v-else-if="!members.length" class="members-empty">No members loaded.</p>
          <ul v-else class="members-list">
            <li v-for="m in members" :key="m.user_id" class="member-row">
              <span class="member-name">{{ memberLabel(m) }}</span>
              <span v-if="m.user_id === myUserId" class="you-pill">you</span>
            </li>
          </ul>
        </section>
        <Chat :messages="messages" @send="sendChat" />
      </aside>
    </main>

    <div
      v-if="inviteOpen && roomMeta && !roomMeta.is_public"
      class="modal-backdrop"
      @click.self="inviteOpen = false"
    >
      <div class="modal" role="dialog" aria-labelledby="invite-title">
        <h2 id="invite-title">Invite friends</h2>
        <p class="modal-lead">
          Share the room ID and password so others can use “Join private room” on the home page.
        </p>

        <div class="copy-row">
          <label>Room ID</label>
          <div class="copy-line">
            <code>{{ roomId }}</code>
            <button type="button" class="btn-small" @click="copyText('Room ID', roomId)">
              Copy
            </button>
          </div>
        </div>

        <div class="copy-row">
          <label>Password</label>
          <template v-if="invitePasswordStored">
            <div class="copy-line">
              <code>{{ invitePasswordStored }}</code>
              <button
                type="button"
                class="btn-small"
                @click="copyText('Password', invitePasswordStored)"
              >
                Copy
              </button>
            </div>
          </template>
          <p v-else class="muted">
            The password isn’t stored on the server (only a hash). If you didn’t create this room
            on this browser, ask the host for the password. Creators see it here right after
            creating the room (saved locally in this browser only).
          </p>
        </div>

        <p v-if="copyHint" class="copy-hint">{{ copyHint }}</p>

        <button type="button" class="btn-primary modal-close" @click="inviteOpen = false">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main {
  padding: 1rem;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
}

.narrow {
  max-width: 420px;
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 1rem;
  align-items: start;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.top h1 {
  margin: 0;
  font-size: 1.2rem;
}

.btn-info {
  border: 1px solid #4a6fa8;
  background: #1e2f4a;
  color: #b8d4ff;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
}

.btn-info:hover {
  border-color: #6b94d4;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal {
  width: 100%;
  max-width: 460px;
  background: #161b26;
  border: 1px solid #2a3448;
  border-radius: 12px;
  padding: 1.25rem;
}

.modal h2 {
  margin: 0 0 0.5rem;
  font-size: 1.15rem;
}

.modal-lead {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  color: #b8c0d4;
}

.copy-row {
  margin-bottom: 1rem;
}

.copy-row label {
  display: block;
  font-size: 0.8rem;
  color: #9aa5bc;
  margin-bottom: 0.35rem;
}

.copy-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.copy-line code {
  flex: 1;
  min-width: 0;
  padding: 0.45rem 0.55rem;
  background: #0f1117;
  border: 1px solid #333c52;
  border-radius: 8px;
  font-size: 0.82rem;
  word-break: break-all;
}

.btn-small {
  border: 1px solid #3d4a63;
  background: #1c2433;
  color: #e8eaef;
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  font-size: 0.85rem;
  white-space: nowrap;
}

.muted {
  margin: 0;
  font-size: 0.85rem;
  color: #9aa5bc;
  line-height: 1.45;
}

.copy-hint {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: #8fd49a;
}

.modal-close {
  width: 100%;
}

.primary {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.side {
  position: sticky;
  top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.members-panel {
  padding: 0.65rem 0.75rem;
  background: #141922;
  border: 1px solid #242d3f;
  border-radius: 10px;
}

.members-title {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}

.members-empty {
  margin: 0;
  font-size: 0.82rem;
  color: #9aa5bc;
}

.members-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 180px;
  overflow: auto;
}

.member-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.82rem;
}

.member-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #e8eaef;
}

.you-pill {
  flex-shrink: 0;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.12rem 0.35rem;
  border-radius: 4px;
  background: #2a3347;
  color: #9ec5ff;
}

.btn-primary {
  border: none;
  border-radius: 8px;
  padding: 0.45rem 0.9rem;
  background: linear-gradient(180deg, #4f8cff, #3b6fd9);
  color: #fff;
}

.btn-secondary {
  border: 1px solid #3d4a63;
  background: #1c2433;
  color: #e8eaef;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.join-form input {
  padding: 0.5rem 0.6rem;
  border-radius: 8px;
  border: 1px solid #333c52;
  background: #0f1117;
  color: #e8eaef;
}

.error {
  color: #ff8b8b;
}
</style>
