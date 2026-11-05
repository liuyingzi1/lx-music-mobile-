import { memo, useEffect, useRef, useState } from 'react'
import {
  Animated,
  StyleSheet,
  Text as RNText,
  View,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native'

import { type Line } from '@/plugins/lyric'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { setSpText } from '@/utils/pixelRatio'
import { getKaraokeTime } from '@/utils/lyric/playClock'
import { estimateCharWeights, type WordTiming } from '@/utils/lyric/wordLyric'

/**
 * 逐字（卡拉 OK）歌词行
 *
 * 原理：同一行渲染两遍
 *   - 底层：暗色，占据真实布局尺寸
 *   - 上层：高亮色（主色 + 发光），放在一个 overflow:hidden 的容器里，
 *           容器的宽度按播放进度从 0 增长到整行宽度 —— 于是"高亮"就像被笔刷从左刷到右
 *
 * 为什么不用逐字 <Text> 数组 + 每字改 color：
 *   一行 30 个字就是 30 个 Animated 节点，color 无法走 native driver，
 *   每帧 JS 桥 + 文本重排，中低端机会明显掉帧。
 *   这里只动 1 个节点的 width，代价小一个数量级。
 *
 * 用法：替换 Lyric.tsx 里的 LrcLine（见 docs/INTEGRATION.md）
 */

export interface KaraokeLineProps {
  line: Line
  /** 下一行的开始时间（ms），用来推算本行"演唱时长" */
  nextTime: number
  lineNum: number
  activeLine: number
  onLayout: (lineNum: number, height: number, width: number) => void
  /** 可选：有真实字级时间戳时传入（yrc / 增强型 LRC） */
  words?: WordTiming[] | null
}

const KaraokeLine = memo(({ line, nextTime, lineNum, activeLine, onLayout, words }: KaraokeLineProps) => {
  const theme = useTheme()
  const lrcFontSize = useSettingValue('playDetail.horizontal.style.lrcFontSize')
  const textAlign = useSettingValue('playDetail.style.align')

  const size = lrcFontSize / 10
  const fontSize = setSpText(size)
  const lineHeight = fontSize * 1.3

  const isActive = activeLine === lineNum

  const [textWidth, setTextWidth] = useState(0)
  const [isWrapped, setIsWrapped] = useState(false)
  const clipWidth = useRef(new Animated.Value(0)).current

  const handleLayout = (e: LayoutChangeEvent) => {
    onLayout(lineNum, e.nativeEvent.layout.height, e.nativeEvent.layout.width)
  }

  // 用 onTextLayout 拿到"字形实际宽度"（Text 的 onLayout 拿到的是容器宽度，没用）
  const handleTextLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    const lines = e.nativeEvent.lines
    setIsWrapped(lines.length > 1)
    const w = lines[0]?.width ?? 0
    setTextWidth(prev => (Math.abs(prev - w) > 0.5 ? w : prev))
  }

  useEffect(() => {
    // 只有「当前行」才做擦除；已唱过 / 还没到的行保持暗色（和主流播放器一致）
    if (!isActive) {
      clipWidth.setValue(0)
      return
    }
    if (!textWidth) return

    const startTime = words?.length ? words[0].start : line.time
    const endTime = (() => {
      if (words?.length) return words[words.length - 1].end
      // 没有字级数据：用行间隔估算。间隔过长（间奏）时截断，
      // 否则高亮会以极慢的速度爬过整行，观感很差。
      // 权重按「视觉宽度」算，中英混排比按字数更接近真实语速。
      const gap = (nextTime > line.time ? nextTime : line.time + 3000) - line.time
      const weight = estimateCharWeights(line.text).reduce((a, b) => a + b, 0)
      return line.time + Math.min(gap, weight * 320 + 260)
    })()
    const phrase = Math.max(endTime - startTime, 1)

    let raf = 0
    const tick = () => {
      const elapsed = getKaraokeTime() - startTime
      const p = Math.min(1, Math.max(0, elapsed / phrase))
      clipWidth.setValue(textWidth * p)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf) }
  }, [clipWidth, isActive, line.time, line.text, nextTime, textWidth, words])

  // 行包裹（超长换行）时，横向擦除会错位，退化为整行变色
  const useWipe = !isWrapped && textWidth > 0

  const dimColor = theme['c-350']
  const dimOpacity = isActive ? 0.55 : 0.34

  return (
    <View style={styles.line} onLayout={handleLayout}>
      <View style={styles.center}>
        <View style={styles.anchor}>
          {/* 底层：暗色，负责撑开布局、测量字形宽度 */}
          <RNText
            allowFontScaling={false}
            onTextLayout={handleTextLayout}
            style={{
              fontSize,
              lineHeight,
              textAlign,
              color: dimColor,
              opacity: dimOpacity,
            }}
          >
            {line.text}
          </RNText>

          {/* 上层：高亮，被容器宽度裁剪 */}
          {useWipe
            ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.clip, { width: clipWidth, height: lineHeight + 2 }]}
              >
                <RNText
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{
                    width: textWidth,
                    fontSize,
                    lineHeight,
                    textAlign,
                    color: theme['c-primary'],
                    // 发光：iOS 原生支持；Android 需要 API 28+
                    textShadowColor: theme['c-primary'],
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 10,
                    // 注意：不要在这里改 fontWeight，字重变化会改变字形宽度，
                    // 和高亮层的固定 width 对不上，会把最后一个字裁掉。
                  }}
                >
                  {line.text}
                </RNText>
              </Animated.View>
              )
            : null}

          {/* 退化模式：无宽度数据 / 换行，直接整行变色 */}
          {!useWipe && isActive
            ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <RNText
                  allowFontScaling={false}
                  style={{
                    fontSize,
                    lineHeight,
                    textAlign,
                    color: theme['c-primary'],
                    textShadowColor: theme['c-primary'],
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 10,
                  }}
                >
                  {line.text}
                </RNText>
              </View>
              )
            : null}
        </View>
      </View>

      {/* 翻译 / 音译 */}
      {line.extendedLyrics.map((lrc, index) => (
        <RNText
          allowFontScaling={false}
          key={index}
          style={{
            marginTop: 5,
            fontSize: fontSize * 0.8,
            lineHeight: lineHeight * 0.8,
            textAlign,
            color: isActive ? theme['c-primary-alpha-200'] : theme['c-300'],
            opacity: isActive ? 0.92 : 0.5,
          }}
        >
          {lrc}
        </RNText>
      ))}
    </View>
  )
})

export default KaraokeLine

const styles = StyleSheet.create({
  line: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  center: {
    alignItems: 'center',
  },
  anchor: {
    position: 'relative',
  },
  clip: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
})
