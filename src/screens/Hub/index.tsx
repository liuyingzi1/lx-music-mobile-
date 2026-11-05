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

import Feed from './Feed'

/**
 * 新首页外壳（真·内嵌，不是 push 旧首页）
 *
 * 直接把洛雪 Home 里的 5 个真实页面组件挂进来：
 *   Search / SongList / Mylist / Leaderboard / Setting
 * 它们都是无 props 的整页组件，所以可以像积木一样塞进任意容器。
 *
 * Tab 结构：
 *   首页  → 刷歌 Feed
 *   发现  → 榜单 / 歌单（分段切换）
 *   我的  → 我的音乐 / 设置（分段切换）
 *   顶部右上角「搜索」→ 全屏盖一层 Search
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

  // 这几个页面内部会读 commonState.navActiveId 做判断，切 Tab 时同步一下
  const switchTab = useCallback((next: TabKey) => {
    setTab(next)
    if (next === 'discover') setNavActiveId(discoverSub === 'top' ? 'nav_top' : 'nav_songlist')
    else if (next === 'mine') setNavActiveId(mineSub === 'music' ? 'nav_love' : 'nav_setting')
  }, [discoverSub, mineSub])

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
    if (tab === 'discover') setNavActiveId(discoverSub === 'top' ? 'nav_top' : 'nav_songlist')
    else if (tab === 'mine') setNavActiveId(mineSub === 'music' ? 'nav_love' : 'nav_setting')
  }, [discoverSub, mineSub, tab])

  // 页面只创建一次，避免每次切换都重新拉数据
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
        {tab === 'discover' ? (discoverSub === 'top' ? leaderboardPage : songlistPage) : null}
        {tab === 'mine' ? (mineSub === 'music' ? mylistPage : settingPage) : null}
      </View>

      {/* 首页右上角搜索 */}
      {tab === 'feed'
        ? (
          <TouchableOpacity style={styles.searchBtn} activeOpacity={0.75} onPress={openSearch}>
            <Text style={styles.searchText}>搜索</Text>
          </TouchableOpacity>
          )
        : null}

      {/* 发现：二级切换 */}
      {tab === 'discover'
        ? (
          <View style={styles.segmentWrap}>
            <Segment
              items={[{ key: 'top', label: '榜单' }, { key: 'songlist', label: '歌单' }]}
              value={discoverSub}
              onChange={(v) => { switchDiscoverSub(v as 'top' | 'songlist') }}
            />
          </View>
          )
        : null}

      {/* 我的：二级切换 */}
      {tab === 'mine'
        ? (
          <View style={styles.segmentWrap}>
            <Segment
              items={[{ key: 'music', label: '我的音乐' }, { key: 'setting', label: '设置' }]}
              value={mineSub}
              onChange={(v) => { switchMineSub(v as 'music' | 'setting') }}
            />
          </View>
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

      {/* 搜索全屏浮层 */}
      {searchOpen
        ? (
          <View style={[styles.overlay, { width }]}>
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
)

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  content: {
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
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
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