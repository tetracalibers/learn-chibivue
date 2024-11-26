import { createDep, Dep } from './dep'
import { trackEffects, triggerEffects } from './effect'
import { toReactive } from './reactive'

//
// reactiveオブジェクトは、オブジェクトが持つ各プロパティに対する変更を追跡する
// - targetMapによってプロパティごとに購読者を管理する
// - track関数は、targetMapに購読者を登録する（内部ではtrackEffectsを呼び出す）
// - trigger関数は、targetMapから購読者を取り出して実行する（内部ではtriggerEffectsを呼び出す）
//
// refは、valueプロパティに対する変更を追跡する
// - targetMapの管理は不要なので、trackEffectsとtrriggerEffectを単体で呼び出す
// - valueプロパティにオブジェクトが設定された場合は、そのオブジェクトをreactiveに変換する
//

declare const RefSymbol: unique symbol

type RefBase<T> = {
  dep?: Dep // 値の購読者
  value: T // 値
}

export interface Ref<T = any> {
  value: T
  [RefSymbol]: true
}

export function isRef(r: any): r is Ref {
  return !!(r && r.__v_isRef === true)
}

// 現在のエフェクトをdepに登録する（depが存在しない場合は新たに作成する）
export function trackRefValue(ref: RefBase<any>) {
  trackEffects(ref.dep || (ref.dep = createDep()))
}

// depに登録されたエフェクトを実行する（depが存在する場合にのみ実行される）
export function triggerRefValue(ref: RefBase<any>) {
  if (ref.dep) triggerEffects(ref.dep)
}

class RefImpl<T> {
  private _value: T
  public dep?: Dep = undefined
  public readonly __v_isRef = true

  constructor(value: T) {
    // ref の値としてオブジェクトが代入された場合、そのオブジェクトを reactive に変換する
    this._value = toReactive(value)
  }

  // Refの値にアクセスされたら、現在のエフェクトをdepに登録する
  get value() {
    trackRefValue(this)
    return this._value
  }

  // Refの値が変更されたら、depに登録されたエフェクトを実行する
  set value(newVal) {
    this._value = toReactive(newVal)
    triggerRefValue(this)
  }
}
