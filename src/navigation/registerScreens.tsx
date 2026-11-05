// @flow

import { Navigation } from 'react-native-navigation'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import {
  Home,
  PlayDetail,
  SonglistDetail,
  Comment,
  // Setting,
} from '@/screens'
import { Provider } from '@/store/Provider'

import {
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  COMMENT_SCREEN,
  VERSION_MODAL,
  PACT_MODAL,
  SYNC_MODE_MODAL,
  // SETTING_SCREEN,
} from './screenNames'
import VersionModal from './components/VersionModal'
import PactModal from './components/PactModal'
import SyncModeModal from './components/SyncModeModal'

function WrappedComponent(Component: any) {
  return function inject(props: Record<string, any>) {
    const EnhancedComponent = () => (
      // ★ 相对原版唯一改动：每个屏幕外面包一层 GestureHandlerRootView
      // react-native-navigation 的屏幕不是挂在 App 根节点下的，
      // 所以不能像 react-navigation 那样只在 App.tsx 包一次。
      // 在这里包是"一次改全量"的最省事做法。
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Provider>
          <Component
            {...props}
          />
        </Provider>
      </GestureHandlerRootView>
    )

    return <EnhancedComponent />
  }
}

export default () => {
  Navigation.registerComponent(HOME_SCREEN, () => WrappedComponent(Home))
  Navigation.registerComponent(PLAY_DETAIL_SCREEN, () => WrappedComponent(PlayDetail))
  Navigation.registerComponent(SONGLIST_DETAIL_SCREEN, () => WrappedComponent(SonglistDetail))
  Navigation.registerComponent(COMMENT_SCREEN, () => WrappedComponent(Comment))
  Navigation.registerComponent(VERSION_MODAL, () => WrappedComponent(VersionModal))
  Navigation.registerComponent(PACT_MODAL, () => WrappedComponent(PactModal))
  Navigation.registerComponent(SYNC_MODE_MODAL, () => WrappedComponent(SyncModeModal))
  // Navigation.registerComponent(SETTING_SCREEN, () => WrappedComponent(Setting))

  console.info('All screens have been registered...')
}