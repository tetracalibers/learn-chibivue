import { RendererOptions } from '../runtime-core'
import { patchAttr } from './modules/attrs'
import { patchEvent } from './modules/events'

type DOMRendererOptions = RendererOptions<Node, Element>

// onから始まる属性名かどうかを判定する
const onRE = /^on[^a-z]/
export const isOn = (key: string) => onRE.test(key)

export const patchProp: DOMRendererOptions['patchProp'] = (el, key, value) => {
  if (isOn(key)) {
    patchEvent(el, key, value) // onから始まる属性はイベントハンドラとして処理
  } else {
    patchAttr(el, key, value)
  }
}
