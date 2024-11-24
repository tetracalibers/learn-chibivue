import { ReactiveEffect } from '../reactivity'
import { Component } from './component'
import { RootRenderFunction } from './renderer'

export interface App<HostElement = any> {
  mount(rootContainer: HostElement | string): void
}

export type CreateAppFunction<HostElement> = (
  rootComponent: Component
) => App<HostElement>

export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent) {
    const app: App = {
      mount(rootContainer: HostElement) {
        // setup関数が実行された時点で reactive proxy が生成される
        // componentRender は setup 関数の戻り値である render 関数
        // - render 関数は proxy によって作られたオブジェクトを参照している
        // - 実際に rerder 関数が走った時、target の getter 関数が実行され，track が実行されるようになっている
        const componentRender = rootComponent.setup!()

        const updateComponent = () => {
          const vnode = componentRender()
          render(vnode, rootContainer)
        }

        // updateComponent を渡して ReactiveEffect (Observer 側)を生成する
        const effect = new ReactiveEffect(updateComponent)
        // effect を実行
        // 1. activeEffect に updateComponent (を持った ReactiveEffect) が設定される
        // 2. この状態で track が走ると、targetMap に target と updateComponent (を持った ReactiveEffect) のマップが登録される（リアクティブの形成）
        // 3. この状態で target が書き換えられ（setterが実行され）、trigger が走ると、targetMap から effect(今回の例だと updateComponent)をみつけ、実行する
        // これで画面の更新が行われる
        effect.run()
      },
    }

    return app
  }
}
