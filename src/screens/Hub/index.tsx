import { memo, useState } from 'react'
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'

import Feed from './Feed'

/**
 * 新首页壳：底部 3 个 Tab（首页 / 发现 / 我的）
 *
 * 说明：
 *   - 这是**独立屏幕**，不依赖洛雪原有的 Home / 抽屉 / Pager 结构，
 *     所以不会把现有功能改坏；确认好用它之后再设为启动页。
 *   - Tab 栏是自己画的 View，不是 react-native-navigation 的 bottomTabs，
 *     好处是零风险，坏处是每个 Tab 页要自己管滚动位置。
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
  const { width } = useWindowDimensions()

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.content}>
        {tab === 'feed'
          ? <Feed bottomInset={TAB_BAR_HEIGHT} />
          : tab === 'discover'
            ? <Discover width={width} />
            : <Mine />}
      </View>

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

const Mine = () => (
  <View style={styles.mine}>
    <Text style={styles.sectionTitle}>我的</Text>
    <Text style={styles.tip}>这里之后放：我的歌单 / 播放历史 / 设置</Text>
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
  },
  mine: {
    flex: 1,
    paddingTop: 64,
    paddingHorizontal: 16,
  },
})
