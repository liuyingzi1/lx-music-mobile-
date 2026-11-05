import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'

import playerState from '@/store/player/state'
import { LIST_IDS } from '@/config/constant'
import { getList } from '@/core/player/playInfo'
import { playList, togglePlay } from '@/core/player/player'
import { usePlayMusicInfo } from '@/store/player/hook'

/**
 * 刷歌 Feed（汽水 / 抖音那套）
 *
 * 用 FlatList + pagingEnabled 而不是 react-native-pager-view：
 * pager-view 的 orientation="vertical" 在 iOS 上支持得晚，FlatList 两个平台都稳。
 *
 * 交互：
 *   - 上下滑 = 切歌（停下来才真正切，避免快速划过时疯狂起播）
 *   - 点封面 = 播放 / 暂停
 *   - 卡片 = 封面全屏 + 底部信息
 */

interface Song {
  id: string
  name: string
  singer: string
  pic?: string
  album?: string
}

export default memo(({ bottomInset }: { bottomInset: number }) => {
  const { width, height } = useWindowDimensions()
  const pageHeight = height - bottomInset
  const listRef = useRef<FlatList<Song>>(null)
  const playMusicInfo = usePlayMusicInfo()

  const [listId, songs] = useMemo<[string | null, Song[]]>(() => {
    // 没有正在播放的列表时，退化到「试听列表」，这样首次进来不会是空白页
    const id = playerState.playInfo.playerListId ?? ((LIST_IDS as any).DEFAULT as string)
    if (!id) return [null, []]
    const list = getList(id) as any[]
    if (!list) return [null, []]
    return [id, list.map(item => {
      const info = 'progress' in item ? item.metadata.musicInfo : item
      return { id: info.id, name: info.name, singer: info.singer, pic: info.pic, album: info.album }
    })]
  }, [playMusicInfo.listId, playMusicInfo.musicInfo?.id])

  // 当前播放的是哪一首 → 把列表滚到那一页
  const currentIndex = useMemo(() => {
    if (!playMusicInfo.musicInfo) return 0
    const index = songs.findIndex(s => s.id === playMusicInfo.musicInfo!.id)
    return index < 0 ? 0 : index
  }, [songs, playMusicInfo.musicInfo?.id])

  const mountedRef = useRef(false)
  useEffect(() => {
    if (!songs.length) return
    // 首次进入时对齐到正在播放的那一首
    if (!mountedRef.current) {
      mountedRef.current = true
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: currentIndex, animated: false })
      }, 30)
    }
  }, [currentIndex, songs.length])

  const handleMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!listId || !songs.length) return
    const index = Math.round(e.nativeEvent.contentOffset.y / pageHeight)
    const target = songs[index]
    if (!target) return
    if (target.id === playMusicInfo.musicInfo?.id) return
    void playList(listId, index)
  }, [listId, pageHeight, playMusicInfo.musicInfo?.id, songs])

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: pageHeight,
    offset: pageHeight * index,
    index,
  }), [pageHeight])

  if (!songs.length) {
    return (
      <View style={[styles.empty, { width }]}>
        <Text style={styles.emptyText}>还没有正在播放的列表</Text>
        <Text style={styles.emptyHint}>去「搜索」随便播一首，这里就会出现</Text>
      </View>
    )
  }

  return (
    <FlatList
      ref={listRef}
      data={songs}
      keyExtractor={item => item.id}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      getItemLayout={getItemLayout}
      onMomentumScrollEnd={handleMomentumEnd}
      decelerationRate="fast"
      renderItem={({ item, index }) => {
        const isCurrent = item.id === playMusicInfo.musicInfo?.id
        return (
          <View style={{ width, height: pageHeight }}>
            {item.pic
              ? <Image source={{ uri: item.pic }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#141418' }]} />}

            {/* 上下压暗，保证文字可读 */}
            <View style={styles.topScrim} />
            <View style={styles.bottomScrim} />

            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={isCurrent ? togglePlay : () => { void playList(listId!, index) }}
            >
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.singer} numberOfLines={1}>{item.singer}{item.album ? ` · ${item.album}` : ''}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{isCurrent ? '正在播放' : '点一下播放'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )
      }}
    />
  )
})

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
  },
  emptyHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 8,
  },
  topScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '22%',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  info: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 40,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  singer: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    marginTop: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  badgeText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
  },
})
