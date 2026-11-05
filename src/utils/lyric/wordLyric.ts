/**
 * 逐字（卡拉 OK）歌词解析
 *
 * 洛雪用的 lrc-file-parser 只输出「行级」数据：
 *   onPlay(line, text) / lines = [{ time, text, extendedLyrics }]
 * 没有任何字级时间戳，所以要做 Folia 那种逐字高亮，必须自己拿带字级时间的数据。
 *
 * 本文件支持两种真实存在的字级格式：
 *
 * 1) 增强型 LRC（A2 / enhanced LRC，网易云、QQ 的部分歌词、不少日语歌词用它）
 *    [00:12.34]<00:12.34>Hello <00:12.90>world
 *
 * 2) YRC（网易云逐字歌词，字段名 yrc）
 *    [1234,567](1234,120,0)逐(1354,130,0)字(1484,90,0)歌(1574,227,0)词
 *
 * 解析失败返回 null，由调用方退化为「按字符数均分时长」的估算模式。
 */

export interface WordTiming {
  /** 相对整首歌的起始时间（ms） */
  start: number
  /** 相对整首歌的结束时间（ms） */
  end: number
  text: string
}

export interface WordLine {
  time: number
  duration: number
  text: string
  words: WordTiming[]
}

const A2_LINE = /^\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\](.*)$/
const A2_WORD = /<(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?>([^<]*)/g
const YRC_LINE = /^\[(\d+),(\d+)\](.*)$/
const YRC_WORD = /\((\d+),(\d+),\d+\)([^()]*)/g

const toMs = (m: string, s: string, f?: string) => {
  const ms = f ? Number(f.padEnd(3, '0')) : 0
  return Number(m) * 60000 + Number(s) * 1000 + ms
}

/** 增强型 LRC：整首歌解析 */
export const parseEnhancedLrc = (raw: string): WordLine[] | null => {
  if (!raw || raw.indexOf('<') === -1) return null
  const out: WordLine[] = []
  for (const rawLine of raw.split(/\r\n|\n|\r/)) {
    const line = rawLine.trim()
    const head = A2_LINE.exec(line)
    if (!head) continue
    const lineTime = toMs(head[1], head[2], head[3])
    const body = head[4]
    const words: WordTiming[] = []
    A2_WORD.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = A2_WORD.exec(body)) != null) {
      const start = toMs(m[1], m[2], m[3])
      const text = m[4]
      if (!text) continue
      words.push({ start, end: start, text })
    }
    if (!words.length) continue
    // 每个字的结束时间 = 下一个字的开始时间
    for (let i = 0; i < words.length - 1; i++) words[i].end = words[i + 1].start
    words[words.length - 1].end = words[words.length - 1].start + 400
    out.push({
      time: lineTime,
      duration: words[words.length - 1].end - lineTime,
      text: words.map(w => w.text).join(''),
      words,
    })
  }
  return out.length ? out : null
}

/** YRC：整首歌解析 */
export const parseYrc = (raw: string): WordLine[] | null => {
  if (!raw || raw.indexOf('(') === -1) return null
  const out: WordLine[] = []
  for (const rawLine of raw.split(/\r\n|\n|\r/)) {
    const line = rawLine.trim()
    const head = YRC_LINE.exec(line)
    if (!head) continue
    const lineTime = Number(head[1])
    const lineDuration = Number(head[2])
    const words: WordTiming[] = []
    YRC_WORD.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = YRC_WORD.exec(head[3])) != null) {
      const start = Number(m[1])
      const dur = Number(m[2])
      const text = m[3]
      if (!text) continue
      words.push({ start, end: start + dur, text })
    }
    if (!words.length) continue
    out.push({
      time: lineTime,
      duration: lineDuration || (words[words.length - 1].end - lineTime),
      text: words.map(w => w.text).join(''),
      words,
    })
  }
  return out.length ? out : null
}

/** 自动识别格式 */
export const parseWordLyric = (raw?: string | null): WordLine[] | null => {
  if (!raw) return null
  return parseYrc(raw) ?? parseEnhancedLrc(raw)
}

/**
 * 没有字级数据时的估算：
 * 按「字符视觉宽度」而不是字符个数分配时长，中英混排时更接近真实演唱节奏。
 * 中日韩字符 = 1，拉丁字母/数字 = 0.55，空格 = 0.3，标点 = 0.4。
 */
export const estimateCharWeights = (text: string): number[] => {
  const chars = Array.from(text)
  return chars.map((ch) => {
    if (/\s/.test(ch)) return 0.3
    if (/[\u2E80-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\uFF00-\uFFEF]/.test(ch)) return 1
    if (/[,.!?;:'"，。！？；：、（）()《》\-—…]/.test(ch)) return 0.4
    return 0.55
  })
}

/** 把 (0..1) 的行进度映射成「当前应该亮到第几个字」的下标（0..len） */
export const progressToCharIndex = (weights: number[], progress: number): number => {
  if (progress <= 0) return 0
  if (progress >= 1) return weights.length
  const total = weights.reduce((a, b) => a + b, 0)
  const target = total * progress
  let acc = 0
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]
    if (acc >= target) return i + 1
  }
  return weights.length
}