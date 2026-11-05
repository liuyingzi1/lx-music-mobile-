import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * 沉浸式播放页的「配色主题」+「歌词样式」
 *
 * 一个极小的外部 store + useSyncExternalStore：
 * 切换时只重渲染用到它的组件，不需要 Context，也不用改洛雪的 setting schema。
 */

// ---------------------------------------------------------------- 配色主题

export interface ImmersiveTheme {
  id: string
  name: string
  primary: string   // 歌词高亮 / 进度条已播
  veil: string      // 背景呼吸光晕
  card: string      // 卡片底色
  border: string    // 卡片描边
}

export const THEMES: ImmersiveTheme[] = [
  { id: 'aurora', name: '极光', primary: '#7CE7FF', veil: '#2AA8FF', card: 'rgba(10,20,32,0.58)', border: 'rgba(124,231,255,0.22)' },
  { id: 'sunset', name: '落日', primary: '#FFB86B', veil: '#FF5E62', card: 'rgba(30,14,10,0.58)', border: 'rgba(255,184,107,0.22)' },
  { id: 'nebula', name: '星云', primary: '#C9A7FF', veil: '#7C4DFF', card: 'rgba(18,12,32,0.58)', border: 'rgba(201,167,255,0.22)' },
  { id: 'mono', name: '极简', primary: '#FFFFFF', veil: '#8899AA', card: 'rgba(8,8,10,0.58)', border: 'rgba(255,255,255,0.16)' },
]

// ---------------------------------------------------------------- 歌词样式
//
// 一份样式 = 一组排版参数。新增样式只要往 LYRIC_STYLES 里加一条。
// 以后要做 Folia 那种「流光 / 云阶 / 回环」，在 KaraokeLine 里按 id 分支写专属动画即可。

export interface LyricStyle {
  id: string
  name: string
  /** 对齐方式 */
  align: 'center' | 'left' | 'right'
  /** 字号倍率 */
  scale: number
  /** 非当前行透明度 */
  dimOpacity: number
  /** 只显示当前行前后 N 行，0 = 全部显示 */
  visibleRange: number
  /** 是否画倒影（镜台） */
  mirror: boolean
  /** 左右留白（百分比） */
  padH: string
  /** 首行上方留白（百分比，相对宽度），决定垂直位置 */
  padTop: string
}

export const LYRIC_STYLES: LyricStyle[] = [
  // 经典：居中大字，逐字擦除，上下行淡出
  { id: 'classic', name: '经典', align: 'center', scale: 1.55, dimOpacity: 0.34, visibleRange: 0, mirror: false, padH: '9%', padTop: '38%' },
  // 侧栏：小字右对齐堆叠，多行可见（近似 Folia 的「町景」）
  { id: 'sidebar', name: '侧栏', align: 'right', scale: 0.95, dimOpacity: 0.26, visibleRange: 0, mirror: false, padH: '6%', padTop: '30%' },
  // 聚焦：只留当前行 ±1，当前行超大（近似「雾笺」）
  { id: 'focus', name: '聚焦', align: 'center', scale: 1.95, dimOpacity: 0.2, visibleRange: 1, mirror: false, padH: '13%', padTop: '40%' },
  // 镜台：居中 + 倒影
  { id: 'mirror', name: '镜台', align: 'center', scale: 1.3, dimOpacity: 0.3, visibleRange: 2, mirror: true, padH: '14%', padTop: '34%' },
  // 字幕：贴底、小字、左对齐，像视频字幕（近似「倾诉」）
  { id: 'subtitle', name: '字幕', align: 'left', scale: 0.85, dimOpacity: 0.36, visibleRange: 0, mirror: false, padH: '8%', padTop: '74%' },
]

// ---------------------------------------------------------------- store

const THEME_KEY = 'lx_immersive_theme'
const STYLE_KEY = 'lx_immersive_style'

let currentTheme: ImmersiveTheme = THEMES[0]
let currentStyle: LyricStyle = LYRIC_STYLES[0]

const listeners = new Set<() => void>()
const emit = () => { for (const listener of listeners) listener() }

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const getThemeSnapshot = () => currentTheme
const getStyleSnapshot = () => currentStyle

export const getImmersiveTheme = getThemeSnapshot
export const getLyricStyle = getStyleSnapshot

export const useImmersiveTheme = () => useSyncExternalStore(subscribe, getThemeSnapshot, getThemeSnapshot)
export const useLyricStyle = () => useSyncExternalStore(subscribe, getStyleSnapshot, getStyleSnapshot)

export const setImmersiveTheme = (id: string) => {
  const next = THEMES.find(t => t.id === id)
  if (!next || next.id === currentTheme.id) return
  currentTheme = next
  emit()
  void AsyncStorage.setItem(THEME_KEY, next.id).catch(() => {})
}

export const cycleImmersiveTheme = () => {
  const index = THEMES.findIndex(t => t.id === currentTheme.id)
  setImmersiveTheme(THEMES[(index + 1) % THEMES.length].id)
}

export const setLyricStyle = (id: string) => {
  const next = LYRIC_STYLES.find(s => s.id === id)
  if (!next || next.id === currentStyle.id) return
  currentStyle = next
  emit()
  void AsyncStorage.setItem(STYLE_KEY, next.id).catch(() => {})
}

export const cycleLyricStyle = () => {
  const index = LYRIC_STYLES.findIndex(s => s.id === currentStyle.id)
  setLyricStyle(LYRIC_STYLES[(index + 1) % LYRIC_STYLES.length].id)
}

/** App 进播放页时读一次 */
export const loadImmersivePrefs = () => {
  void Promise.all([
    AsyncStorage.getItem(THEME_KEY),
    AsyncStorage.getItem(STYLE_KEY),
  ]).then(([themeId, styleId]) => {
    let changed = false
    const nextTheme = THEMES.find(t => t.id === themeId)
    if (nextTheme && nextTheme.id !== currentTheme.id) { currentTheme = nextTheme; changed = true }
    const nextStyle = LYRIC_STYLES.find(s => s.id === styleId)
    if (nextStyle && nextStyle.id !== currentStyle.id) { currentStyle = nextStyle; changed = true }
    if (changed) emit()
  }).catch(() => {})
}