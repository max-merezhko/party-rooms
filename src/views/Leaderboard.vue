<script setup>
import { ref, onMounted } from 'vue'
import Navbar from '@/components/Navbar.vue'
import { api } from '@/services/api'

const mostLiked = ref([])
const topWeek = ref([])
const errorMost = ref('')
const loading = ref(true)

onMounted(async () => {
  loading.value = true
  errorMost.value = ''
  try {
    const [a, b] = await Promise.all([
      api.get('/leaderboard/most-liked'),
      api.get('/leaderboard/top-week'),
    ])
    mostLiked.value = a.data.items || []
    topWeek.value = b.data.items || []
  } catch (e) {
    errorMost.value = e.response?.data?.error || e.message || 'Failed to load'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="layout">
    <Navbar />
    <main class="main">
      <h1>Leaderboards</h1>
      <p v-if="loading">Loading…</p>
      <p v-if="errorMost" class="error">{{ errorMost }}</p>

      <section v-if="!loading" class="cols">
        <div class="col">
          <h2>Most liked (all time)</h2>
          <ol v-if="mostLiked.length" class="list">
            <li v-for="(item, i) in mostLiked" :key="item.queueId">
              <span class="rank">{{ i + 1 }}</span>
              <img v-if="item.thumbnail" :src="item.thumbnail" alt="" class="thumb" />
              <div class="meta">
                <div class="title">{{ item.title }}</div>
                <div class="sub">{{ item.likeCount }} likes · {{ item.youtube_video_id }}</div>
              </div>
            </li>
          </ol>
          <p v-else class="muted">No likes yet.</p>
        </div>

        <div class="col">
          <h2>Top rated this week</h2>
          <ol v-if="topWeek.length" class="list">
            <li v-for="(item, i) in topWeek" :key="item.queueId + '-w'">
              <span class="rank">{{ i + 1 }}</span>
              <img v-if="item.thumbnail" :src="item.thumbnail" alt="" class="thumb" />
              <div class="meta">
                <div class="title">{{ item.title }}</div>
                <div class="sub">{{ item.likeCount }} likes · {{ item.youtube_video_id }}</div>
              </div>
            </li>
          </ol>
          <p v-else class="muted">No likes in the last 7 days.</p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}

.main {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.25rem;
}

h1 {
  margin: 0 0 1rem;
  font-size: 1.35rem;
}

h2 {
  margin: 0 0 0.65rem;
  font-size: 1.05rem;
}

.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

@media (max-width: 800px) {
  .cols {
    grid-template-columns: 1fr;
  }
}

.list {
  padding-left: 0;
  margin: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list li {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.5rem 0.65rem;
  background: #161b26;
  border: 1px solid #252d3d;
  border-radius: 10px;
}

.rank {
  font-weight: 700;
  color: #7cb7ff;
  width: 1.5rem;
}

.thumb {
  width: 80px;
  height: 45px;
  object-fit: cover;
  border-radius: 6px;
}

.meta {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub {
  font-size: 0.75rem;
  color: #8b96ae;
}

.muted {
  color: #9aa5bc;
  font-size: 0.9rem;
}

.error {
  color: #ff8b8b;
}
</style>
