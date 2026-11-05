import playerState from '@/store/player/state'

/**
 * 卡拉 OK 时钟
 *
 * 洛雪的播放进度（playerState.progress.nowPlayTime）来自 TrackPlayer 的进度事件，
 * 大约 1s 一次，直接拿来做逐字高亮会一跳一跳。
 * 这里做「本地外推」：每次进度事件到来时记录 (position, wallClock)，
 * 之后用 Date.now() 外推，得到 60fps 平滑的播放时间。
 *
 * 用法：在任意组件的 requestAnimationFrame 里调用 getKaraokeTime()，
 * 不要放进 state（那会导致每帧 re-render）。
 */

const clock = {
  base: 0,
  at: 0,
  playing: false,
  rate: 1,
}

let inited = false

const sync = (time: number, playing: boolean) => {
  clock.base = time
  clock.at = Date.now()
  clock.playing = playing
}

const init = () => {
  if (inited) return
  inited = true
  sync(playerState.progress.nowPlayTime, playerState.isPlay)

  global.state_event.on('playProgressChanged', (progress) => {
    sync(progress.nowPlayTime, playerState.isPlay)
  })
  global.state_event.on('playStateChanged', (isPlay) => {
    sync(playerState.progress.nowPlayTime, isPlay)
  })
  // 切歌后进度归零，避免上一首的时间残留
  global.state_event.on('playMusicInfoChanged', () => {
    sync(0, false)
  })
}

/** 当前播放时间（ms，已做平滑外推） */
export const getKaraokeTime = () => {
  init()
  if (!clock.playing) return clock.base
  return clock.base + (Date.now() - clock.at) * clock.rate
}

/** 倍速播放时同步（player.setPlaybackRate 之后调用） */
export const setKaraokeRate = (rate: number) => {
  if (clock.rate === rate) return
  const now = getKaraokeTime()
  clock.rate = rate
  sync(now, clock.playing)
}

/** 手动校准（拖动进度条后立即调用，避免最多 1s 的偏差） */
export const seekKaraokeTime = (time: number) => {
  sync(time, playerState.isPlay)
}