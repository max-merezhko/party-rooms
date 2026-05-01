import { createRouter, createWebHistory } from 'vue-router'
import { getStoredToken } from '@/services/auth'

import Login from '@/views/Login.vue'
import RoomList from '@/views/RoomList.vue'
import Room from '@/views/Room.vue'
import Leaderboard from '@/views/Leaderboard.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/rooms',
    },
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { guestOnly: true },
    },
    {
      path: '/rooms',
      name: 'rooms',
      component: RoomList,
      meta: { requiresAuth: true },
    },
    {
      path: '/room/:id',
      name: 'room',
      component: Room,
      meta: { requiresAuth: true },
    },
    {
      path: '/leaderboard',
      name: 'leaderboard',
      component: Leaderboard,
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const token = getStoredToken()

  if (to.meta.requiresAuth && !token) {
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta.guestOnly && token) {
    next({ name: 'rooms' })
    return
  }

  next()
})

export default router
