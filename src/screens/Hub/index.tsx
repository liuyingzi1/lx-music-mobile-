import { memo, useCallback, useMemo, useState } from 'react'
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'

import Search from '@/screens/Home/Views/Search'
import SongList from '@/screens/Home/Views/SongList'
import Mylist from '@/screens/Home/Views/Mylist'
import Leaderboard from '@/screens/Home/Views/Leaderboard'
import Setting from '@/screens/Home/Views/Setting'
import { setNavActiveId } from '@/core/common'
import { useStatusbarHeight } from '@/store/common/hook'

import Feed from './Feed'

/**
 * 新首页外壳（内嵌洛雪真实页面）
 *
 * 关键点：这 5 个页面原本都排在 Home 的 Header 下面，
 * Header 自己加了 paddingTop = 状态栏高度。单独拎出来后必须自己补这个内边距，
 * 否则搜索框会钻到状态栏底下、标题会和顶部控件重叠。
 */

const TABS = [
  { key: 'feed', label: '首页' },
  { key: 'discover', label: '发现' },
  { key: 'mine', label: '我的' },
] as const

type TabKey = typeof TABS[number]['key']

const TAB_BAR_HEIGHT = 58

export default memo(() => {
  const [tab, setTab] = useState<TabKey>('feed')
  const [discoverSub, setDiscoverSub] = useState<'top' | 'songlist'>('top')
  const [mineSub, setMineSub] = useState<'music' | 'setting'>('music')
  const [searchOpen, setSearchOpen] = useState(false)
  const { width } = useWindowDimensions()
  const statusBarHeight = useStatusbarHeight()

  const syncNav = useCallback((next: TabKey, dSub: 'top' | 'songlist', mSub: 'music' | 'setting') => {
    if (next === 'discover') setNavActiveId(dSub === 'top' ? 'nav_top' : 'nav_songlist')
    else if (next === 'mine') setNavActiveId(mSub === 'music' ? 'nav_love' : 'nav_setting')
  }, [])

  const switchTab = useCallback((next: TabKey) => {
    setTab(next)
    syncNav(next, discoverSub, mineSub)
  }, [discoverSub, mineSub, syncNav])

  const switchDiscoverSub = useCallback((next: 'top' | 'songlist') => {
    setDiscoverSub(next)
    setNavActiveId(next === 'top' ? 'nav_top' : 'nav_songlist')
  }, [])

  const switchMineSub = useCallback((next: 'music' | 'setting') => {
    setMineSub(next)
    setNavActiveId(next === 'music' ? 'nav_love' : 'nav_setting')
  }, [])

  const openSearch = useCallback(() => {
    setNavActiveId('nav_search')
    setSearchOpen(true)
  }, [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    syncNav(tab, discoverSub, mineSub)
  }, [discoverSub, mineSub, syncNav, tab])

  // 页面只创建一次，避免切换 Tab 时重新拉数据
  const searchPage = useMemo(() => <Search />, [])
  const leaderboardPage = useMemo(() => <Leaderboard />, [])
  const songlistPage = useMemo(() => <SongList />, [])
  const mylistPage = useMemo(() => <Mylist />, [])
  const settingPage = useMemo(() => <Setting />, [])

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={styles.content}>
        {tab === 'feed' ? <Feed bottomInset={TAB_BAR_HEIGHT} /> : null}

        {tab === 'discover'
          ? (
            <View style={[styles.page, { paddingTop: statusBarHeight }]}>
              <Segment
                items={[{ key: 'top', label: '榜单' }, { key: 'songlist', label: '歌单' }]}
                value={discoverSub}
                onChange={(v) => { switchDiscoverSub(v as 'top' | 'songlist') }}
              />
              <View style={styles.pageBody}>
                {discoverSub === 'top' ? leaderboardPage : songlistPage}
              </View>
            </View>
            )
          : null}

        {tab === 'mine'
          ? (
            <View style={[styles.page, { paddingTop: statusBarHeight }]}>
              <Segment
                items={[{ key: 'music', label: '我的音乐' }, { key: 'setting', label: '设置' }]}
                value={mineSub}
                onChange={(v) => { switchMineSub(v as 'music' | 'setting') }}
              />
              <View style={styles.pageBody}>
                {mineSub === 'music' ? mylistPage : settingPage}
              </View>
            </View>
            )
          : null}
      </View>

      {/* 首页右上角搜索 */}
      {tab === 'feed'
        ? (
          <TouchableOpacity style={styles.searchBtn} activeOpacity={0.75} onPress={openSearch}>
            <Text style={styles.searchText}>搜索</Text>
          </TouchableOpacity>
          )
        : null}

      {/* 底部导航 */}
      <View style={[styles.tabBar, { height: TAB_BAR_HEIGHT }]}>
        {TABS.map(item => {
          const active = item.key === tab
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.tabItem}
              activeOpacity={0.7}
              onPress={() => { switchTab(item.key) }}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
              <View style={[styles.dot, active && styles.dotActive]} />
            </TouchableOpacity>
          )
        })}
      </View>

      {/* 搜索全屏浮层（补状态栏内边距，否则搜索框会被状态栏挡住） */}
      {searchOpen
        ? (
          <View style={[styles.overlay, { width, paddingTop: statusBarHeight }]}>
            {searchPage}
            <TouchableOpacity style={styles.backBtn} activeOpacity={0.8} onPress={closeSearch}>
              <Text style={styles.backText}>返回</Text>
            </TouchableOpacity>
          </View>
          )
        : null}
    </View>
  )
})

const Segment = ({ items, value, onChange }: {
  items: Array<{ key: string, label: string }>
  value: string
  onChange: (key: string) => void
}) => (
  <View style={styles.segmentWrap}>
    <View style={styles.segment}>
      {items.map(item => {
        const active = item.key === value
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
            activeOpacity={0.8}
            onPress={() => { onChange(item.key) }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  </View>
)

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  content: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  pageBody: {
    flex: 1,
  },
  searchBtn: {
    position: 'absolute',
    right: 16,
    top: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  searchText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  segmentWrap: {
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  segmentItem: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 15,
  },
  segmentItemActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  segmentText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  segmentTextActive: {
    color: '#111111',
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0E0E12',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 12,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    position: 'absolute',
    left: 12,
    bottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
})