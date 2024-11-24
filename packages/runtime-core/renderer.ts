//
// render のロジックのみを持つオブジェクトを生成するためのファクトリ関数を実装する
// Node(DOMに限らず)を扱うオブジェクトは factory の関数の引数として受け取るようにする
//

import { ReactiveEffect } from '../reactivity'
import {
  Component,
  ComponentInternalInstance,
  createComponentInstance,
} from './component'
import { VNode, Text, normalizeVNode } from './vnode'

export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement,
> {
  patchProp(el: HostElement, key: string, value: any): void
  createElement(type: string): HostNode
  createText(text: string): HostNode
  setElementText(node: HostNode, text: string): void
  setText(node: HostNode, text: string): void
  insert(child: HostNode, parent: HostNode, anchor?: HostNode | null): void
}

export interface RendererNode {
  [key: string]: any
}

export interface RendererElement extends RendererNode {}

export type RootRenderFunction<HostElement = RendererElement> = (
  vnode: Component,
  container: HostElement
) => void

export function createRenderer(options: RendererOptions) {
  const {
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    setText: hostSetText,
    insert: hostInsert,
  } = options

  const patch = (n1: VNode | null, n2: VNode, container: RendererElement) => {
    const { type } = n2
    if (type === Text) {
      processText(n1, n2, container)
    } else if (typeof type === 'string') {
      processElement(n1, n2, container)
    } else if (typeof type === 'object') {
      processComponent(n1, n2, container)
    } else {
      // noop
    }
  }

  const processElement = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement
  ) => {
    if (n1 === null) {
      mountElement(n2, container)
    } else {
      patchElement(n1, n2)
    }
  }

  const mountElement = (vnode: VNode, container: RendererElement) => {
    let el: RendererElement
    const { type, props } = vnode
    el = vnode.el = hostCreateElement(type as string)

    mountChildren(vnode.children as VNode[], el)

    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, props[key])
      }
    }

    hostInsert(el, container)
  }

  const mountChildren = (children: VNode[], container: RendererElement) => {
    for (let i = 0; i < children.length; i++) {
      const child = (children[i] = normalizeVNode(children[i]))
      patch(null, child, container)
    }
  }

  const patchElement = (n1: VNode, n2: VNode) => {
    const el = (n2.el = n1.el!)

    const props = n2.props

    patchChildren(n1, n2, el)

    for (const key in props) {
      if (props[key] !== n1.props?.[key] || {}) {
        hostPatchProp(el, key, props[key])
      }
    }
  }

  const patchChildren = (n1: VNode, n2: VNode, container: RendererElement) => {
    const c1 = n1.children as VNode[]
    const c2 = n2.children as VNode[]

    for (let i = 0; i < c2.length; i++) {
      const child = (c2[i] = normalizeVNode(c2[i]))
      patch(c1[i], child, container)
    }
  }

  const processText = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement
  ) => {
    if (n1 == null) {
      // mount
      hostInsert((n2.el = hostCreateText(n2.children as string)), container)
    } else {
      // patch
      const el = (n2.el = n1.el!)
      if (n2.children !== n1.children) {
        hostSetText(el, n2.children as string)
      }
    }
  }

  const processComponent = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement
  ) => {
    if (n1 == null) {
      mountComponent(n2, container)
    } else {
      updateComponent(n1, n2)
    }
  }

  const mountComponent = (initialVNode: VNode, container: RendererElement) => {
    // 1. コンポーネントのインスタンスを生成
    const instance: ComponentInternalInstance = (initialVNode.component =
      createComponentInstance(initialVNode))

    // 2. setupを実行し、その結果をインスタンスに保持

    // 3. ReactiveEffectを生成し、それをインスタンスに保持
  }

  const updateComponent = (n1: VNode, n2: VNode) => {
    // TODO:
  }

  const render: RootRenderFunction = (rootComponent, container) => {
    // setup関数が実行された時点で reactive proxy が生成される
    // componentRender は setup 関数の戻り値である render 関数
    // - render 関数は proxy によって作られたオブジェクトを参照している
    // - 実際に rerder 関数が走った時、target の getter 関数が実行され，track が実行されるようになっている
    const componentRender = rootComponent.setup!()

    let n1: VNode | null = null

    const updateComponent = () => {
      const n2 = componentRender()
      patch(n1, n2, container)
      n1 = n2
    }

    // updateComponent を渡して ReactiveEffect (Observer 側)を生成する
    const effect = new ReactiveEffect(updateComponent)
    // effect を実行
    // 1. activeEffect に updateComponent (を持った ReactiveEffect) が設定される
    // 2. この状態で track が走ると、targetMap に target と updateComponent (を持った ReactiveEffect) のマップが登録される（リアクティブの形成）
    // 3. この状態で target が書き換えられ（setterが実行され）、trigger が走ると、targetMap から effect(今回の例だと updateComponent)をみつけ、実行する
    // これで画面の更新が行われる
    effect.run()
  }

  return { render }
}
