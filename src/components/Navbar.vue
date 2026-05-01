<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { getStoredUser, logout } from '@/services/auth'

const router = useRouter()
const user = computed(() => getStoredUser())

function onLogout() {
  logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="nav">
    <router-link class="brand" to="/rooms">Party Rooms</router-link>
    <nav class="links">
      <router-link v-if="user" to="/rooms">Rooms</router-link>
      <router-link v-if="user" to="/leaderboard">Leaderboard</router-link>
      <router-link v-if="!user" to="/login">Sign in</router-link>
      <span v-if="user?.email" class="email">{{ user.email }}</span>
      <button v-if="user" type="button" class="btn-ghost" @click="onLogout">Log out</button>
    </nav>
  </header>
</template>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: #161b26;
  border-bottom: 1px solid #252d3d;
}

.brand {
  font-weight: 700;
  color: #f0f3f9;
}

.links {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.email {
  font-size: 0.85rem;
  color: #9aa5bc;
}

.btn-ghost {
  background: transparent;
  border: 1px solid #3d4a63;
  color: #e8eaef;
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
}

.btn-ghost:hover {
  border-color: #5c6d8e;
}
</style>
