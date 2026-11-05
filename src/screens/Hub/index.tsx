import { memo, useCallback, useState } from 'react'
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import { Navigation } from 'react-native-navigation'

import Feed from './Feed'

/**
 * 新首页壳：底部 3 个 Tab（首页 / 发现 / 我的）
 *
 * 旧首页（搜索 / 设置 / 音源 / 歌单）没有删，只是被换成了启动页。
 * 这里通过 Navigation.push('OldHome') 把它接回来，所以音源功能一个都不会丢。
 */

const TABS = [
  { key: 'feed', label: '首页' },
  { key: 'discover', label: '发现' },
  { key: 'mine', label: '我的' },
] as const

type TabKey = typeof TABS[number]['key']

const TAB_BAR_HEIGHT = 58

export default memo(({ componentId }: { componentId?: string }) => {
  const [tab, setTab] = useState<TabKey>('feed')
  const { width } = useWindowDimensions()

  const openOldHome = useCallback(() => {
    if (!componentId) {
      console.warn('[Hub] componentId 缺失，无法打开旧版首页')
      return
    }
    void Navigation.push(componentId, {
      component: { name: 'OldHome' },
    })
  }, [componentId])

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.content}>
        {tab === 'feed'
          ? <Feed bottomInset={TAB_BAR_HEIGHT} />
          : tab === 'discover'
            ? <Discover width={width} />
            : <Mine onOpen={openOldHome} />}
      </View>

      {/* 搜索入口（只在首页显示） */}
      {tab === 'feed'
        ? (
          <TouchableOpacity style={styles.searchBtn} activeOpacity={0.75} onPress={openOldHome}>
            <Text style={styles.searchText}>搜索</Text>
          </TouchableOpacity>
          )
        : null}

      <View style={[styles.tabBar, { height: TAB_BAR_HEIGHT }]}>
        {TABS.map(item => {
          const active = item.key === tab
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.tabItem}
              activeOpacity={0.7}
              onPress={() => { setTab(item.key) }}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
              <View style={[styles.dot, active && styles.dotActive]} />
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
})

const Discover = ({ width }: { width: number }) => {
  const cardWidth = (width - 16 * 3) / 2
  const cards = [
    { title: '热门歌单', desc: '各平台每日更新' },
    { title: '推荐歌单', desc: '按你的口味挑' },
    { title: '热歌榜', desc: '每周四更新' },
    { title: '新歌榜', desc: '实时更新' },
    { title: '飙升榜', desc: '每周一更新' },
    { title: '原创榜', desc: '每周五更新' },
  ]
  return (
    <ScrollView contentContainerStyle={styles.discover}>
      <Text style={styles.sectionTitle}>发现</Text>
      <View style={styles.grid}>
        {cards.map(card => (
          <View key={card.title} style={[styles.card, { width: cardWidth }]}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDesc}>{card.desc}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.tip}>这些入口下一版接到真实的榜单 / 歌单接口</Text>
    </ScrollView>
  )
}

const MINE_ITEMS = [
  { title: '搜索', desc: '找歌 / 找歌单' },
  { title: '我的歌单', desc: '自建歌单、收藏的歌单' },
  { title: '我的喜欢', desc: '收藏的歌曲' },
  { title: '播放历史', desc: '最近听过的歌' },
  { title: '设置与音源', desc: '自定义源 / 音质 / 播放设置' },
  { title: '旧版首页', desc: '洛雪原始界面（备用）' },
]

const Mine = ({ onOpen }: { onOpen: () => void }) => (
  <ScrollView contentContainerStyle={styles.mine}>
    <Text style={styles.sectionTitle}>我的</Text>
    {MINE_ITEMS.map(item => (
      <TouchableOpacity key={item.title} style={styles.row} activeOpacity={0.7} onPress={onOpen}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text style={styles.rowDesc}>{item.desc}</Text>
        </View>
        <Text style={styles.rowArrow}>›</Text>
      </TouchableOpacity>
    ))}
    <Text style={styles.tip}>
      目前这些入口都会跳到洛雪原界面，功能完整可用。{'\n'}
      下一版会把「我的歌单 / 我的喜欢 / 播放历史 / 设置」拆成独立页面内嵌到这里。
    </Text>
  </ScrollView>
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
  discover: {
    paddingTop: 64,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    height: 96,
    borderRadius: 14,
    backgroundColor: '#17171C',
    padding: 14,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  cardDesc: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
  },
  tip: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 11,
    marginTop: 12,
    lineHeight: 17,
  },
  mine: {
    paddingTop: 64,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowLeft: {
    flex: 1,
  },
  rowTitle: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  rowDesc: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    marginTop: 3,
  },
  rowArrow: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 20,
  },
})