<script setup>
import { onMounted, onUnmounted, watch, nextTick } from 'vue'
import { loadYoutubeIframeAPI } from '@/utils/youtubeApi'

const props = defineProps({
  videoId: { type: String, default: null },
  /** Latest playback snapshot from other clients (must include `ts` for applying). */
  remote: { type: Object, default: null },
})

const emit = defineEmits(['ended', 'sync'])

const mountId = 'party-youtube-player'

let player = null
/** True only after YT `onReady` — methods are safe; avoids applying remote while script still loading. */
let apiReady = false
/** Remote snapshot received before iframe API / onReady (your logs: watch ran with no player yet). */
let pendingRemote = null
/** videoId updates before onReady */
let pendingVideoId = null

let ignoreEmit = false

/** YouTube rejects `new YT.Player({ videoId: undefined })` with "Invalid video id" — omit the key until we have a real id. */
function normalizeYoutubeVideoId(id) {
  if (id == null) return null
  const s = String(id).trim()
  if (!s) return null
  return s
}

function log(...args) {
  console.log('[party-player]', ...args)
}

function publishSync() {
  if (!player || ignoreEmit || typeof player.getPlayerState !== 'function') return
  try {
    const data = player.getVideoData?.()
    const videoId = data?.video_id
    const YT = window.YT
    emit('sync', {
      videoId: videoId || props.videoId,
      isPlaying: player.getPlayerState() === YT.PlayerState.PLAYING,
      currentTime: typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0,
    })
  } catch {
    /* ignore */
  }
}

/** Apply remote-driven play/pause/seek; defers seek+play after loadVideoById so the iframe can cue first. */
function applyRemotePayload(r) {
  log('applyRemotePayload enter', { hasPlayer: !!player, apiReady, hasTs: !!r?.ts })
  if (!player || !r?.ts) return
  ignoreEmit = true

  const releaseIgnore = () => {
    setTimeout(() => {
      ignoreEmit = false
    }, 120)
  }

  const YT = window.YT

  const tryPlayWithFallback = () => {
    if (!r.isPlaying || !player.playVideo) return
    player.playVideo()
    // Programmatic play after delay/load often blocked; muted playback is usually allowed.
    setTimeout(() => {
      try {
        const st = player.getPlayerState?.()
        if (r.isPlaying && st !== YT.PlayerState.PLAYING && player.mute && player.playVideo) {
          log('applyRemotePayload: retry play muted (autoplay policy)')
          player.mute()
          player.playVideo()
        }
      } catch {
        /* ignore */
      }
    }, 250)
  }

  try {
    const cur = player.getVideoData?.()?.video_id
    const needLoad = Boolean(r.videoId && r.videoId !== cur && player.loadVideoById)
    log('applyRemotePayload', { cur, target: r.videoId, needLoad, isPlaying: r.isPlaying })

    const finish = () => {
      try {
        if (typeof r.currentTime === 'number' && player.seekTo) {
          player.seekTo(r.currentTime, true)
        }
        if (r.isPlaying) tryPlayWithFallback()
        else if (!r.isPlaying && player.pauseVideo) player.pauseVideo()
        const st = player.getPlayerState?.()
        log('applyRemotePayload finish', { getPlayerState: st })
      } catch (err) {
        log('applyRemotePayload finish error', err)
      } finally {
        releaseIgnore()
      }
    }

    if (needLoad) {
      const vid = normalizeYoutubeVideoId(r.videoId)
      if (!vid) {
        log('applyRemotePayload skip load — invalid video id', r.videoId)
        releaseIgnore()
        return
      }
      player.loadVideoById(vid)
      log('applyRemotePayload scheduled finish in 450ms after loadVideoById')
      setTimeout(finish, 450)
    } else {
      finish()
    }
  } catch (err) {
    log('applyRemotePayload catch', err)
    releaseIgnore()
  }
}

/** Single place to sync props after API is ready (handles early queue ▶ while script was still loading). */
function syncPlayerFromProps(source) {
  log('syncPlayerFromProps', source, {
    hasPlayer: !!player,
    apiReady,
    videoId: props.videoId,
    pendingRemote,
    remoteTs: props.remote?.ts,
  })
  if (!player || !apiReady) return

  const remote = pendingRemote ?? (props.remote?.ts ? props.remote : null)
  pendingRemote = null

  if (remote?.ts) {
    applyRemotePayload(remote)
    return
  }

  const id = normalizeYoutubeVideoId(pendingVideoId ?? props.videoId)
  pendingVideoId = null
  if (id && typeof player.loadVideoById === 'function') {
    log('syncPlayerFromProps videoId-only loadVideoById', id)
    ignoreEmit = true
    player.loadVideoById(id)
    setTimeout(() => {
      ignoreEmit = false
    }, 400)
  } else {
    log('syncPlayerFromProps noop')
  }
}

