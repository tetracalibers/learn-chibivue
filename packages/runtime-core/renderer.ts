//
// render のロジックのみを持つオブジェクトを生成するためのファクトリ関数を実装する
// Node(DOMに限らず)を扱うオブジェクトは factory の関数の引数として受け取るようにする
//

import { ReactiveEffect } from '../reactivity'
import {
  Component,
  ComponentInternalInstance,
  createComponentInstance,
  InternalRenderFunction,
} from './component'
import { initProps, updateProps } from './componentProps'
import { VNode, Text, normalizeVNode, createVNode } from './vnode'

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
  parentNode(node: HostNode): HostNode | null
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
    parentNode: hostParentNode,
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
      // mount
      mountComponent(n2, container)
    } else {
      // patch
      updateComponent(n1, n2)
    }
  }

  const mountComponent = (initialVNode: VNode, container: RendererElement) => {
    // 1. コンポーネントのインスタンスを生成
    const instance: ComponentInternalInstance = (initialVNode.component =
      createComponentInstance(initialVNode))

    // 2. propsを初期化
    const { props } = instance.vnode
    initProps(instance, props)

    // 3. setupを実行し、その結果をインスタンスに保持
    const component = initialVNode.type as Component
    if (component.setup) {
      // setup関数が実行された時点で reactive proxy が生成される
      // componentRender は setup 関数の戻り値である render 関数
      // - render 関数は proxy によって作られたオブジェクトを参照している
      // - 実際に rerder 関数が走った時、target の getter 関数が実行され，track が実行されるようになっている
      instance.render = component.setup(instance.props, {
        emit: instance.emit,
      }) as InternalRenderFunction
    }

    // 4. ReactiveEffectを生成し、それをインスタンスに保持
    setupRenderEffect(instance, initialVNode, container)
  }

  const setupRenderEffect = (
    instance: ComponentInternalInstance,
    initialVNode: VNode,
    container: RendererElement
  ) => {
    const componentUpdateFn = () => {
      const { render } = instance

      if (!instance.isMounted) {
        // mount process
        const subTree = (instance.subTree = normalizeVNode(render()))
        patch(null, subTree, container)
        initialVNode.el = subTree.el
        instance.isMounted = true
      } else {
        // patch process
        let { next, vnode } = instance

        if (next) {
          next.el = vnode.el
          next.component = instance
          instance.vnode = next
          instance.next = null
          updateProps(instance, next.props)
        } else {
          next = vnode
        }

        const prevTree = instance.subTree
        const nextTree = normalizeVNode(render())
        instance.subTree = nextTree

        patch(prevTree, nextTree, hostParentNode(prevTree.el!)!)
        next.el = nextTree.el
      }
    }

    // updateComponent を渡して ReactiveEffect (Observer 側)を生成する
    // それをinstance.effectに保持させる
    const effect = (instance.effect = new ReactiveEffect(componentUpdateFn))

    // effect.run() は effect を実行する関数
    // 1. activeEffect に updateComponent (を持った ReactiveEffect) が設定される
    // 2. この状態で track が走ると、targetMap に target と updateComponent (を持った ReactiveEffect) のマップが登録される（リアクティブの形成）
    // 3. この状態で target が書き換えられ（setterが実行され）、trigger が走ると、targetMap から effect(今回の例だと updateComponent)をみつけ、実行する
    // このように画面の更新を行う関数を、instance.update に登録しておく
    const update = (instance.update = () => effect.run())

    update()
  }

  const updateComponent = (n1: VNode, n2: VNode) => {
    const instance = (n2.component = n1.component)!
    instance.next = n2
    instance.update()
  }

  const render: RootRenderFunction = (rootComponent, container) => {
    const vnode = createVNode(rootComponent, {}, [])
    patch(null, vnode, container)
  }

  return { render }
}
