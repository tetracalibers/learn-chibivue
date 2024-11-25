//
// DOM操作をするためのオブジェクトを実装する
//

import { RendererOptions } from '../runtime-core'

export const nodeOps: Omit<RendererOptions, 'patchProp'> = {
  createElement: (tagName) => {
    return document.createElement(tagName)
  },

  createText: (text: string) => {
    return document.createTextNode(text)
  },

  setText: (node, text) => {
    node.nodeValue = text
  },

  setElementText(node, text) {
    node.textContent = text
  },

  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null)
  },

  remove: (child) => {
    const parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  },

  parentNode: (node) => {
    return node.parentNode
  },
}
