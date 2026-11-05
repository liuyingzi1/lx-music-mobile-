import playerState from '@/store/player/state'
import { getList } from '@/core/player/playInfo'
import { playNext, playPrev, playList } from '@/core/player/player'

/**
 * 「按当前列表顺序」切歌
 *
 * 洛雪自带的 playNext() 依赖 store 里的 playerPlayIndex，一旦索引失准
 * （比如从搜索结果里点播、列表内容被替换过），就会跳到别的歌上。
 *
 * 这里不管洛雪内部记的索引，直接：
 *   1. 拿到当前播放列表
 *   2. 用「当前播放歌曲的 id」在列表里现找位置
 *   3. 播下一首 / 上一首
 * 找不到才退回到洛雪的 playNext / playPrev。
 */

const getInfo = (item: any) => ('progress' in item ? item.metadata.musicInfo : item)

const currentContext = () => {
  const listId = playerState.playInfo.playerListId
  const cur = playerState.playMusicInfo.musicInfo
  if (!listId || !cur) return null
  const list = getList(listId) as any[]
  if (!list || !list.length) return null
  const index = list.findIndex(m => getInfo(m).id === cur.id)
  if (index < 0) return null
  return { listId, list, index }
}

export const playNextInList = (): void => {
  const ctx = currentContext()
  if (!ctx) {
    void playNext()
    return
  }
  const next = ctx.index + 1
  if (next < ctx.list.length) {
    void playList(ctx.listId, next)
  } else {
    // 已经是最后一首，交回洛雪处理（它会根据播放模式循环 / 停止）
    void playNext()
  }
}

export const playPrevInList = (): void => {
  const ctx = currentContext()
  if (!ctx) {
    void playPrev()
    return
  }
  const prev = ctx.index - 1
  if (prev >= 0) {
    void playList(ctx.listId, prev)
  } else {
    void playPrev()
  }
}