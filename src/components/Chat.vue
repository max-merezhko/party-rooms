<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
})

const body = ref('')
const bottom = ref(null)

const emit = defineEmits(['send'])

watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    bottom.value?.scrollIntoView({ behavior: 'smooth' })
  },
)

function send() {
  const text = body.value.trim()
  if (!text) return
  emit('send', text)
  body.value = ''
}
</script>

<template>
  <div class="chat">
    <h2>Chat</h2>
    <div class="scroll">
      <div
        v-for="(m, i) in messages"
        :key="i + '-' + m.ts"
        class="msg"
      >
        <span class="who">{{ m.email || m.userId }}</span>
        <span class="text">{{ m.text }}</span>
      </div>
      <div ref="bottom" />
    </div>
    <form class="composer" @submit.prevent="send">
      <input v-model="body" maxlength="2000" placeholder="Message…" />
      <button type="submit">Send</button>
    </form>
  </div>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 280px;
  max-height: min(60vh, 520px);
}

.chat h2 {
  margin: 0;
  font-size: 1.05rem;
}

.scroll {
  flex: 1;
  overflow: auto;
  padding: 0.5rem;
  background: #141922;
  border: 1px solid #242d3f;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.msg {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.88rem;
}

.who {
  font-size: 0.72rem;
  color: #7cb7ff;
}

.text {
  color: #e8eaef;
  word-break: break-word;
}

.composer {
  display: flex;
  gap: 0.5rem;
}

.composer input {
  flex: 1;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  border: 1px solid #333c52;
  background: #0f1117;
  color: #e8eaef;
}

.composer button {
  border: none;
  border-radius: 8px;
  padding: 0.45rem 0.75rem;
  background: #2a3347;
  color: #e8eaef;
}
</style>
