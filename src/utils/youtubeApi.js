/** Loads the YouTube IFrame API script once and resolves when YT.Player is ready. */
export function loadYoutubeIframeAPI() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))

  if (window.YT && window.YT.Player) {
    return Promise.resolve()
  }

  if (window.__youtubeIframePromise) {
    return window.__youtubeIframePromise
  }

  window.__youtubeIframePromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev()
      resolve()
    }

    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    tag.async = true
    tag.onerror = () => reject(new Error('Failed to load YouTube iframe API'))
    document.head.appendChild(tag)
  })

  return window.__youtubeIframePromise
}