onMounted(async () => {
  log('VideoPlayer mount start', { videoId: props.videoId, remote: props.remote })
  await loadYoutubeIframeAPI()
  log('iframe API loaded, creating YT.Player')
  const YT = window.YT
  const initialVideoId = normalizeYoutubeVideoId(props.videoId)
  const playerConfig = {
    height: '360',
    width: '100%',
    playerVars: {
      playsinline: 1,
      rel: 0,
      ...(typeof window !== 'undefined' && window.location?.origin
        ? { origin: window.location.origin }
        : {}),
    },
    events: {
      onReady: async () => {
        log('YT onReady (before nextTick)', {
          videoId: props.videoId,
          remoteTs: props.remote?.ts,
          pendingRemote,
        })
        apiReady = true
        await nextTick()
        await nextTick()
        log('YT onReady (after nextTick x2)')
        syncPlayerFromProps('onReady')
      },
      onStateChange: (e) => {
        log('YT onStateChange', { state: e.data, ignoreEmit })
        if (ignoreEmit) return
        if (e.data === YT.PlayerState.ENDED) {
          emit('ended')
        }
        publishSync()
      },
      onError: (e) => {
        log('YT onError', e?.data ?? e)
        console.warn('[VideoPlayer] YouTube error', e?.data ?? e)
      },
    },
  }
  if (initialVideoId) {
    playerConfig.videoId = initialVideoId
  }
  try {
    player = new YT.Player(mountId, playerConfig)
  } catch (e) {
    log('YT.Player constructor threw', e)
    throw e
  }
  log('YT.Player constructor returned', {
    playerAssigned: !!player,
    initialVideoId: initialVideoId || '(none — cue via onReady)',
  })
})

watch(
  () => props.videoId,
  (id) => {
    log('watch videoId', {
      id,
      apiReady,
      hasPlayer: !!player,
      skipRemoteOwns: !!props.remote?.ts,
    })
    const normalized = normalizeYoutubeVideoId(id)
    if (!normalized) return
    if (!apiReady) {
      if (!props.remote?.ts) pendingVideoId = normalized
      log('watch videoId deferred until onReady')
      return
    }
    if (!player || typeof player.loadVideoById !== 'function') return
    if (props.remote?.ts) {
      log('watch videoId skipped (remote has ts)')
      return
    }
    ignoreEmit = true
    player.loadVideoById(normalized)
    setTimeout(() => {
      ignoreEmit = false
    }, 400)
  },
)

watch(
  () => props.remote,
  (r) => {
    log('watch remote', { apiReady, hasPlayer: !!player, hasTs: !!r?.ts })
    if (!r?.ts) return
    if (!apiReady || !player) {
      pendingRemote = r
      log('watch remote stored as pendingRemote until onReady')
      return
    }
    applyRemotePayload(r)
  },
  { deep: true },
)

onUnmounted(() => {
  try {
    player?.destroy?.()
  } finally {
    player = null
    apiReady = false
    pendingRemote = null
    pendingVideoId = null
  }
})

function togglePlay() {
  log('togglePlay', {
    apiReady,
    hasPlayer: !!player,
    hasGetState: player && typeof player.getPlayerState === 'function',
  })
  if (!player || typeof player.getPlayerState !== 'function') return
  const YT = window.YT
  const st = player.getPlayerState()
  log('togglePlay before', { state: st })
  ignoreEmit = true
  if (st === YT.PlayerState.PLAYING) player.pauseVideo()
  else player.playVideo()
  setTimeout(() => {
    ignoreEmit = false
    publishSync()
    try {
      log('togglePlay after', { state: player.getPlayerState?.() })
    } catch {
      /* ignore */
    }
  }, 100)
}
</script>

<template>
  <div class="wrap">
    <div class="bar">
      <button type="button" class="btn" @click="togglePlay">Play / Pause</button>
      <span class="hint">Playback syncs over the room via Socket.io</span>
    </div>
    <div :id="mountId" class="player-box" />
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn {
  border: 1px solid #3d4a63;
  background: #1c2433;
  color: #e8eaef;
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
}

.hint {
  font-size: 0.8rem;
  color: #9aa5bc;
}

.player-box {
  aspect-ratio: 16 / 9;
  width: 100%;
  max-height: 50vh;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #252d3d;
}
</style>
