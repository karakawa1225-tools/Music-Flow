import { create } from 'zustand'
import type { RepeatMode, Track } from '@shared/types'
import { EQ_PRESETS } from '@shared/types'
import { useLibraryStore } from './libraryStore'

const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

type ResolveResult =
  | { ok: true; url: string; track: Track }
  | { ok: false; error: string; track?: Track | null }

interface PlayerState {
  queue: Track[]
  queueIndex: number
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  shuffle: boolean
  repeatMode: RepeatMode
  isReady: boolean
  error: string | null
  analyserData: Uint8Array
  initPlayer: () => Promise<void>
  playTracks: (tracks: Track[], startIndex?: number) => Promise<void>
  togglePlay: () => Promise<void>
  pause: () => void
  next: () => Promise<void>
  previous: () => Promise<void>
  seek: (time: number) => void
  setVolume: (volume: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  toggleFavoriteCurrent: () => Promise<void>
  reorderQueue: (from: number, to: number) => void
  removeFromQueue: (index: number) => void
  playAtQueueIndex: (index: number) => Promise<void>
  applyEqFromSettings: () => void
}

let audio: HTMLAudioElement | null = null
let audioCtx: AudioContext | null = null
let sourceNode: MediaElementAudioSourceNode | null = null
let filters: BiquadFilterNode[] = []
let bassBoostFilter: BiquadFilterNode | null = null
let analyser: AnalyserNode | null = null
let gainNode: GainNode | null = null
let panNode: StereoPannerNode | null = null
let rafId = 0
let positionSaveTimer: ReturnType<typeof setInterval> | null = null
let hasRecordedPlay = false
/** Ignore RAF currentTime until media finishes seeking (or timeout). */
let seekHoldUntil = 0

function ensureAudioGraph(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.preload = 'auto'
  }

  if (!audioCtx) {
    audioCtx = new AudioContext()
    sourceNode = audioCtx.createMediaElementSource(audio)
    gainNode = audioCtx.createGain()
    panNode = audioCtx.createStereoPanner()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256

    filters = EQ_FREQUENCIES.map((freq, index) => {
      const filter = audioCtx!.createBiquadFilter()
      filter.type = index === 0 ? 'lowshelf' : index === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking'
      filter.frequency.value = freq
      filter.Q.value = 1.2
      filter.gain.value = 0
      return filter
    })

    bassBoostFilter = audioCtx.createBiquadFilter()
    bassBoostFilter.type = 'lowshelf'
    bassBoostFilter.frequency.value = 100
    bassBoostFilter.gain.value = 0

    let node: AudioNode = sourceNode
    for (const filter of filters) {
      node.connect(filter)
      node = filter
    }
    node.connect(bassBoostFilter)
    bassBoostFilter.connect(panNode)
    panNode.connect(gainNode)
    gainNode.connect(analyser)
    analyser.connect(audioCtx.destination)
  }

  return audio
}

function applyEqValues(
  enabled: boolean,
  bands: number[],
  bassBoost: number,
  balance: number,
  volume: number
): void {
  ensureAudioGraph()
  if (!gainNode || !panNode || !bassBoostFilter) return

  gainNode.gain.value = volume
  panNode.pan.value = Math.max(-1, Math.min(1, balance / 100))

  filters.forEach((filter, i) => {
    filter.gain.value = enabled ? bands[i] ?? 0 : 0
  })
  bassBoostFilter.gain.value = enabled ? bassBoost : 0
}

function stopRaf(): void {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
}

