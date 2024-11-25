//
// render のロジックのみを持つオブジェクトを生成するためのファクトリ関数を実装する
// Node(DOMに限らず)を扱うオブジェクトは factory の関数の引数として受け取るようにする
//

import { ReactiveEffect } from '../reactivity'
import { ShapeFlags } from '../shared/shapeFlags'
import {
  Component,
  ComponentInternalInstance,
  createComponentInstance,
  setupComponent,
} from './component'
import { updateProps } from './componentProps'
import { queueJob, SchedulerJob } from './scheduler'
import {
  VNode,
  Text,
  normalizeVNode,
  createVNode,
  VNodeKey,
  isSameVNodeType,
} from './vnode'

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
    setElementText: hostSetElementText,
    insert: hostInsert,
    remove: hostRemove,
    parentNode: hostParentNode,
  } = options

  const patch = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererElement | null
  ) => {
    const { type, shapeFlag } = n2
    if (type === Text) {
      processText(n1, n2, container)
    } else if (shapeFlag & ShapeFlags.ELEMENT) {
      processElement(n1, n2, container, anchor)
    } else if (shapeFlag & ShapeFlags.COMPONENT) {
      processComponent(n1, n2, container, anchor)
    } else {
      // do nothing
    }
  }

  const processElement = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererElement | null
  ) => {
    if (n1 === null) {
      mountElement(n2, container, anchor)
    } else {
      patchElement(n1, n2, anchor)
    }
  }

  const mountElement = (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererElement | null
  ) => {
    let el: RendererElement
    const { type, props } = vnode
    el = vnode.el = hostCreateElement(type as string)

    mountChildren(vnode.children as VNode[], el, anchor)

    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, props[key])
      }
    }

    hostInsert(el, container)
  }

  const mountChildren = (
    children: VNode[],
    container: RendererElement,
    anchor: RendererElement | null
  ) => {
    for (let i = 0; i < children.length; i++) {
      const child = (children[i] = normalizeVNode(children[i]))
      patch(null, child, container, anchor)
    }
  }

  const patchElement = (
    n1: VNode,
    n2: VNode,
    anchor: RendererElement | null
  ) => {
    const el = (n2.el = n1.el!)

    const props = n2.props

    patchChildren(n1, n2, el, anchor)

    for (const key in props) {
      if (props[key] !== n1.props?.[key] || {}) {
        hostPatchProp(el, key, props[key])
      }
    }
  }

  const patchChildren = (
    n1: VNode,
    n2: VNode,
    container: RendererElement,
    anchor: RendererElement | null
  ) => {
    const c1 = n1 && n1.children // 前回の子ノード
    const prevShapeFlag = n1 ? n1.shapeFlag : 0 // 前回のノードのshapeフラグ（n1 が存在しない場合は 0）
    const c2 = n2.children // 新しい子ノード
    const { shapeFlag } = n2 // 新しいノードのshapeフラグ

    //
    // ビットマスクで子に関するshapeフラグをチェックし、フラグに応じて分岐処理を行う
    //
    // ビットフラグ（ビットマスク）：
    // 一つの整数値で複数の状態を同時に管理できる手法
    // - 整数値の各ビットを個別のフラグ（状態）として使用する
    // - 各ビット位置に意味を持たせ、そのビットが 1 であればその状態が「真」であると解釈する
    //

    // ビット演算 & は、対応するビットが両方とも 1 の場合に 1 を返す
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      //
      // 新しいノードの子がテキストノードの場合
      //

      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 前回の子が配列（複数の子ノード）だった場合、
        // テキストノードに更新するため、前回の子ノードは不要になる
        // => 前回の子ノードを全てアンマウント（削除）
        unmountChildren(c1 as VNode[])
      }
      if (c2 !== c1) {
        // テキスト内容が変更された場合、テキストを更新
        hostSetElementText(container, c2 as string)
      }
    } else {
      //
      // 新しいノードの子がテキストノードではない場合
      //

      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 前回の子が配列（複数の子ノード）だった場合
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 新しい子も配列（複数の子ノード）の場合、
          // 前回と新しい子ノードの配列を比較し、差分更新を行う
          patchKeyedChildren(c1 as VNode[], c2 as VNode[], container, anchor)
        } else {
          // 新しい子が配列でない場合、
          // 新しいノードが子供を持たない、またはテキストノードであるため、前回の子ノードは不要
          // => 前回の子ノードを全てアンマウント（削除）
          unmountChildren(c1 as VNode[])
        }
      } else {
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 前回の子がテキストノードだった場合、
          // 新しいノードがテキストノードでないため、以前のテキストをクリアする必要がある
          // => コンテナのテキスト内容を空文字に設定し、テキストを削除
          hostSetElementText(container, '')
        }
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 新しい子が配列（複数の子ノード）の場合、
          // 新しいノードが複数の子ノードを持つため、それらをDOMに反映させる必要がある
          // => 新しい子ノードをマウント（追加）
          mountChildren(c2 as VNode[], container, anchor)
        }
      }
    }
  }

  const patchKeyedChildren = (
    c1: VNode[], // 前回の子ノードの配列（旧仮想ノードリスト）
    c2: VNode[], // 新しい子ノードの配列（新仮想ノードリスト）
    container: RendererElement, // 子ノードを含む親DOM要素
    parentAnchor: RendererElement | null // 子ノードを挿入する際の参照ノード（アンカー）
  ) => {
    let i = 0 // ループカウンタ

    const l2 = c2.length // 新しい子ノードリストの長さ

    const e1 = c1.length - 1 // 前回の子ノードリストの末尾インデックス（end index of prev node）
    const e2 = l2 - 1 // 新しい子ノードリストの末尾インデックス（end index of next node）

    const s1 = i // start index of prev node
    const s2 = i // start index of next node

    //
    // 新しいノード c2 を元に key と index の Map を生成
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
    // key の Map を元に c2 の index と c1 の index の Map を生成
    //
    // c1 ベースのループと c2 ベースのループで patch 処理を行う
    // - c1 ベースのループ： c1 にしかないノードは削除（unmount）
    // - c2 ベースのループ： c2 にしかないノードは追加（mount）
    //

    let j
    let patched = 0 // パッチ済みのノード数

    const toBePatched = e2 + 1 // パッチが必要な新しい子ノードの総数

    let moved = false // ノードの移動が必要かどうかを示すフラグ
    let maxNewIndexSoFar = 0 // これまでに見つかった新しいインデックスの最大値

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

      // 現在の前回のノード（prevChild）に対応する新しいノードのインデックス
      // ループ内で、前回のノードが新しいリストのどこに位置するかを示す
      let newIndex

      if (prevChild.key != null) {
        //
        // キーによる一致の試行
        //

        // 古いノードがキーを持つ場合、keyToNewIndexMapを使用して新しいノードのインデックスを取得
        newIndex = keyToNewIndexMap.get(prevChild.key)
      } else {
        //
        // キーなしノードの一致の試行
        //

        // キーを持たない場合、新しい子ノードリストをループし、同じタイプのキーなしノードを探す
        for (j = 0; j <= e2; j++) {
          if (
            newIndexToOldIndexMap[j] === 0 &&
            isSameVNodeType(prevChild, c2[j] as VNode)
          ) {
            newIndex = j
            break
          }
        }
      }

      if (newIndex === undefined) {
        //
        // 一致しない場合
        //

        // 移動先が見つからないので、アンマウントする
        // （旧にはあって、新にはない = 削除された）
        unmount(prevChild)
      } else {
        //
        // 一致した場合
        // 古いノード（prevChild）が新しいノード（c2[newIndex]）に対応しており、更新が必要
        //

        // newIndexToOldIndexMapに対応関係を記録
        newIndexToOldIndexMap[newIndex] = i + 1

        // 新しいノードリストにおけるノードの相対的な順序を確認し、ノードの移動が必要かどうかを判定
        if (newIndex >= maxNewIndexSoFar) {
          // ノードが前回の順序に従って新しいリストにも配置されている（順序が維持されている）
          // 移動は必要なく、最大値を更新すればよい
          maxNewIndexSoFar = newIndex
        } else {
          // ノードが新しいリストで順序が変更された（ノードが移動した）
          moved = true
        }

        // 一致したノードを再帰的にパッチ処理
        // anchor は null
        // - 既存のノードを更新するだけで、新しい位置にノードを挿入する必要はない
        // - 既存のノードがすでに正しい位置に存在しているため、anchor を指定して位置を変更する必要がない
        patch(prevChild, c2[newIndex] as VNode, container, null)
        patched++
      }
    }

    // 最長増加部分列（LIS）を取得
    // ノードの新しいインデックスの配列からLISを求めることで、順序が維持されているノードの集合を特定できる
    const increasingNewIndexSequence = moved
      ? getSequence(newIndexToOldIndexMap)
      : []

    j = increasingNewIndexSequence.length - 1

    // 新しい子ノードリストを逆順にループ
    // 後ろから処理することで、insertBefore 操作が簡単になる
    for (i = toBePatched - 1; i >= 0; i--) {
      const nextIndex = i
      const nextChild = c2[nextIndex] as VNode

      // 新しいノードを追加する位置を決定
      // - 次のノードが存在する場合、そのノードの前に挿入する
      // - 次のノードが存在しない場合、親コンテナの末尾に挿入する（ parentAnchor は親ノードの次の兄弟ノード）
      const anchor =
        nextIndex + 1 < l2 ? (c2[nextIndex + 1] as VNode).el : parentAnchor

      if (newIndexToOldIndexMap[i] === 0) {
        // マップが存在しない(初期値のまま)のであれば新しくマウントする
        // (新にはあって、旧にはない = 追加された)
        patch(null, nextChild, container, anchor ?? null)
      } else if (moved) {
        if (j < 0 || i !== increasingNewIndexSequence[j]) {
          // 現在のインデックスがLISに含まれない場合、ノードを移動する
          move(nextChild, container, anchor ?? null)
        } else {
          // ノードの新しいインデックスがLISに含まれる場合、そのノードは移動しなくても良いと判断できる
          // 移動はせずに、j をデクリメントして次のLISインデックスを参照する
          j--
        }
      }
    }
  }

  const move = (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererElement | null
  ) => {
    const { el, shapeFlag } = vnode
    if (shapeFlag & ShapeFlags.COMPONENT) {
      move(vnode.component!.subTree, container, anchor)
      return
    }
    hostInsert(el!, container, anchor)
  }

  const unmount = (vnode: VNode) => {
    const { children, shapeFlag } = vnode
    if (shapeFlag & ShapeFlags.COMPONENT) {
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
    container: RendererElement,
    anchor: RendererElement | null
  ) => {
    if (n1 == null) {
      // mount
      mountComponent(n2, container, anchor)
    } else {
      // patch
      updateComponent(n1, n2)
    }
  }

  const mountComponent = (
    initialVNode: VNode,
    container: RendererElement,
    anchor: RendererElement | null
  ) => {
    // コンポーネントのインスタンスを生成
    const instance: ComponentInternalInstance = (initialVNode.component =
      createComponentInstance(initialVNode))

    setupComponent(instance)
    setupRenderEffect(instance, initialVNode, container, anchor)
  }

  // ReactiveEffectを生成し、それをインスタンスに保持させる
  const setupRenderEffect = (
    instance: ComponentInternalInstance,
    initialVNode: VNode,
    container: RendererElement,
    anchor: RendererElement | null
  ) => {
    const componentUpdateFn = () => {
      const { render, setupState } = instance

      if (!instance.isMounted) {
        // mount process
        const subTree = (instance.subTree = normalizeVNode(render(setupState)))
        patch(null, subTree, container, anchor)
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

        patch(prevTree, nextTree, hostParentNode(prevTree.el!)!, anchor)
        next.el = nextTree.el
      }
    }

    // updateComponent を渡して ReactiveEffect (Observer 側)を生成する
    // それをinstance.effectに保持させる
    const effect = (instance.effect = new ReactiveEffect(
      componentUpdateFn,
      () => queueJob(update)
    ))

    // effect.run() は effect を実行する関数
    // 1. activeEffect に updateComponent (を持った ReactiveEffect) が設定される
    // 2. この状態で track が走ると、targetMap に target と updateComponent (を持った ReactiveEffect) のマップが登録される（リアクティブの形成）
    // 3. この状態で target が書き換えられ（setterが実行され）、trigger が走ると、targetMap から effect(今回の例だと updateComponent)をみつけ、実行する
    // このように画面の更新を行う関数を、instance.update に登録しておく
    const update: SchedulerJob = (instance.update = () => effect.run())
    update.id = instance.uid

    update()
  }

  const updateComponent = (n1: VNode, n2: VNode) => {
    const instance = (n2.component = n1.component)!
    instance.next = n2
    instance.update()
  }

  const render: RootRenderFunction = (rootComponent, container) => {
    const vnode = createVNode(rootComponent, {}, [])
    patch(null, vnode, container, null)
  }

  return { render }
}

// 最長増加部分列（LIS）： 配列内で値が単調増加する最も長い部分列
// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
function getSequence(arr: number[]): number[] {
  const p = arr.slice()
  const result = [0]
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      while (u < v) {
        c = (u + v) >> 1
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}
