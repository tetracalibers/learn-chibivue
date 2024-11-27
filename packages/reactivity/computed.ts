import { isFunction } from '../shared'
import { Dep } from './dep'
import { ReactiveEffect } from './effect'
import { Ref, trackRefValue, triggerRefValue } from './ref'

declare const ComputedRefSymbol: unique symbol

export interface ComputedRef<T = any> extends Ref {
  readonly value: T
  [ComputedRefSymbol]: true
}

export type ComputedGetter<T> = (...args: any[]) => T
export type ComputedSetter<T> = (v: T) => void

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T>

  const onlyGetter = isFunction(getterOrOptions)

  if (onlyGetter) {
    getter = getterOrOptions
    setter = () => {}
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  return new ComputedRefImpl(getter, setter) as any
}

export class ComputedRefImpl<T> {
  public dep?: Dep = undefined

  private _value!: T
  public readonly effect: ReactiveEffect<T>

  public readonly __v_isRef = true
  public _dirty = true // 再計算する必要があるか？を表すフラグ

  constructor(
    getter: ComputedGetter<T>,
    private readonly _setter: ComputedSetter<T>
  ) {
    this.effect = new ReactiveEffect(getter, () => {
      // _dirtyフラグの書き換えをスケジューラのジョブとして実行する
      // 不特定多数の依存に trigger されるため、スケジューリングが必要
      if (!this._dirty) {
        this._dirty = true
        // _dirty フラグを true に書き換えた段階で自身が持つ依存関係は trigger してしまう
        triggerRefValue(this)
      }
    })
  }

  get value() {
    trackRefValue(this)
    if (this._dirty) {
      // 再計算が必要な場合、getter を実行してvalueを更新する
      this._dirty = false
      this._value = this.effect.run()
    }
    return this._value
  }

  set value(newValue: T) {
    this._setter(newValue)
  }
}
