<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Navbar from '@/components/Navbar.vue'
import CreateRoom from '@/components/CreateRoom.vue'
import { api } from '@/services/api'
import { getStoredUser } from '@/services/auth'

const router = useRouter()
const route = useRoute()
const publicRooms = ref([])
const joinedRooms = ref([])
const loadError = ref('')
const createOpen = ref(false)
const busy = ref(false)

const joinRoomId = ref('')
const joinPassword = ref('')
const joinError = ref('')

/** Public rooms you are not already a member of (avoid duplicates). */
const discoverRooms = computed(() => {
  const memberIds = new Set(joinedRooms.value.map((r) => r.id))
  return publicRooms.value.filter((r) => !memberIds.has(r.id))
})

async function loadRooms() {
  loadError.value = ''
  try {
    const { data } = await api.get('/rooms')
    publicRooms.value = data.rooms || []
  } catch (e) {
    loadError.value = e.response?.data?.error || e.message || 'Failed to load rooms'
  }
  try {
    const { data } = await api.get('/rooms/memberships')
    joinedRooms.value = data.rooms || []
  } catch (e) {
    joinedRooms.value = []
    if (import.meta.env.DEV && e.response?.data?.error) {
      console.warn('[rooms/memberships]', e.response.status, e.response.data.error)
    }
  }
}

onMounted(loadRooms)

watch(
  () => route.name,
  (name) => {
    if (name === 'rooms') loadRooms()
  },
)

function currentUserId() {
  return getStoredUser()?.id ?? null
}

function isCreator(room) {
  const uid = currentUserId()
  return !!(uid && room.created_by && room.created_by === uid)
}

async function leaveMembership(room) {
  if (
    !confirm(
      `Leave “${room.name}”? It disappears from your list; you can join again with the room ID if needed.`,
    )
  ) {
    return
  }
  busy.value = true
  try {
    await api.delete(`/rooms/${room.id}/leave`)
    sessionStorage.removeItem(`party_room_share_${room.id}`)
    await loadRooms()
  } catch (e) {
    alert(e.response?.data?.error || e.message || 'Could not leave room')
  } finally {
    busy.value = false
  }
}

async function deleteRoomForever(room) {
  if (
    !confirm(
      `Delete "${room.name}" permanently? This removes the room for all members and cannot be undone.`,
    )
  ) {
    return
  }
  busy.value = true
  try {
    await api.delete(`/rooms/${room.id}`)
    sessionStorage.removeItem(`party_room_share_${room.id}`)
    await loadRooms()
  } catch (e) {
    alert(e.response?.data?.error || e.message || 'Could not delete room')
  } finally {
    busy.value = false
  }
}

async function openRoom(room) {
  joinError.value = ''
  busy.value = true
  try {
    await api.post(`/rooms/${room.id}/join`, {})
    router.push({ name: 'room', params: { id: room.id } })
  } catch (e) {
    joinError.value = e.response?.data?.error || e.message || 'Could not join room'
  } finally {
    busy.value = false
  }
}

async function joinPrivate() {
  joinError.value = ''
  const id = joinRoomId.value.trim()
  if (!id) {
    joinError.value = 'Enter a room ID'
    return
  }
  busy.value = true
  try {
    await api.post(`/rooms/${id}/join`, {
      password: joinPassword.value || undefined,
    })
    await loadRooms()
    router.push({ name: 'room', params: { id } })
  } catch (e) {
    joinError.value = e.response?.data?.error || e.message || 'Could not join room'
  } finally {
    busy.value = false
  }
}

