import { useMemo, useEffect, useRef, useCallback } from 'react'
import { View, FlatList, type FlatListProps, type NativeSyntheticEvent, type NativeScrollEvent, type LayoutChangeEvent } from 'react-native'
import { type Line, useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { useSettingValue } from '@/store/setting/hook'
import playerState from '@/store/player/state'
import { scrollTo } from '@/utils/scroll'
import PlayLine, { type PlayLineType } from '../components/PlayLine'
import KaraokeLine from './KaraokeLine'
import { parseWordLyric, type WordLine } from '@/utils/lyric/wordLyric'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useImmersiveTheme, useLyricStyle } from './theme'

/**
 * 横屏歌词列表（v3）
 *
 * 相对上一版：排版由「歌词样式」驱动（theme.ts 里的 LYRIC_STYLES）
 *   - fullScreen / fontScale / 对齐 全部交给样式决定
 *   - visibleRange 控制只显示当前行前后 N 行（聚焦、镜台）
 *
 * 滚动跟随、拖动定位、PlayLine 的接口保持原样。
 */

type FlatListType = FlatListProps<Line>

const wait = async() => new Promise(resolve => setTimeout(resolve, 100))

export default ({ padTop, padH }: { padTop?: string, padH?: string } = {}) => {
  const lyricLines = useLrcSet()
  const { line } = useLrcPlay()
  const musicInfo = usePlayerMusicInfo()
  const theme = useImmersiveTheme()
  const style = useLyricStyle()

  const flatListRef = useRef<FlatList>(null)
  const playLineRef = useRef<PlayLineType>(null)
  const isPauseScrollRef = useRef(true)
  const scrollTimoutRef = useRef<NodeJS.Timeout | null>(null)
  const delayScrollTimeout = useRef<NodeJS.Timeout | null>(null)
  const lineRef = useRef({ line: 0, prevLine: 0 })
  const isFirstSetLrc = useRef(true)
  const scrollInfoRef = useRef<NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'] | null>(null)
  const listLayoutInfoRef = useRef<{ spaceHeight: number, lineHeights: number[] }>({ spaceHeight: 0, lineHeights: [] })
  const scrollCancelRef = useRef<(() => void) | null>(null)
  const isShowLyricProgressSetting = useSettingValue('playDetail.isShowLyricProgressSetting')

  /**
   * 时间 → 字级时间戳 的索引。
   * 洛雪把原始歌词文本放在 musicInfo.lrc；如果音源给的是增强型 LRC（带 <mm:ss.xx>），
   * 这里就能拿到真正的逐字时间。拿不到就返回 null，KaraokeLine 自动走估算模式。
   */
  const wordMap = useMemo(() => {
    const parsed = parseWordLyric(musicInfo.lrc)
    if (!parsed) return null
    const map = new Map<number, WordLine>()
    for (const item of parsed) map.set(item.time, item)
    return map
  }, [musicInfo.lrc])

  const handleScrollToActive = (index = lineRef.current.line) => {
    if (index < 0) return
    if (flatListRef.current) {
      if (scrollInfoRef.current && lineRef.current.line - lineRef.current.prevLine == 1) {
        let offset = listLayoutInfoRef.current.spaceHeight
        for (let line = 0; line < index; line++) {
          offset += listLayoutInfoRef.current.lineHeights[line]
        }
        offset += (listLayoutInfoRef.current.lineHeights[line] ?? 0) / 2
        try {
          scrollCancelRef.current = scrollTo(flatListRef.current, scrollInfoRef.current, offset - scrollInfoRef.current.layoutMeasurement.height * 0.42, 600, () => {
            scrollCancelRef.current = null
          })
        } catch {}
      } else {
        if (scrollCancelRef.current) {
          scrollCancelRef.current()
          scrollCancelRef.current = null
        }
        try {
          flatListRef.current.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.42,
          })
        } catch {}
      }
    }
  }

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollInfoRef.current = nativeEvent
    if (isPauseScrollRef.current) {
      playLineRef.current?.updateScrollInfo(nativeEvent)
    }
  }
  const handleScrollBeginDrag = () => {
    isPauseScrollRef.current = true
    playLineRef.current?.setVisible(true)
    if (delayScrollTimeout.current) {
      clearTimeout(delayScrollTimeout.current)
      delayScrollTimeout.current = null
    }
    if (scrollTimoutRef.current) {
      clearTimeout(scrollTimoutRef.current)
      scrollTimoutRef.current = null
    }
    if (scrollCancelRef.current) {
      scrollCancelRef.current()
      scrollCancelRef.current = null
    }
  }

  const onScrollEndDrag = () => {
    if (!isPauseScrollRef.current) return
    if (scrollTimoutRef.current) clearTimeout(scrollTimoutRef.current)
    scrollTimoutRef.current = setTimeout(() => {
      playLineRef.current?.setVisible(false)
      scrollTimoutRef.current = null
      isPauseScrollRef.current = false
      if (!playerState.isPlay) return
      handleScrollToActive()
    }, 3000)
  }

  useEffect(() => {
    return () => {
      if (delayScrollTimeout.current) {
        clearTimeout(delayScrollTimeout.current)
        delayScrollTimeout.current = null
      }
      if (scrollTimoutRef.current) {
        clearTimeout(scrollTimoutRef.current)
        scrollTimoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    listLayoutInfoRef.current.lineHeights = []
    lineRef.current.prevLine = 0
    lineRef.current.line = 0
    if (!flatListRef.current) return
    flatListRef.current.scrollToOffset({
      offset: 0,
      animated: false,
    })
    if (!lyricLines.length) return
    playLineRef.current?.updateLyricLines(lyricLines)
    requestAnimationFrame(() => {
      if (isFirstSetLrc.current) {
        isFirstSetLrc.current = false
        setTimeout(() => {
          isPauseScrollRef.current = false
          handleScrollToActive()
        }, 100)
      } else {
        if (delayScrollTimeout.current) clearTimeout(delayScrollTimeout.current)
        delayScrollTimeout.current = setTimeout(() => {
          handleScrollToActive(0)
        }, 100)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyricLines])

  // 换样式后重新居中
  useEffect(() => {
    listLayoutInfoRef.current.lineHeights = []
    requestAnimationFrame(() => {
      handleScrollToActive(Math.max(lineRef.current.line, 0))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style.id])

  useEffect(() => {
    if (line < 0) return
    lineRef.current.prevLine = lineRef.current.line
    lineRef.current.line = line
    if (!flatListRef.current || isPauseScrollRef.current) return

    if (line - lineRef.current.prevLine != 1) {
      handleScrollToActive()
      return
    }

    delayScrollTimeout.current = setTimeout(() => {
      delayScrollTimeout.current = null
      handleScrollToActive()
    }, 600)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line])

  useEffect(() => {
    requestAnimationFrame(() => {
      playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
      playLineRef.current?.updateLyricLines(lyricLines)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShowLyricProgressSetting])

  const handleScrollToIndexFailed: FlatListType['onScrollToIndexFailed'] = (info) => {
    void wait().then(() => {
      handleScrollToActive(info.index)
    })
  }

  const handleLineLayout = useCallback((lineNum: number, height: number) => {
    listLayoutInfoRef.current.lineHeights[lineNum] = height
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
  }, [])

  const handleSpaceLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    listLayoutInfoRef.current.spaceHeight = nativeEvent.layout.height
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
  }, [])

  const handlePlayLine = useCallback((time: number) => {
    playLineRef.current?.setVisible(false)
    global.app_event.setProgress(time)
  }, [])

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => {
    const hidden = style.visibleRange > 0 && Math.abs(index - line) > style.visibleRange
    return (
      <KaraokeLine
        line={item}
        lineNum={index}
        activeLine={line}
        nextTime={lyricLines[index + 1]?.time ?? item.time + 3000}
        onLayout={handleLineLayout}
        words={wordMap?.get(item.time)?.words}
        fontScale={style.scale}
        activeColor={theme.primary}
        dimColor="rgba(255,255,255,0.42)"
        dimOpacity={index === line ? 0.55 : style.dimOpacity}
        align={style.align}
        mirror={style.mirror}
        hidden={hidden}
      />
    )
  }
  const getkey: FlatListType['keyExtractor'] = (item, index) => `${index}${item.text}`

  const spaceComponent = useMemo(() => (
    // paddingTop 只接受 DimensionValue（number | `${number}%`），
    // 这里是从样式配置里读的 string，所以需要 as any
    <View style={{ paddingTop: (padTop ?? style.padTop) as any }} onLayout={handleSpaceLayout} />
  ), [padTop, style.padTop, handleSpaceLayout])

  return (
    <>
      <FlatList
        data={lyricLines}
        renderItem={renderItem}
        keyExtractor={getkey}
        style={{ flex: 1, paddingLeft: (padH ?? style.padH) as any, paddingRight: (padH ?? style.padH) as any }}
        ref={flatListRef}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={spaceComponent}
        ListFooterComponent={spaceComponent}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        fadingEdgeLength={180}
        initialNumToRender={Math.max(line + 10, 10)}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        onScroll={handleScroll}
      />
      { isShowLyricProgressSetting ? <PlayLine ref={playLineRef} onPlayLine={handlePlayLine} /> : null }
    </>
  )
}