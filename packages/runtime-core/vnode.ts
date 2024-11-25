import { ComponentInternalInstance } from './component'
import { RendererNode } from './renderer'

export const Text = Symbol()

export type VNodeTypes = string | typeof Text | object

export interface VNode<HostNode = RendererNode> {
  type: VNodeTypes
  props: VNodeProps | null
  children: VNodeNormalizedChildren
  el: HostNode | undefined // 実際のDOMへの参照
  key: string | number | symbol | null
  component: ComponentInternalInstance | null // コンポーネントのインスタンス
}

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
  const vnode: VNode = {
    type,
    props,
    children,
    el: undefined,
    key: props?.key ?? null,
    component: null,
  }
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
