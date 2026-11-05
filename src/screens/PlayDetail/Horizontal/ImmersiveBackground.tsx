import { memo, useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'

import { useIsPlay, usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'

/**
 * 沉浸式动态背景
 *
 * 设计要点（为什么不用 @react-native-community/blur 作为默认方案）：
 * 1. RN 自带的 <Image blurRadius> 在 iOS / Android 都是原生高斯模糊，零新增原生依赖；
 * 2. @react-native-community/blur 的 Android 端在 API 31+ 上依赖被废弃的 RenderScript，
 *    经常出现「一片黑 / 不模糊 / 掉帧」，做全屏背景风险很高，更适合做小面积的毛玻璃面板。
 *
 * 如果你仍然想用 BlurView，把 <Animated.Image> 换成：
 *   <BlurView style={StyleSheet.absoluteFill} blurType="dark" blurAmount={25} reducedTransparencyFallbackColor="black" />
 * 并注意：Android 上 blurAmount 会被 clamp 到 25，且需要 API 21+。
 *
 * 动画层：
 *   - 底层：模糊封面，缓慢 Ken-Burns 缩放（20s 一个来回）
 *   - 中层：主题色「呼吸」薄纱，6s 一呼一吸（歌曲暂停时降低幅度）
 *   - 上层：底部渐隐 + 顶部渐隐，保证控件与歌词的可读性
 */
export default memo(() => {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const theme = useTheme()

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

  // 呼吸渐变：播放时幅度大，暂停时收敛（像呼吸变浅）
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

  // 呼吸薄纱的透明度：暂停时压到很低的区间
  const veilOpacity = breath.interpolate({
    inputRange: [0, 1],
    outputRange: isPlay ? [0.03, 0.14] : [0.02, 0.06],
  })

  // 呼吸薄纱的缩放：产生"光晕扩散"的错觉
  const veilScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] })

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />

      {/* 1. 模糊封面（RN 原生高斯模糊，双平台可用） */}
      {musicInfo.pic
        ? (
          <Animated.Image
            // Android 上 blurRadius > 25 会被截断，25 已经足够"糊"
            blurRadius={25}
            fadeDuration={380}
            resizeMode="cover"
            source={{ uri: musicInfo.pic }}
            style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}
          />
          )
        : null}

      {/* 2. 压暗，保证前景可读 */}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />

      {/* 3. 主题色呼吸光晕（整屏纯色 + 极低透明度，没有硬边缘） */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: theme['c-primary'],
            opacity: veilOpacity,
            transform: [{ scale: veilScale }],
          },
        ]}
      />

      {/* 4. 上下渐隐，模拟线性渐变（不引入 react-native-linear-gradient 也能用） */}
      <FadeEdge from="top" color="rgba(0,0,0,0.55)" />
      <FadeEdge from="bottom" color="rgba(0,0,0,0.72)" />
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
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '28%',
  },
})
