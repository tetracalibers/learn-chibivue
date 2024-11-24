//
// render のロジックのみを持つオブジェクトを生成するためのファクトリ関数を実装する
// Node(DOMに限らず)を扱うオブジェクトは factory の関数の引数として受け取るようにする
//

import { VNode, Text } from './vnode'

export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement,
> {
  patchProp(el: HostElement, key: string, value: any): void
  createElement(type: string): HostNode
  createText(text: string): HostNode
  setElementText(node: HostNode, text: string): void
  insert(child: HostNode, parent: HostNode, anchor?: HostNode | null): void
}

export interface RendererNode {
  [key: string]: any
}

export interface RendererElement extends RendererNode {}

export type RootRenderFunction<HostElement = RendererElement> = (
  message: string,
  container: HostElement
) => void

export function createRenderer(options: RendererOptions) {
  const {
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    insert: hostInsert,
  } = options

  const patch = (n1: VNode | null, n2: VNode, container: RendererElement) => {
    const { type } = n2
    if (type === Text) {
      // processText(n1, n2, container);
    } else {
      // processElement(n1, n2, container);
    }
  }

  const render: RootRenderFunction = (vnode, container) => {
    // TODO
  }

  return { render }
}
