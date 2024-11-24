import { reactive } from '../reactivity'
import { camelize, hasOwn } from '../shared'
import { ComponentInternalInstance, Data } from './component'

export type Props = Record<string, PropOptions | null>

export interface PropOptions<T = any> {
  type?: PropType<T> | true | null
  required?: boolean
  default?: null | undefined | object
}

export type PropType<T> = { new (...args: any[]): T & {} }

export function initProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null
) {
  const props: Data = {}
  // vnode が保持している props を propsOptions を元にフィルターする
  setFullProps(instance, rawProps, props)
  // フィルターしてできたオブジェクトを reactive 関数によってリアクティブなオブジェクトにする
  instance.props = reactive(props)
}

function setFullProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  props: Data
) {
  const options = instance.propsOptions

  if (rawProps) {
    for (let key in rawProps) {
      const value = rawProps[key]

      // kebab -> camel
      let camelKey
      if (options && hasOwn(options, (camelKey = camelize(key)))) {
        props[camelKey] = value
      }
    }
  }
}

export function updateProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null
) {
  const { props } = instance
  Object.entries(rawProps ?? {}).forEach(([key, value]) => {
    // kebab -> camel
    props[camelize(key)] = value
  })
}
