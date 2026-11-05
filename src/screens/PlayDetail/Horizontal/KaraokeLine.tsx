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
 * 只动 1 个节点的 width，比「每个字一个 Animated 节点」省一个数量级的开销。
 */

export interface KaraokeLineProps {
  line: Line
  nextTime: number
  lineNum: number
  activeLine: number
  onLayout: (lineNum: number, height: number, width: number) => void
  words?: WordTiming[] | null
  /** 字号倍率 */
  fontScale?: number
  /** 高亮颜色 */
  activeColor?: string
  /** 未激活文字颜色 */
  dimColor?: string
  /** 未激活透明度 */
  dimOpacity?: number
  /** 对齐（覆盖设置里的对齐） */
  align?: 'center' | 'left' | 'right'
  /** 画倒影（镜台样式） */
  mirror?: boolean
  /** 当前样式下不显示这一行 */
  hidden?: boolean
}

const KaraokeLine = memo(({
  line,
  nextTime,
  lineNum,
  activeLine,
  onLayout,
  words,
  fontScale,
  activeColor,
  dimColor,
  dimOpacity,
  align,
  mirror,
  hidden,
}: KaraokeLineProps) => {
  const theme = useTheme()
  const lrcFontSize = useSettingValue('playDetail.horizontal.style.lrcFontSize')
  const settingAlign = useSettingValue('playDetail.style.align')

  const scale = fontScale ?? 1
  const size = (lrcFontSize / 10) * scale
  const fontSize = setSpText(size)
  const lineHeight = fontSize * 1.3
  const textAlign = align ?? settingAlign

  const isActive = activeLine === lineNum

  const [textWidth, setTextWidth] = useState(0)
  const [isWrapped, setIsWrapped] = useState(false)
  const clipWidth = useRef(new Animated.Value(0)).current

  const highlightColor = activeColor ?? theme['c-primary']

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
    if (!isActive) {
      clipWidth.setValue(0)
      return
    }
    if (!textWidth) return

    const startTime = words?.length ? words[0].start : line.time
    const endTime = (() => {
      if (words?.length) return words[words.length - 1].end
      const gap = (nextTime > line.time ? nextTime : line.time + 3000) - line.time
      const weight = estimateCharWeights(line.text).reduce((a, b) => a + b, 0)
      return line.time + Math.min(gap, (weight * 320 + 260) * scale)
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
  }, [clipWidth, isActive, line.time, line.text, nextTime, scale, textWidth, words])

  if (hidden) return null

  const useWipe = !isWrapped && textWidth > 0
  const baseDimColor = dimColor ?? theme['c-350']
  const baseDimOpacity = dimOpacity ?? (isActive ? 0.55 : 0.34)

  return (
    <View style={styles.line} onLayout={handleLayout}>
      <View style={[styles.center, { alignItems: textAlign === 'right' ? 'flex-end' : textAlign === 'left' ? 'flex-start' : 'center' }]}>
        <View style={styles.anchor}>
          <RNText
            allowFontScaling={false}
            onTextLayout={handleTextLayout}
            style={{ fontSize, lineHeight, textAlign, color: baseDimColor, opacity: baseDimOpacity }}
          >
            {line.text}
          </RNText>

          {/* 倒影（镜台样式） */}
          {mirror
            ? (
              <View
                pointerEvents="none"
                style={[styles.reflection, { top: lineHeight, width: textWidth || undefined }]}
              >
                <RNText
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{ width: textWidth || undefined, fontSize, lineHeight, textAlign, color: baseDimColor, opacity: 0.5 }}
                >
                  {line.text}
                </RNText>
              </View>
              )
            : null}

          {/* 高亮层：宽度裁剪擦除 */}
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
                    color: highlightColor,
                    textShadowColor: highlightColor,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 10 * scale,
                    // 不要改 fontWeight：字重变化会改变字形宽度，和高亮层的固定 width 对不上
                  }}
                >
                  {line.text}
                </RNText>
              </Animated.View>
              )
            : null}

          {/* 退化模式：无宽度数据 / 换行 */}
          {!useWipe && isActive
            ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <RNText
                  allowFontScaling={false}
                  style={{
                    fontSize,
                    lineHeight,
                    textAlign,
                    color: highlightColor,
                    textShadowColor: highlightColor,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 10 * scale,
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
            color: isActive ? highlightColor : theme['c-300'],
            opacity: isActive ? 0.72 : 0.42,
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
  reflection: {
    position: 'absolute',
    left: 0,
    transform: [{ scaleY: -1 }],
    opacity: 0.16,
  },
})