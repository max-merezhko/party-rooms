<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login, signup, setSession } from '@/services/auth'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const mode = ref('login')
const errorMsg = ref('')
const busy = ref(false)

async function submit() {
  errorMsg.value = ''
  busy.value = true
  try {
    if (mode.value === 'signup') {
      const data = await signup(email.value, password.value)
      if (data.session?.access_token) {
        setSession(data.session, data.user)
        redirectAfterAuth()
      } else {
        mode.value = 'login'
        errorMsg.value =
          'Check your email to confirm your account, then sign in here.'
      }
    } else {
      await login(email.value, password.value)
      redirectAfterAuth()
    }
  } catch (e) {
    errorMsg.value = e.response?.data?.error || e.message || 'Request failed'
  } finally {
    busy.value = false
  }
}

function redirectAfterAuth() {
  const dest = route.query.redirect
  if (typeof dest === 'string' && dest.startsWith('/')) {
    router.replace(dest)
  } else {
    router.replace({ name: 'rooms' })
  }
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'signup' : 'login'
  errorMsg.value = ''
}
</script>

<template>
  <div class="page">
    <div class="card">
      <h1>{{ mode === 'login' ? 'Sign in' : 'Create account' }}</h1>
      <form class="form" @submit.prevent="submit">
        <label>
          Email
          <input v-model="email" type="email" autocomplete="email" required />
        </label>
        <label>
          Password
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            minlength="6"
          />
        </label>
        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
        <button type="submit" class="btn-primary" :disabled="busy">
          {{ busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Sign up' }}
        </button>
      </form>
      <p class="switch">
        <button type="button" class="linkish" @click="toggleMode">
          {{
            mode === 'login'
              ? 'Need an account? Sign up'
              : 'Already have an account? Sign in'
          }}
        </button>
      </p>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.card {
  width: 100%;
  max-width: 400px;
  background: #161b26;
  border: 1px solid #252d3d;
  border-radius: 12px;
  padding: 1.5rem;
}

h1 {
  margin: 0 0 1rem;
  font-size: 1.35rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: #b8c0d4;
}

input {
  padding: 0.5rem 0.65rem;
  border-radius: 8px;
  border: 1px solid #333c52;
  background: #0f1117;
  color: #e8eaef;
}

.btn-primary {
  margin-top: 0.25rem;
  padding: 0.55rem 1rem;
  border: none;
  border-radius: 8px;
  background: linear-gradient(180deg, #4f8cff, #3b6fd9);
  color: #fff;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #ff8b8b;
  font-size: 0.9rem;
  margin: 0;
}

.switch {
  margin-top: 1rem;
  text-align: center;
}

.linkish {
  background: none;
  border: none;
  color: #7cb7ff;
  padding: 0;
}

.linkish:hover {
  text-decoration: underline;
}
</style>
