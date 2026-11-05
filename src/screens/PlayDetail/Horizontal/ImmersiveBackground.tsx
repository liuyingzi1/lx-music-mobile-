import { memo, useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'

import { useIsPlay, usePlayerMusicInfo } from '@/store/player/hook'
import { useImmersiveTheme } from './theme'

/**
 * 沉浸式动态背景（v2）
 *
 * 与 v1 的差别：呼吸薄纱的颜色改成跟随「沉浸式主题」，不再跟 App 主题走，
 * 这样切主题时整屏色调会一起变（极光=青、落日=橙、星云=紫、极简=灰白）。
 *
 * 模糊用 RN 自带的 <Image blurRadius>，不引 @react-native-community/blur：
 * 那个库在 Android 12+ 依赖已废弃的 RenderScript，全屏背景上很容易一片黑。
 */
export default memo(() => {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const theme = useImmersiveTheme()

  const zoom = useRef(new Animated.Value(0)).current
  const breath = useRef(new Animated.Value(0)).current

  // 封面的缓慢缩放：让静止的画面 "活着"
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(zoom, {
          toValue: 1,
          duration: 20000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(zoom, {
          toValue: 0,
          duration: 20000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => { loop.stop() }
  }, [zoom])

  // 呼吸渐变：播放时幅度大，暂停时收敛
  useEffect(() => {
    const duration = isPlay ? 5200 : 9000
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => { loop.stop() }
  }, [breath, isPlay])

  const scale = zoom.interpolate({ inputRange: [0, 1], outputRange: [1.22, 1.38] })

  const veilOpacity = breath.interpolate({
    inputRange: [0, 1],
    outputRange: isPlay ? [0.05, 0.18] : [0.03, 0.09],
  })
  const veilScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] })

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />

      {musicInfo.pic
        ? (
          <Animated.Image
            blurRadius={25}
            fadeDuration={380}
            resizeMode="cover"
            source={{ uri: musicInfo.pic }}
            style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}
          />
          )
        : null}

      {/* 压暗，保证白色歌词可读 */}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />

      {/* 主题色呼吸光晕 */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: theme.veil,
            opacity: veilOpacity,
            transform: [{ scale: veilScale }],
          },
        ]}
      />

      <FadeEdge from="top" color="rgba(0,0,0,0.55)" />
      <FadeEdge from="bottom" color="rgba(0,0,0,0.78)" />
    </View>
  )
})

/** 用多条等宽色带模拟线性渐变，8 段之后肉眼基本看不出接缝 */
const FadeEdge = memo(({ from, color }: { from: 'top' | 'bottom', color: string }) => {
  const steps = 8
  const alpha = Number(color.match(/[\d.]+(?=\))/)?.[0] ?? 0.5)
  const rgb = color.match(/\d+,\d+,\d+/)?.[0] ?? '0,0,0'
  return (
    <View
      style={[styles.edge, from === 'top' ? { top: 0 } : { bottom: 0 }]}
      pointerEvents="none"
    >
      {Array.from({ length: steps }, (_, i) => {
        // top：第 0 条（最上方）最黑；bottom：最后一条（最下方）最黑
        const index = from === 'top' ? steps - 1 - i : i
        const a = alpha * ((index + 1) / steps) ** 2
        return (
          <View
            key={i}
            style={{ flex: 1, backgroundColor: `rgba(${rgb},${a.toFixed(3)})` }}
          />
        )
      })}
    </View>
  )
})

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '28%',
  },
})