function startRaf(set: (partial: Partial<PlayerState>) => void): void {
  stopRaf()
  const tick = () => {
    if (!audio) return
    const data = new Uint8Array(analyser?.frequencyBinCount ?? 0)
    analyser?.getByteFrequencyData(data)
    const holdingSeek = performance.now() < seekHoldUntil
    const nextDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0
    set({
      ...(holdingSeek ? {} : { currentTime: audio.currentTime || 0 }),
      ...(nextDuration > 0 ? { duration: nextDuration } : {}),
      analyserData: data
    })
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

function persistSnapshot(get: () => PlayerState): void {
  const state = get()
  void window.musicFlow.savePlaybackSnapshot({
    currentTrackId: state.currentTrack?.id ?? null,
    queue: state.queue.map((t) => t.id),
    queueIndex: state.queueIndex,
    currentTime: state.currentTime,
    isPlaying: false,
    volume: state.volume,
    shuffle: state.shuffle,
    repeatMode: state.repeatMode
  })
}

async function loadAndPlay(
  track: Track,
  set: (partial: Partial<PlayerState> | ((s: PlayerState) => Partial<PlayerState>)) => void,
  get: () => PlayerState,
  resumeAt = 0,
  autoplay = true
): Promise<void> {
  const el = ensureAudioGraph()
  const settings = useLibraryStore.getState().settings
  applyEqValues(
    settings.eqEnabled,
    settings.eqBands,
    settings.eqBassBoost,
    settings.eqBalance,
    get().volume
  )

  if (audioCtx?.state === 'suspended') {
    await audioCtx.resume()
  }

  const resolved = (await window.musicFlow.resolveTrackUrl(track.id)) as ResolveResult
  if (!resolved.ok) {
    set({
      error: resolved.error === 'File missing' ? 'ファイルが見つかりません' : '再生できません',
      isPlaying: false
    })
    return
  }

  hasRecordedPlay = false
  el.src = resolved.url
  el.currentTime = resumeAt

  const onLoaded = async () => {
    set({
      currentTrack: resolved.track,
      duration: Number.isFinite(el.duration) ? el.duration : track.duration,
      currentTime: el.currentTime,
      error: null
    })
    if (autoplay) {
      try {
        await el.play()
        set({ isPlaying: true })
        startRaf(set)
        if (!hasRecordedPlay) {
          hasRecordedPlay = true
          await window.musicFlow.recordPlay(track.id, el.currentTime)
          await useLibraryStore.getState().refreshLibrary()
        }
      } catch (error) {
        console.error(error)
        set({ isPlaying: false, error: '再生を開始できませんでした' })
      }
    }
  }

  el.onloadedmetadata = () => {
    void onLoaded()
  }
  el.onended = () => {
    void get().next()
  }
  el.onerror = () => {
    set({ isPlaying: false, error: 'このファイルは再生できません' })
  }

  el.load()
  persistSnapshot(get)
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  queueIndex: -1,
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  shuffle: false,
  repeatMode: 'off',
  isReady: false,
  error: null,
  analyserData: new Uint8Array(0),

  initPlayer: async () => {
    const settings = useLibraryStore.getState().settings
    ensureAudioGraph()
    applyEqValues(
      settings.eqEnabled,
      settings.eqBands,
      settings.eqBassBoost,
      settings.eqBalance,
      settings.volume
    )
    set({
      volume: settings.volume,
      shuffle: settings.shuffle,
      repeatMode: settings.repeatMode,
      isReady: true
    })

    if (positionSaveTimer) clearInterval(positionSaveTimer)
    positionSaveTimer = setInterval(() => {
      const { currentTrack, currentTime, isPlaying } = get()
      if (currentTrack && isPlaying) {
        void window.musicFlow.savePosition(currentTrack.id, currentTime)
        persistSnapshot(get)
      }
    }, 5000)

    if (settings.restoreLastState) {
      const snapshot = await window.musicFlow.getPlaybackSnapshot()
      if (snapshot?.queue?.length) {
        const tracks = useLibraryStore.getState().tracks
        const queue = snapshot.queue
          .map((id) => tracks.find((t) => t.id === id))
          .filter(Boolean) as Track[]
        if (queue.length) {
          const index = Math.min(Math.max(snapshot.queueIndex, 0), queue.length - 1)
          set({
            queue,
            queueIndex: index,
            volume: snapshot.volume,
            shuffle: snapshot.shuffle,
            repeatMode: snapshot.repeatMode
          })
          await loadAndPlay(queue[index], set, get, snapshot.currentTime || 0, false)
        }
      }
    }
  },

  playTracks: async (tracks, startIndex = 0) => {
    if (!tracks.length) return
    const index = Math.min(Math.max(startIndex, 0), tracks.length - 1)
    set({ queue: tracks, queueIndex: index, error: null })
    await loadAndPlay(tracks[index], set, get, 0, true)
  },

  togglePlay: async () => {
    const el = ensureAudioGraph()
    const { currentTrack, isPlaying, queue, queueIndex } = get()
    if (!currentTrack) {
      if (queue.length && queueIndex >= 0) {
        await loadAndPlay(queue[queueIndex], set, get, 0, true)
      }
      return
    }
    if (audioCtx?.state === 'suspended') await audioCtx.resume()
    if (isPlaying) {
      el.pause()
      set({ isPlaying: false })
      stopRaf()
      persistSnapshot(get)
    } else {
      try {
        await el.play()
        set({ isPlaying: true })
        startRaf(set)
      } catch {
        set({ error: '再生を開始できませんでした' })
      }
    }
  },

  pause: () => {
    audio?.pause()
    set({ isPlaying: false })
    stopRaf()
  },

  next: async () => {
    const { queue, queueIndex, repeatMode, shuffle, currentTrack } = get()
    if (!queue.length) return

    if (repeatMode === 'one' && currentTrack) {
      await loadAndPlay(currentTrack, set, get, 0, true)
      return
    }

    let nextIndex = queueIndex + 1
    if (shuffle) {
      if (queue.length === 1) nextIndex = 0
      else {
        do {
          nextIndex = Math.floor(Math.random() * queue.length)
        } while (nextIndex === queueIndex && queue.length > 1)
      }
    }

    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') nextIndex = 0
      else {
        set({ isPlaying: false })
        stopRaf()
        return
      }
    }

    set({ queueIndex: nextIndex })
    await loadAndPlay(queue[nextIndex], set, get, 0, true)
  },

  previous: async () => {
    const { queue, queueIndex, currentTime } = get()
    if (!queue.length) return
    if (currentTime > 3) {
      get().seek(0)
      return
    }
    const prevIndex = queueIndex <= 0 ? queue.length - 1 : queueIndex - 1
    set({ queueIndex: prevIndex })
    await loadAndPlay(queue[prevIndex], set, get, 0, true)
  },

  seek: (time) => {
    const el = audio ?? ensureAudioGraph()
    const max =
      Number.isFinite(el.duration) && el.duration > 0
        ? el.duration
        : get().duration > 0
          ? get().duration
          : get().currentTrack?.duration || time
    const next = Math.max(0, Math.min(time, max || time))
    seekHoldUntil = performance.now() + 750
    set({ currentTime: next })
    try {
      el.currentTime = next
    } catch {
      /* ignore InvalidStateError while media loads */
    }
    const clearHold = () => {
      seekHoldUntil = 0
      set({ currentTime: el.currentTime || next })
      el.removeEventListener('seeked', clearHold)
    }
    el.addEventListener('seeked', clearHold, { once: true })
    if (get().isPlaying) startRaf(set)
  },

  setVolume: (volume) => {
    const v = Math.max(0, Math.min(1, volume))
    set({ volume: v })
    if (gainNode) gainNode.gain.value = v
    void useLibraryStore.getState().setSettings({ volume: v })
  },

  toggleShuffle: () => {
    const enabled = !get().shuffle
    if (enabled) {
      // Keep current track first, shuffle the rest so the mode feels immediate
      const { queue, queueIndex } = get()
      if (queue.length > 1 && queueIndex >= 0) {
        const current = queue[queueIndex]
        const rest = queue.filter((_, i) => i !== queueIndex)
        for (let i = rest.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[rest[i], rest[j]] = [rest[j], rest[i]]
        }
        set({ shuffle: true, queue: [current, ...rest], queueIndex: 0 })
      } else {
        set({ shuffle: true })
      }
    } else {
      set({ shuffle: false })
    }
    void useLibraryStore.getState().setSettings({ shuffle: enabled })
  },

  cycleRepeat: () => {
    const order: RepeatMode[] = ['off', 'all', 'one']
    const next = order[(order.indexOf(get().repeatMode) + 1) % order.length]
    set({ repeatMode: next })
    void useLibraryStore.getState().setSettings({ repeatMode: next })
  },

  toggleFavoriteCurrent: async () => {
    const track = get().currentTrack
    if (!track) return
    await useLibraryStore.getState().toggleFavorite(track.id)
    const updated = useLibraryStore.getState().tracks.find((t) => t.id === track.id)
    if (updated) {
      set({
        currentTrack: updated,
        queue: get().queue.map((t) => (t.id === updated.id ? updated : t))
      })
    }
  },

  reorderQueue: (from, to) => {
    const queue = [...get().queue]
    if (from < 0 || to < 0 || from >= queue.length || to >= queue.length) return
    const [item] = queue.splice(from, 1)
    queue.splice(to, 0, item)
    let queueIndex = get().queueIndex
    if (queueIndex === from) queueIndex = to
    else if (from < queueIndex && to >= queueIndex) queueIndex -= 1
    else if (from > queueIndex && to <= queueIndex) queueIndex += 1
    set({ queue, queueIndex })
    persistSnapshot(get)
  },

  removeFromQueue: (index) => {
    const queue = [...get().queue]
    if (index < 0 || index >= queue.length) return
    queue.splice(index, 1)
    let queueIndex = get().queueIndex
    if (index === queueIndex) {
      set({ queue, queueIndex: Math.min(queueIndex, queue.length - 1) })
      const nextTrack = queue[Math.min(queueIndex, queue.length - 1)]
      if (nextTrack) void loadAndPlay(nextTrack, set, get, 0, get().isPlaying)
      else set({ currentTrack: null, isPlaying: false })
      return
    }
    if (index < queueIndex) queueIndex -= 1
    set({ queue, queueIndex })
  },

  playAtQueueIndex: async (index) => {
    const track = get().queue[index]
    if (!track) return
    set({ queueIndex: index })
    await loadAndPlay(track, set, get, 0, true)
  },

  applyEqFromSettings: () => {
    const settings = useLibraryStore.getState().settings
    const bands =
      settings.eqPreset !== 'CUSTOM' && EQ_PRESETS[settings.eqPreset]
        ? EQ_PRESETS[settings.eqPreset]
        : settings.eqBands
    applyEqValues(settings.eqEnabled, bands, settings.eqBassBoost, settings.eqBalance, get().volume)
  }
}))
