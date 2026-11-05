import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  AppState,
  Easing,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import StatusBar from '@/components/common/StatusBar'
import PageContent from '@/components/PageContent'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { useStatusbarHeight } from '@/store/common/hook'
import { useIsPlay } from '@/store/player/hook'
import { pop } from '@/navigation'
import { playNext, playPrev } from '@/core/player/player'
import MoreBtn from './MoreBtn'
import Header from './components/Header'
import Pic from './Pic'
import Lyric from './Lyric'
import Player from './Player'
import ImmersiveBackground from './ImmersiveBackground'
import { marginLeftRaw } from './constant'

/** 控件无操作自动隐藏时间 */
const AUTO_HIDE_DELAY = 5000
/** 上下滑切歌触发阈值 */
const SWITCH_THRESHOLD = 50
/** 右侧返回手势热区：屏幕右侧的百分比（0.15 = 最右 15%） */
const EDGE_ZONE = 0.15
/** 右滑返回触发阈值 */
const BACK_THRESHOLD = 50

/**
 * 横屏播放页 · 沉浸式版本
 *
 * 布局分层（从下到上）：
 *   0. ImmersiveBackground  模糊封面 + 呼吸光晕
 *   1. Pressable            全屏点击层（空白处点击切换控件显隐）
 *   2. 左栏 left            box-none：只有子元素吃触摸，空白处会"漏"给第 1 层
 *   3. 右栏 right           歌词列表，自带水平 Tap（点歌词也能切换显隐）
 *
 * 手势分层：
 *   - edgePan  ：挂在最外层（祖先），只处理水平位移 → 右边 15% 左滑返回。
 *                因为挂在祖先上，所以不会挡住歌词列表的纵向滚动。
 *   - coverPan ：挂在封面容器上，纵向 50px → 上一首/下一首。
 *   - coverTap ：同一容器上的点击 → 切换控件显隐。
 *
 * 为什么切歌手势只做在封面区（左 45%）而不是全屏：
 *   歌词列表本身是要纵向滚动的，全屏 Pan 会和 FlatList 抢手势，
 *   要么歌词滚不动，要么一滑就切歌。Folia 本身也是"在封面上滑"。
 *   如果确实要全屏，见 docs/INTEGRATION.md 的「手势仲裁」一节。
 */
