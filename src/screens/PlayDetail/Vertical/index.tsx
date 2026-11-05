import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  AppState,
  Easing,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import Text from '@/components/common/Text'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { useStatusbarHeight } from '@/store/common/hook'
import { useIsPlay, usePlayerMusicInfo } from '@/store/player/hook'
import { playNext, playPrev } from '@/core/player/player'

import Header from './components/Header'
import Lyric from '../Horizontal/Lyric'
import ImmersiveBackground from '../Horizontal/ImmersiveBackground'
import FloatingCard from '../Horizontal/FloatingCard'
import { LYRIC_STYLES, loadImmersivePrefs, setLyricStyle, useLyricStyle } from '../Horizontal/theme'

/**
 * 竖屏播放页 · 沉浸式（v2）
 *
 * 和横屏同一套视觉：模糊封面背景 + 逐字歌词 + 悬浮播放卡片。
 * 竖屏是上下排布：封面在上，歌词占中间，卡片贴底。
 *
 * 原来的 PagerView（左右滑：封面页 / 歌词页）被去掉了 —— 一屏就能同时看到封面和歌词。
 */

const AUTO_HIDE_DELAY = 5000
const SWITCH_THRESHOLD = 45

export default memo(({ componentId }: { componentId?: string }) => {
  const statusBarHeight = useStatusbarHeight()
  const { width, height } = useWindowDimensions()
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()

  useEffect(() => {
    loadImmersivePrefs()
    screenkeepAwake()
    const appstateListener = AppState.addEventListener('change', (state) => {
      switch (state) {
        case 'active':
          if (!commonState.componentIds.comment) screenkeepAwake()
          break
        case 'background':
          screenUnkeepAwake()
          break
      }
    })
    const handleComponentIdsChange = (ids: CommonState['componentIds']) => {
      if (ids.comment) screenUnkeepAwake()
      else if (AppState.currentState == 'active') screenkeepAwake()
    }
    global.state_event.on('componentIdsUpdated', handleComponentIdsChange)
    return () => {
      global.state_event.off('componentIdsUpdated', handleComponentIdsChange)
      appstateListener.remove()
      screenUnkeepAwake()
    }
  }, [])

  // ---------------------------------------------------------------- 顶部栏显隐
  const [uiVisible, setUiVisible] = useState(false)
  const [uiInteractive, setUiInteractive] = useState(false)
  const uiAnim = useRef(new Animated.Value(0)).current
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHideTimer = useCallback(() => {
    if (!hideTimer.current) return
    clearTimeout(hideTimer.current)
    hideTimer.current = null
  }, [])

  const toggleUI = useCallback(() => { setUiVisible(prev => !prev) }, [])

  useEffect(() => {
    if (uiVisible) {
      setUiInteractive(true)
      clearHideTimer()
      hideTimer.current = setTimeout(() => { setUiVisible(false) }, AUTO_HIDE_DELAY)
    } else {
      clearHideTimer()
    }
    Animated.timing(uiAnim, {
      toValue: uiVisible ? 1 : 0,
      duration: uiVisible ? 240 : 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !uiVisible) setUiInteractive(false)
    })
  }, [clearHideTimer, uiAnim, uiVisible])

  useEffect(() => clearHideTimer, [clearHideTimer])

  const headerStyle = useMemo(() => ({
    opacity: uiAnim,
    transform: [{ translateY: uiAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
  }), [uiAnim])

  const controlPointer = uiInteractive ? 'auto' : ('none' as const)

  // ---------------------------------------------------------------- 封面微动效
  const floatAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!isPlay) {
      Animated.timing(floatAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => { loop.stop() }
  }, [floatAnim, isPlay])

  const coverAnimStyle = useMemo(() => ({
    transform: [
      { translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
      { scale: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) },
    ],
  }), [floatAnim])

  // ---------------------------------------------------------------- 切歌
  const switchAnim = useRef(new Animated.Value(0)).current
  const switchingRef = useRef(false)

  const switchMusic = useCallback((dir: 1 | -1) => {
    if (switchingRef.current) return
    switchingRef.current = true
    Animated.timing(switchAnim, {
      toValue: -dir,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      void (dir === 1 ? playNext() : playPrev())
      switchAnim.setValue(dir)
      Animated.spring(switchAnim, { toValue: 0, friction: 8, tension: 55, useNativeDriver: true })
        .start(() => { switchingRef.current = false })
    })
  }, [switchAnim])

  const switchStyle = useMemo(() => ({
    opacity: switchAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.15, 1, 0.15], extrapolate: 'clamp' as const }),
    transform: [{ translateY: switchAnim.interpolate({ inputRange: [-1, 1], outputRange: [-40, 40] }) }],
  }), [switchAnim])

  const coverPan = useMemo(() => Gesture.Pan()
    .activeOffsetY([-20, 20])
    .failOffsetX([-40, 40])
    .onEnd((e) => {
      if (e.translationY <= -SWITCH_THRESHOLD) switchMusic(1)
      else if (e.translationY >= SWITCH_THRESHOLD) switchMusic(-1)
    }), [switchMusic])

  const lyricTap = useMemo(() => Gesture.Tap()
    .maxDuration(280)
    .onEnd((_e, success) => { if (success) toggleUI() }), [toggleUI])

  // ---------------------------------------------------------------- 样式
  const [styleOpen, setStyleOpen] = useState(false)
  const style = useLyricStyle()

  const coverSize = Math.min(width * 0.62, height * 0.3)

  return (
    <View style={styles.root}>
      <ImmersiveBackground />

      {/* 封面 */}
      <View style={[styles.coverWrap, { paddingTop: statusBarHeight + 8 }]}>
        <GestureDetector gesture={coverPan}>
          <Animated.View style={[switchStyle, coverAnimStyle]}>
            {musicInfo.pic
              ? (
                <Image
                  source={{ uri: musicInfo.pic }}
                  style={{ width: coverSize, height: coverSize, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)' }}
                />
                )
              : <View style={{ width: coverSize, height: coverSize }} />}
          </Animated.View>
        </GestureDetector>
      </View>

      {/* 歌词 */}
      <GestureDetector gesture={lyricTap}>
        <View style={styles.lyricWrap}>
          <Lyric padTop="8%" padH="7%" />
        </View>
      </GestureDetector>

      {/* 样式选择 */}
      {styleOpen
        ? (
          <View style={styles.styleRow} pointerEvents="box-none">
            {LYRIC_STYLES.map(item => {
              const active = item.id === style.id
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => { setLyricStyle(item.id); setStyleOpen(false) }}
                >
                  <Text size={11} color={active ? '#FFFFFF' : 'rgba(255,255,255,0.7)'}>{item.name}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
          )
        : null}

      {/* 悬浮卡片 */}
      <View style={styles.cardWrap} pointerEvents="box-none">
        <FloatingCard onToggleStyle={() => { setStyleOpen(v => !v) }} />
      </View>

      {/* 顶部栏（默认隐藏） */}
      <Animated.View
        style={[styles.header, { paddingTop: statusBarHeight }, headerStyle]}
        pointerEvents={controlPointer}
      >
        <Header />
      </Animated.View>
    </View>
  )
})

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  coverWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lyricWrap: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  cardWrap: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  styleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    marginHorizontal: 4,
    marginVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  chipActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: 'rgba(255,255,255,0.55)',
  },
})