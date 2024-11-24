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

// コンポーネントのインスタンスを生成するための関数(コンストラクタの役割をするもの)
export function createComponentInstance(
  vnode: VNode
): ComponentInternalInstance {
  const type = vnode.type as Component

  // 各プロパティの型は non-null だが，インスタンスを生成した段階では null で入れてしまう
  const instance: ComponentInternalInstance = {
    type,
    vnode,
    next: null,
    effect: null!,
    subTree: null!,
    update: null!,
    render: null!,
    isMounted: false,
  }

  return instance
}