export default memo(({ componentId }: { componentId: string }) => {
  const statusBarHeight = useStatusbarHeight()
  const { width: winWidth } = useWindowDimensions()
  const isPlay = useIsPlay()

  // ---------------------------------------------------------------- 原有逻辑
  useEffect(() => {
    setComponentId(COMPONENT_IDS.playDetail, componentId)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------- 控件显隐
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

  const scheduleHide = useCallback(() => {
    clearHideTimer()
    hideTimer.current = setTimeout(() => { setUiVisible(false) }, AUTO_HIDE_DELAY)
  }, [clearHideTimer])

  /** 任何一次交互都要把 5s 计时器重置 */
  const bump = useCallback(() => {
    if (uiVisibleRef.current) scheduleHide()
  }, [scheduleHide])

  const toggleUI = useCallback(() => {
    setUiVisible(prev => !prev)
  }, [])

  useEffect(() => {
    uiVisibleRef.current = uiVisible
    if (uiVisible) {
      setUiInteractive(true)
      scheduleHide()
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
  }, [clearHideTimer, scheduleHide, uiAnim, uiVisible])

  useEffect(() => clearHideTimer, [clearHideTimer])

  const headerAnimStyle = useMemo(() => ({
    opacity: uiAnim,
    transform: [{
      translateY: uiAnim.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }),
    }],
  }), [uiAnim])

  const playerAnimStyle = useMemo(() => ({
    opacity: uiAnim,
    transform: [{
      translateY: uiAnim.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }),
    }],
  }), [uiAnim])

  /** 控件不可见时彻底不接管触摸，避免"看不见但点得到" */
  const controlPointer = uiInteractive ? 'auto' : ('none' as const)

  // ---------------------------------------------------------------- 封面微动效
  const floatAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!isPlay) {
      // 暂停时缓慢归位，而不是硬停在中途
      Animated.timing(floatAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start()
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => { loop.stop() }
  }, [floatAnim, isPlay])

  const coverAnimStyle = useMemo(() => ({
    transform: [
      { translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -9] }) },
      { rotate: floatAnim.interpolate({ inputRange: [0, 1], outputRange: ['-1.1deg', '1.1deg'] }) },
      { scale: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] }) },
    ],
  }), [floatAnim])

  // ---------------------------------------------------------------- 切歌动效
  const switchAnim = useRef(new Animated.Value(0)).current
  const switchingRef = useRef(false)

  const switchMusic = useCallback((dir: 1 | -1) => {
    if (switchingRef.current) return
    switchingRef.current = true
    // dir = 1（上滑）→ 封面向上飞走，播下一首；dir = -1（下滑）→ 播上一首
    Animated.timing(switchAnim, {
      toValue: -dir,
      duration: 190,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      void (dir === 1 ? playNext() : playPrev())
      switchAnim.setValue(dir)
      Animated.spring(switchAnim, {
        toValue: 0,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }).start(() => { switchingRef.current = false })
    })
  }, [switchAnim])

  const switchStyle = useMemo(() => ({
    opacity: switchAnim.interpolate({
      inputRange: [-1, -0.55, 0, 0.55, 1],
      outputRange: [0, 0.4, 1, 0.4, 0],
      extrapolate: 'clamp' as const,
    }),
    transform: [{
      translateY: switchAnim.interpolate({
        inputRange: [-1, 1],
        outputRange: [-170, 170],
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
      // e.x 是相对整个屏幕的坐标
      edgeStartRef.current = e.x >= winWidth * (1 - EDGE_ZONE)
    })
    .onEnd((e) => {
      if (!edgeStartRef.current) return
      edgeStartRef.current = false
      if (e.translationX < -BACK_THRESHOLD) goBack()
    })
    .onFinalize(() => { edgeStartRef.current = false }),
  [goBack, winWidth])

  const coverPan = useMemo(() => Gesture.Pan()
    .activeOffsetY([-20, 20])
    .failOffsetX([-30, 30])
    .onStart(() => { bump() })
    .onEnd((e) => {
      if (e.translationY <= -SWITCH_THRESHOLD) switchMusic(1)
      else if (e.translationY >= SWITCH_THRESHOLD) switchMusic(-1)
    }),
  [bump, switchMusic])

  const coverTap = useMemo(() => Gesture.Tap()
    .maxDuration(260)
    .onEnd((_e, success) => { if (success) toggleUI() }),
  [toggleUI])

  const lyricTap = useMemo(() => Gesture.Tap()
    .maxDuration(260)
    .onEnd((_e, success) => { if (success) toggleUI() }),
  [toggleUI])

  const coverGesture = useMemo(
    () => Gesture.Race(coverTap, coverPan),
    [coverPan, coverTap],
  )

  return (
    <PageContent>
      <StatusBar />
      <GestureDetector gesture={edgePan}>
        <View style={styles.root}>
          <ImmersiveBackground />

          {/* 点击层：接管所有"空白处"的单击 */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={toggleUI}
            android_disableSound
          />

          {/* 左栏：box-none 让空白处的触摸漏到上面的 Pressable */}
          <View
            style={[styles.left, { paddingTop: statusBarHeight }]}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[styles.header, headerAnimStyle]}
              pointerEvents={controlPointer}
              onStartShouldSetResponderCapture={() => { bump(); return false }}
            >
              <Header />
            </Animated.View>

            <View style={styles.leftContent}>
              {/*
                MoreBtn 的根节点是 position:absolute + height:'100%'，
                它的定位上下文必须是 leftContent；外面再包一层会把它的绝对定位基准改掉，
                所以这里不做显隐动画（需求也只要求隐藏 Player 和 Header）。
                想让它们一起淡出的话，给 MoreBtn 加一个 style 透传，再套 Animated.View。
              */}
              <MoreBtn />

              <GestureDetector gesture={coverGesture}>
                <Animated.View style={[switchStyle]}>
                  <Animated.View style={coverAnimStyle}>
                    <Pic componentId={componentId} />
                  </Animated.View>
                </Animated.View>
              </GestureDetector>
            </View>

            <Animated.View
              style={[styles.player, playerAnimStyle]}
              pointerEvents={controlPointer}
              onStartShouldSetResponderCapture={() => { bump(); return false }}
            >
              <Player />
            </Animated.View>
          </View>

          {/* 右栏：歌词 */}
          <GestureDetector gesture={lyricTap}>
            <View style={styles.right}>
              <Lyric />
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
    flexDirection: 'row',
  },
  left: {
    flex: 1,
    width: '45%',
    paddingBottom: 10,
  },
  leftContent: {
    flexShrink: 1,
    flexGrow: 0,
    marginLeft: marginLeftRaw,
  },
  header: {
    flexGrow: 0,
    flexShrink: 0,
  },
  player: {
    flexGrow: 1,
    flexShrink: 0,
  },
  right: {
    width: '55%',
    flexGrow: 0,
    flexShrink: 0,
  },
})
