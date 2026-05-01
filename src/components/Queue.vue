<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  busyId: { type: String, default: null },
})

const emit = defineEmits(['vote', 'remove', 'play', 'like'])

function vote(id, direction) {
  emit('vote', { id, direction })
}

function remove(id) {
  emit('remove', id)
}

function play(item) {
  emit('play', item)
}

function like(id) {
  emit('like', id)
}
</script>

<template>
  <div class="queue">
    <h2>Queue</h2>
    <ul v-if="items.length" class="list">
      <li v-for="item in items" :key="item.id" class="row">
        <button type="button" class="play" title="Play" @click="play(item)">▶</button>
        <div class="info">
          <div class="title">{{ item.title }}</div>
          <div class="votes">{{ item.votes ?? 0 }} votes</div>
        </div>
        <div class="actions">
          <button
            type="button"
            class="mini"
            :disabled="busyId === item.id"
            @click="vote(item.id, 'up')"
          >
            +
          </button>
          <button
            type="button"
            class="mini"
            :disabled="busyId === item.id"
            @click="vote(item.id, 'down')"
          >
            −
          </button>
          <button type="button" class="mini heart" @click="like(item.id)">♥</button>
          <button type="button" class="mini danger" @click="remove(item.id)">✕</button>
        </div>
      </li>
    </ul>
    <p v-else class="empty">Queue is empty — search and add a song.</p>
  </div>
</template>

<style scoped>
.queue h2 {
  margin: 0 0 0.65rem;
  font-size: 1.05rem;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.5rem;
  background: #141922;
  border: 1px solid #242d3f;
  border-radius: 8px;
}

.play {
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  border: 1px solid #3d4a63;
  background: #1a2230;
  color: #b7d7ff;
}

.info {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 0.88rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.votes {
  font-size: 0.75rem;
  color: #8b96ae;
}

.actions {
  display: flex;
  gap: 0.25rem;
}

.mini {
  min-width: 1.75rem;
  padding: 0.2rem 0.35rem;
  border-radius: 6px;
  border: 1px solid #3d4a63;
  background: #1c2433;
  color: #e8eaef;
  font-size: 0.85rem;
}

.heart {
  color: #ff8fb5;
}

.danger {
  border-color: #5a3030;
  color: #ffb4b4;
}

.empty {
  color: #9aa5bc;
  font-size: 0.9rem;
}
</style>
