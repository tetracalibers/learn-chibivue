import { ReactiveEffect } from '../reactivity'
import { ComponentOptions } from './componentOptions'
import { VNode, VNodeChild } from './vnode'

export type Component = ComponentOptions

export interface ComponentInternalInstance {
  type: Component // 元となるユーザー定義のコンポーネント
  vnode: VNode
  subTree: VNode // レンダリング結果であるVNode 1（差分を比較するためのもの）
  next: VNode | null // レンダリング結果である VNode 2（差分を比較するためのもの）
  effect: ReactiveEffect
  render: InternalRenderFunction
  update: () => void
  isMounted: boolean
}

export type InternalRenderFunction = {
  (): VNodeChild
}