async function onCreatePayload(payload) {
  busy.value = true
  try {
    const { data } = await api.post('/rooms', payload)
    createOpen.value = false
    const joinBody =
      payload.is_public === false && payload.password
        ? { password: payload.password }
        : {}
    await api.post(`/rooms/${data.room.id}/join`, joinBody)
    if (payload.is_public === false && payload.password) {
      sessionStorage.setItem(
        `party_room_share_${data.room.id}`,
        JSON.stringify({ password: payload.password }),
      )
    }
    await loadRooms()
    router.push({ name: 'room', params: { id: data.room.id } })
  } catch (e) {
    alert(e.response?.data?.error || e.message || 'Create failed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="layout">
    <Navbar />
    <main class="main">
      <div class="toolbar">
        <h1>Rooms</h1>
        <button type="button" class="btn-primary" @click="createOpen = true">New room</button>
      </div>

      <p v-if="loadError" class="error">{{ loadError }}</p>

      <section class="block">
        <h2 class="section-title">Your rooms</h2>
        <p class="section-hint">
          Private and public rooms you’ve joined — open without typing the ID again.
        </p>
        <ul class="room-list">
          <li v-for="r in joinedRooms" :key="'j-' + r.id" class="room-card">
            <div class="room-main">
              <div class="room-name">{{ r.name }}</div>
              <div class="room-meta">
                {{ r.is_public ? 'Public' : 'Private' }}
                <span v-if="isCreator(r)" class="badge badge-host">Host</span>
                <span v-else-if="!r.is_public" class="badge">member</span>
              </div>
            </div>
            <div class="card-actions">
              <button type="button" class="btn-secondary" :disabled="busy" @click="openRoom(r)">
                Enter
              </button>
              <button
                type="button"
                class="btn-muted"
                :disabled="busy"
                title="Remove from your list (you can rejoin later)"
                @click="leaveMembership(r)"
              >
                Leave
              </button>
              <button
                v-if="isCreator(r)"
                type="button"
                class="btn-danger"
                :disabled="busy"
                title="Delete room for everyone"
                @click="deleteRoomForever(r)"
              >
                Delete
              </button>
            </div>
          </li>
          <li v-if="!joinedRooms.length" class="empty">
            None yet — create a room or join one below.
          </li>
        </ul>
      </section>

      <section class="block">
        <h2 class="section-title">Public rooms</h2>
        <p class="section-hint">Discover rooms you’re not in yet.</p>
        <ul class="room-list">
          <li v-for="r in discoverRooms" :key="'p-' + r.id" class="room-card">
            <div>
              <div class="room-name">{{ r.name }}</div>
              <div class="room-meta">Public</div>
            </div>
            <button type="button" class="btn-secondary" :disabled="busy" @click="openRoom(r)">
              Enter
            </button>
          </li>
          <li v-if="!discoverRooms.length && !loadError" class="empty">
            No other public rooms right now. Create one!
          </li>
        </ul>
      </section>

      <section class="private-join">
        <h2>Join private room</h2>
        <p class="hint">Paste the room UUID and password from the host.</p>
        <div class="row">
          <input v-model="joinRoomId" placeholder="Room ID" class="grow" />
          <input
            v-model="joinPassword"
            type="password"
            placeholder="Password"
            class="grow"
          />
          <button type="button" class="btn-secondary" :disabled="busy" @click="joinPrivate">
            Join
          </button>
        </div>
        <p v-if="joinError" class="error">{{ joinError }}</p>
      </section>
    </main>

    <CreateRoom :open="createOpen" @close="createOpen = false" @created="onCreatePayload" />
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main {
  max-width: 720px;
  margin: 0 auto;
  padding: 1.25rem;
  width: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.block {
  margin-bottom: 1.75rem;
}

.section-title {
  margin: 0 0 0.35rem;
  font-size: 1.1rem;
}

.section-hint {
  margin: 0 0 0.65rem;
  font-size: 0.88rem;
  color: #9aa5bc;
}

.badge {
  margin-left: 0.35rem;
  font-size: 0.72rem;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: #2a3142;
  color: #c5cde0;
}

.badge-host {
  background: #2d3d28;
  color: #b8e7a8;
}

.btn-muted {
  background: transparent;
  border: 1px solid #3d4a63;
  color: #b8c0d4;
  padding: 0.4rem 0.65rem;
  border-radius: 8px;
  font-size: 0.85rem;
}

.btn-muted:hover:not(:disabled) {
  border-color: #5c6d8e;
  color: #e8eaef;
}

.btn-danger {
  background: #3a2228;
  border: 1px solid #6b3e48;
  color: #ffb4b4;
  padding: 0.4rem 0.65rem;
  border-radius: 8px;
  font-size: 0.85rem;
}

.btn-danger:hover:not(:disabled) {
  border-color: #a05060;
}

h1 {
  margin: 0;
  font-size: 1.35rem;
}

.btn-primary {
  border: none;
  border-radius: 8px;
  padding: 0.45rem 0.9rem;
  background: linear-gradient(180deg, #4f8cff, #3b6fd9);
  color: #fff;
}

.room-list {
  list-style: none;
  padding: 0;
  margin: 0 0 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.room-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem;
  background: #161b26;
  border: 1px solid #252d3d;
  border-radius: 10px;
  flex-wrap: wrap;
}

.room-main {
  flex: 1;
  min-width: 0;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.room-name {
  font-weight: 600;
}

.room-meta {
  font-size: 0.85rem;
  color: #9aa5bc;
}

.btn-secondary {
  background: #222a3a;
  border: 1px solid #3d4a63;
  color: #e8eaef;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
}

.empty {
  padding: 1rem;
  color: #9aa5bc;
}

.private-join {
  padding-top: 0.5rem;
  border-top: 1px solid #252d3d;
}

.private-join h2 {
  font-size: 1.05rem;
  margin: 0 0 0.35rem;
}

.hint {
  margin: 0 0 0.65rem;
  color: #9aa5bc;
  font-size: 0.9rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.grow {
  flex: 1;
  min-width: 140px;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  border: 1px solid #333c52;
  background: #0f1117;
  color: #e8eaef;
}

.error {
  color: #ff8b8b;
  margin: 0.5rem 0 0;
}
</style>
