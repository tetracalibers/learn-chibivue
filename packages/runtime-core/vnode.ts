import { isObject, isString } from '../shared/general'
import { ShapeFlags } from '../shared/shapeFlags'
import { ComponentInternalInstance } from './component'
import { RendererNode } from './renderer'

export const Text = Symbol()

export type VNodeTypes = string | typeof Text | object

export interface VNode<HostNode = RendererNode> {
  type: VNodeTypes
  props: VNodeProps | null
  children: VNodeNormalizedChildren
  el: HostNode | undefined // 実際のDOMへの参照
  key: VNodeKey | null
  component: ComponentInternalInstance | null // コンポーネントのインスタンス
  shapeFlag: number
}

export type VNodeKey = string | number | symbol

export interface VNodeProps {
  [key: string]: any
}

export type VNodeNormalizedChildren = string | VNodeArrayChildren
export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>

export type VNodeChild = VNodeChildAtom | VNodeArrayChildren
type VNodeChildAtom = VNode | string

export function createVNode(
  type: VNodeTypes,
  props: VNodeProps | null,
  children: VNodeNormalizedChildren
): VNode {
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isObject(type)
      ? ShapeFlags.COMPONENT
      : 0

  const vnode: VNode = {
    type,
    props,
    children,
    el: undefined,
    key: props?.key ?? null,
    component: null,
    shapeFlag,
  }

  normalizeChildren(vnode, children)

  return vnode
}

export function normalizeVNode(child: VNodeChild): VNode {
  if (typeof child === 'object') {
    return { ...child } as VNode
  } else {
    // stringだった場合（テキスト）もVNodeとして扱えるようにする
    return createVNode(Text, null, String(child))
  }
}

export function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0
  if (children == null) {
    children = null
  } else if (Array.isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else {
    children = String(children)
    type = ShapeFlags.TEXT_CHILDREN
  }
  vnode.children = children as VNodeNormalizedChildren
  // 複数のフラグを一つの整数値に組み合わせる
  // - ビット演算 OR は、対応するビットがどちらか一方でも立っていれば、そのビットを立てる
  vnode.shapeFlag |= type
}

export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}
