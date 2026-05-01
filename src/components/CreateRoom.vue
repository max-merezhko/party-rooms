<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'created'])

const name = ref('')
const isPublic = ref(true)
const password = ref('')
const busy = ref(false)
const errorMsg = ref('')

watch(
  () => props.open,
  (v) => {
    if (v) {
      name.value = ''
      isPublic.value = true
      password.value = ''
      errorMsg.value = ''
    }
  },
)

function close() {
  emit('close')
}

function submit() {
  errorMsg.value = ''
  if (!name.value.trim()) {
    errorMsg.value = 'Room name is required'
    return
  }
  if (!isPublic.value && password.value.length < 4) {
    errorMsg.value = 'Private rooms need a password (min 4 characters)'
    return
  }
  emit('created', {
    name: name.value.trim(),
    is_public: isPublic.value,
    password: isPublic.value ? undefined : password.value,
  })
}
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="close">
    <div class="modal">
      <h2>Create room</h2>
      <form class="form" @submit.prevent="submit">
        <label>
          Name
          <input v-model="name" maxlength="100" required />
        </label>
        <label class="row">
          <input v-model="isPublic" type="checkbox" />
          Public (listed for everyone)
        </label>
        <template v-if="!isPublic">
          <label>
            Room password
            <input v-model="password" type="password" autocomplete="new-password" />
          </label>
        </template>
        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
        <div class="actions">
          <button type="button" class="btn-ghost" @click="close">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="busy">Create</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.modal {
  width: 100%;
  max-width: 420px;
  background: #161b26;
  border: 1px solid #252d3d;
  border-radius: 12px;
  padding: 1.25rem;
}

h2 {
  margin: 0 0 1rem;
  font-size: 1.15rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: #b8c0d4;
}

.row {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

input[type='text'],
input[type='password'] {
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  border: 1px solid #333c52;
  background: #0f1117;
  color: #e8eaef;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.btn-ghost {
  background: transparent;
  border: 1px solid #3d4a63;
  color: #e8eaef;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
}

.btn-primary {
  border: none;
  border-radius: 8px;
  padding: 0.4rem 0.9rem;
  background: linear-gradient(180deg, #4f8cff, #3b6fd9);
  color: #fff;
}

.error {
  color: #ff8b8b;
  margin: 0;
  font-size: 0.9rem;
}
</style>
