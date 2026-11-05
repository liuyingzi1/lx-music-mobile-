import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  AppState,
  Easing,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

import Text from '@/components/common/Text'

import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import StatusBar from '@/components/common/StatusBar'
import PageContent from '@/components/PageContent'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { useStatusbarHeight } from '@/store/common/hook'
import { pop } from '@/navigation'
import { playNextInList, playPrevInList } from './playInList'

import Header from './components/Header'
import Lyric from './Lyric'
import ImmersiveBackground from './ImmersiveBackground'
import FloatingCard from './FloatingCard'
import { LYRIC_STYLES, loadImmersivePrefs, setLyricStyle, useLyricStyle } from './theme'

/** 顶部栏无操作自动隐藏时间 */
const AUTO_HIDE_DELAY = 5000
/** 上下滑切歌触发阈值 */
const SWITCH_THRESHOLD = 45
/** 右侧返回手势热区 */
const EDGE_ZONE = 0.15
/** 右滑返回触发阈值 */
const BACK_THRESHOLD = 50

/**
 * 横屏播放页 · Folia 风格（v2）
 *
 * 布局只有三层：
 *   1. ImmersiveBackground  模糊封面 + 呼吸光晕
 *   2. 全屏歌词（可滚动）    点一下切换顶部栏显隐
 *   3. 悬浮播放卡片          封面 + 歌名 + 进度 + 上一首/播放/下一首 + 主题切换
 *   （顶部 Header 默认隐藏，点屏幕呼出）
 *
 * 手势：
 *   - 右侧 15% 左滑      → 退出播放页（挂在最外层祖先上，不影响歌词滚动）
 *   - 在悬浮卡片上上下滑 → 上一首 / 下一首
 *   - 点歌词区           → 顶部栏显隐
 */
export default memo(({ componentId }: { componentId: string }) => {
  const statusBarHeight = useStatusbarHeight()
  const { width: winWidth } = useWindowDimensions()

  useEffect(() => {
    setComponentId(COMPONENT_IDS.playDetail, componentId)
    screenkeepAwake()
    loadImmersivePrefs()

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------- 顶部栏显隐
  const [uiVisible, setUiVisible] = useState(false)
  const [uiInteractive, setUiInteractive] = useState(false)
  const uiVisibleRef = useRef(false)
  const uiAnim = useRef(new Animated.Value(0)).current
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHideTimer = useCallback(() => {
    if (!hideTimer.current) return
    clearTimeout(hideTimer.current)
    hideTimer.current = null
  }, [])

  const toggleUI = useCallback(() => {
    setUiVisible(prev => !prev)
  }, [])

  useEffect(() => {
    uiVisibleRef.current = uiVisible
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
    transform: [{
      translateY: uiAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }),
    }],
  }), [uiAnim])

  const controlPointer = uiInteractive ? 'auto' : ('none' as const)

  // ---------------------------------------------------------------- 切歌动效
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
      void (dir === 1 ? playNextInList() : playPrevInList())
      switchAnim.setValue(dir)
      Animated.spring(switchAnim, {
        toValue: 0,
        friction: 8,
        tension: 55,
        useNativeDriver: true,
      }).start(() => { switchingRef.current = false })
    })
  }, [switchAnim])

  const lyricSwitchStyle = useMemo(() => ({
    opacity: switchAnim.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0.15, 1, 0.15],
      extrapolate: 'clamp' as const,
    }),
    transform: [{
      translateY: switchAnim.interpolate({
        inputRange: [-1, 1],
        outputRange: [-46, 46],
      }),
    }],
  }), [switchAnim])

  // ---------------------------------------------------------------- 手势
  const goBack = useCallback(() => {
    const id = commonState.componentIds.playDetail
    if (id) void pop(id)
  }, [])

  const edgeStartRef = useRef(false)

  const edgePan = useMemo(() => Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-28, 28])
    .onBegin((e) => {
      edgeStartRef.current = e.x >= winWidth * (1 - EDGE_ZONE)
    })
    .onEnd((e) => {
      if (!edgeStartRef.current) return
      edgeStartRef.current = false
      if (e.translationX < -BACK_THRESHOLD) goBack()
    })
    .onFinalize(() => { edgeStartRef.current = false }),
  [goBack, winWidth])

  const cardPan = useMemo(() => Gesture.Pan()
    .activeOffsetY([-22, 22])
    .failOffsetX([-45, 45])
    .onEnd((e) => {
      if (e.translationY <= -SWITCH_THRESHOLD) switchMusic(1)
      else if (e.translationY >= SWITCH_THRESHOLD) switchMusic(-1)
    }),
  [switchMusic])

  const lyricTap = useMemo(() => Gesture.Tap()
    .maxDuration(280)
    .onEnd((_e, success) => { if (success) toggleUI() }),
  [toggleUI])

  const cardWidth = Math.min(winWidth * 0.62, 820)

  const [styleOpen, setStyleOpen] = useState(false)
  const style = useLyricStyle()

  return (
    <PageContent>
      <StatusBar />
      <GestureDetector gesture={edgePan}>
        <View style={styles.root}>
          <ImmersiveBackground />

          {/* 全屏歌词 */}
          <GestureDetector gesture={lyricTap}>
            <Animated.View style={[styles.lyricWrap, lyricSwitchStyle]}>
              <Lyric />
            </Animated.View>
          </GestureDetector>

          {/* 顶部栏（默认隐藏） */}
          <Animated.View
            style={[styles.header, { paddingTop: statusBarHeight }, headerStyle]}
            pointerEvents={controlPointer}
          >
            <Header />
          </Animated.View>

          {/* 歌词样式选择 */}
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
                      onPress={() => {
                        setLyricStyle(item.id)
                        setStyleOpen(false)
                      }}
                    >
                      <Text size={11} color={active ? '#FFFFFF' : 'rgba(255,255,255,0.7)'}>{item.name}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              )
            : null}

          {/* 悬浮播放卡片 */}
          <GestureDetector gesture={cardPan}>
            <View style={styles.cardOuter} pointerEvents="box-none">
              <View style={{ width: cardWidth }}>
                <FloatingCard onToggleStyle={() => { setStyleOpen(v => !v) }} />
              </View>
            </View>
          </GestureDetector>
        </View>
      </GestureDetector>
    </PageContent>
  )
})

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  lyricWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  cardOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
  },
  styleRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 104,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
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