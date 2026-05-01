<script setup>
import { ref } from 'vue'
import { api } from '@/services/api'

const emit = defineEmits(['pick'])

const q = ref('')
const results = ref([])
const loading = ref(false)
const errorMsg = ref('')

async function search() {
  const query = q.value.trim()
  if (!query) return
  loading.value = true
  errorMsg.value = ''
  results.value = []
  try {
    const { data } = await api.get('/youtube/search', { params: { q: query } })
    results.value = data.items || []
  } catch (e) {
    errorMsg.value = e.response?.data?.error || e.message || 'Search failed'
  } finally {
    loading.value = false
  }
}

function pick(item) {
  emit('pick', item)
}
</script>

<template>
  <div class="search">
    <form class="row" @submit.prevent="search">
      <input
        v-model="q"
        type="search"
        placeholder="Search YouTube for music…"
        class="input"
      />
      <button type="submit" class="btn" :disabled="loading">
        {{ loading ? '…' : 'Search' }}
      </button>
    </form>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    <ul v-if="results.length" class="results">
      <li v-for="item in results" :key="item.videoId" class="item">
        <img v-if="item.thumbnail" :src="item.thumbnail" alt="" class="thumb" />
        <div class="meta">
          <div class="title">{{ item.title }}</div>
          <div class="sub">{{ item.channelTitle }}</div>
        </div>
        <button type="button" class="btn-small" @click="pick(item)">Add</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.row {
  display: flex;
  gap: 0.5rem;
}

.input {
  flex: 1;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  border: 1px solid #333c52;
  background: #0f1117;
  color: #e8eaef;
}

.btn {
  border: none;
  border-radius: 8px;
  padding: 0.45rem 0.75rem;
  background: #2a3347;
  color: #e8eaef;
}

.btn:disabled {
  opacity: 0.6;
}

.error {
  color: #ff8b8b;
  margin: 0;
  font-size: 0.9rem;
}

.results {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 240px;
  overflow: auto;
}

.item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.4rem;
  background: #141922;
  border-radius: 8px;
  border: 1px solid #242d3f;
}

.thumb {
  width: 72px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
}

.meta {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 0.85rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub {
  font-size: 0.75rem;
  color: #8b96ae;
}

.btn-small {
  border: 1px solid #3d4a63;
  background: #1c2433;
  color: #e8eaef;
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}
</style>
