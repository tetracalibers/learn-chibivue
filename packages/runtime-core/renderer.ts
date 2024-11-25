//
// render のロジックのみを持つオブジェクトを生成するためのファクトリ関数を実装する
// Node(DOMに限らず)を扱うオブジェクトは factory の関数の引数として受け取るようにする
//

import { ReactiveEffect } from '../reactivity'
import {
  Component,
  ComponentInternalInstance,
  createComponentInstance,
  setupComponent,
} from './component'
import { updateProps } from './componentProps'
import { VNode, Text, normalizeVNode, createVNode, VNodeKey } from './vnode'

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
  remove(child: HostNode): void
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
    remove: hostRemove,
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
    patchKeyedChildren(c1, c2, container)
  }

  // TODO: anchor をバケツリレーできるように (move のための insert で使うので)
  const patchKeyedChildren = (
    c1: VNode[], // 前回の子ノードの配列（旧仮想ノードリスト）
    c2: VNode[], // 新しい子ノードの配列（新仮想ノードリスト）
    container: RendererElement // 子ノードを含む親DOM要素
  ) => {
    let i = 0 // ループカウンタ

    const l2 = c2.length // 新しい子ノードリストの長さ

    const e1 = c1.length - 1 // 前回の子ノードリストの末尾インデックス（end index of prev node）
    const e2 = l2 - 1 // 新しい子ノードリストの末尾インデックス（end index of next node）

    const s1 = i // start index of prev node
    const s2 = i // start index of next node

    //
    // 1. 新しいノード c2 を元に key と index の Map を生成
    //

    // キーを持つ新しい子ノードのキーとそのインデックスをマッピングしたもの
    const keyToNewIndexMap: Map<VNodeKey, number> = new Map()

    // 新しい子ノードリスト c2 をループし、各ノードのキーを取得し、マップに追加
    for (i = s2; i <= e2; i++) {
      const nextChild = (c2[i] = normalizeVNode(c2[i]))
      if (nextChild.key != null) {
        keyToNewIndexMap.set(nextChild.key, i)
      }
    }

    //
    // 2. key の Map を元に c2 の index と c1 の index の Map を生成
    //
    // この段階で、c1 ベースのループと c2 ベースのループで patch 処理をしておく (move はまだ)
    // - c1 ベースのループ： c1 にしかないノードは削除（unmount）
    // - c2 ベースのループ： c2 にしかないノードは追加（mount）
    //

    const toBePatched = e2 + 1 // パッチが必要な新しい子ノードの総数
    let patched = 0 // パッチ済みのノード数

    // 新indexと旧indexとのマップ
    // 新しい子ノードの各インデックスに対応する前回の子ノードのインデックスを保持する
    const newIndexToOldIndexMap = new Array(toBePatched)
    // 初期値は全て0（未マッチ）で初期化
    for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0

    // 古い子ノードをループして新しい子ノードと比較
    for (i = 0; i <= e1; i++) {
      const prevChild = c1[i]

      if (patched >= toBePatched) {
        // すべての新しい子ノードにはパッチが適用されている
        // 残りの古い子ノードは削除する
        unmount(prevChild)
        continue
      }

      const newIndex = prevChild.key
        ? keyToNewIndexMap.get(prevChild.key)
        : undefined
      if (newIndex === undefined) {
        // 移動先が見つからない場合はアンマウントする
        // （旧にはあって、新にはない = 削除された）
        unmount(prevChild)
      } else {
        // マップ形成
        newIndexToOldIndexMap[newIndex] = i + 1

        // パッチ処理
        patch(prevChild, c2[newIndex] as VNode, container)
        patched++
      }
    }

    // 新しい子ノードリストを逆順にループ
    for (i = toBePatched - 1; i >= 0; i--) {
      const nextIndex = i
      const nextChild = c2[nextIndex] as VNode
      if (newIndexToOldIndexMap[i] === 0) {
        // マップが存在しない(初期値のまま)のであれば新しくマウントする
        // (新にはあって、旧にはない = 追加された)
        patch(null, nextChild, container)
      }
    }

    //
    // 3. ↑で得た Map を元に最長増加部分列を求める
    //

    //
    // 4. ↑で得た部分列と c2 を元に move する
    //
  }

  const unmount = (vnode: VNode) => {
    const { type, children } = vnode
    if (typeof type === 'object') {
      unmountComponent(vnode.component!)
    } else if (Array.isArray(children)) {
      unmountChildren(children as VNode[])
    }
    remove(vnode)
  }

  const remove = (vnode: VNode) => {
    const { el } = vnode
    hostRemove(el!)
  }

  const unmountComponent = (instance: ComponentInternalInstance) => {
    const { subTree } = instance
    unmount(subTree)
  }

  const unmountChildren = (children: VNode[]) => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i])
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
    // コンポーネントのインスタンスを生成
    const instance: ComponentInternalInstance = (initialVNode.component =
      createComponentInstance(initialVNode))

    setupComponent(instance)
    setupRenderEffect(instance, initialVNode, container)
  }

  // ReactiveEffectを生成し、それをインスタンスに保持させる
  const setupRenderEffect = (
    instance: ComponentInternalInstance,
    initialVNode: VNode,
    container: RendererElement
  ) => {
    const componentUpdateFn = () => {
      const { render, setupState } = instance

      if (!instance.isMounted) {
        // mount process
        const subTree = (instance.subTree = normalizeVNode(render(setupState)))
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
        const nextTree = normalizeVNode(render(setupState))
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
