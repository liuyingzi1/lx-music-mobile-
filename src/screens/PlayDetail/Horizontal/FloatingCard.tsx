import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import Slider from '@react-native-community/slider'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useIsPlay, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { togglePlay } from '@/core/player/player'
import { playNextInList, playPrevInList } from './playInList'
import { getKaraokeTime } from '@/utils/lyric/playClock'
import { cycleImmersiveTheme, useImmersiveTheme } from './theme'

/**
 * 底部悬浮播放卡片（Folia 风格）
 *
 * 整块是一张半透明圆角卡片：封面缩略图 + 正在播放 + 歌名 + 进度 + 三个按钮 + 主题切换点。
 * 卡片本身不吸底、不占位，浮在歌词上方，靠 index.tsx 里的绝对定位摆放。
 */

const fmt = (ms: number) => {
  if (!ms || ms < 0) return '00:00'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
}

export default memo(({ onToggleStyle }: { onToggleStyle?: () => void }) => {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const progress = useProgress()
  const theme = useImmersiveTheme()

  const duration = progress.maxPlayTime || 0
  const [now, setNow] = useState(progress.nowPlayTime)
  const [dragging, setDragging] = useState(false)
  const dragValueRef = useRef(0)
  const [dragValue, setDragValue] = useState(0)

  // 暂停 / 跳转时以 store 为准
  useEffect(() => {
    if (dragging) return
    setNow(progress.nowPlayTime)
  }, [dragging, progress.nowPlayTime])

  // 播放中用平滑时钟推进（比 store 的更新频率高，进度条不会一跳一跳）
  useEffect(() => {
    if (!isPlay) return
    const timer = setInterval(() => {
      if (dragging) return
      setNow(getKaraokeTime())
    }, 250)
    return () => { clearInterval(timer) }
  }, [dragging, isPlay])

  const handleSlidingStart = useCallback(() => {
    setDragging(true)
  }, [])

  const handleValueChange = useCallback((value: number) => {
    dragValueRef.current = value
    setDragValue(value)
  }, [])

  const handleSlidingComplete = useCallback((value: number) => {
    setDragging(false)
    setNow(value)
    global.app_event.setProgress(value)
  }, [])

  const displayValue = dragging ? dragValue : now

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Image url={musicInfo.pic} style={styles.cover} />

      <View style={styles.info}>
        <Text size={9} color="rgba(255,255,255,0.45)" numberOfLines={1}>正在播放</Text>
        <Text size={13} color="#FFFFFF" numberOfLines={1} style={styles.title}>
          {musicInfo.name || '未播放'}
          {musicInfo.singer ? <Text size={11} color="rgba(255,255,255,0.55)">{`  ${musicInfo.singer}`}</Text> : null}
        </Text>

        <View style={styles.progressRow}>
          <Text size={9} color="rgba(255,255,255,0.5)">{fmt(displayValue)}</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={Math.max(duration, 1)}
            value={displayValue}
            minimumTrackTintColor={theme.primary}
            maximumTrackTintColor="rgba(255,255,255,0.18)"
            thumbTintColor="#FFFFFF"
            onSlidingStart={handleSlidingStart}
            onValueChange={handleValueChange}
            onSlidingComplete={handleSlidingComplete}
          />
          <Text size={9} color="rgba(255,255,255,0.5)">{fmt(duration)}</Text>
        </View>
      </View>

      <View style={styles.btns}>
        <TouchableOpacity style={styles.btn} activeOpacity={0.5} onPress={playPrevInList}>
          <Icon name="prevMusic" color="#FFFFFF" rawSize={16} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} activeOpacity={0.5} onPress={togglePlay}>
          <Icon name={isPlay ? 'pause' : 'play'} color={theme.primary} rawSize={18} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} activeOpacity={0.5} onPress={playNextInList}>
          <Icon name="nextMusic" color="#FFFFFF" rawSize={16} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.styleBtn} activeOpacity={0.6} onPress={onToggleStyle}>
          <Text size={10} color="rgba(255,255,255,0.85)">样式</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.themeBtn} activeOpacity={0.6} onPress={cycleImmersiveTheme}>
          <View style={[styles.themeDot, { backgroundColor: theme.primary }]} />
        </TouchableOpacity>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cover: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  info: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  title: {
    marginTop: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  slider: {
    flex: 1,
    height: 22,
    marginHorizontal: 6,
  },
  btns: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeBtn: {
    width: 30,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  styleBtn: {
    height: 34,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    opacity: 0.9,
  },
})