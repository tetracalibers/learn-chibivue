import { IfAny } from '../shared'
import { createDep, Dep } from './dep'
import { getDepFromReactive, trackEffects, triggerEffects } from './effect'
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

export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
export function isRef(r: any): r is Ref {
  return !!(r && r.__v_isRef === true)
}

//
// ref
//

export function ref<T = any>(): Ref<T | undefined>
export function ref<T = any>(value: T): Ref<T>
export function ref(value?: unknown) {
  return createRef(value, false)
}

//
// shallow ref
//

declare const ShallowRefMarker: unique symbol
export type ShallowRef<T = any> = Ref<T> & { [ShallowRefMarker]?: true }

export function shallowRef<T extends object>(
  value: T
): T extends Ref ? T : ShallowRef<T>
export function shallowRef<T>(value: T): ShallowRef<T>
export function shallowRef<T = any>(): ShallowRef<T | undefined>
export function shallowRef(value?: unknown) {
  return createRef(value, true)
}

//
// common
//

function createRef(rawValue: unknown, shallow: boolean) {
  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue, shallow)
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

  constructor(
    value: T,
    public readonly __v_isShallow: boolean
  ) {
    // ref： 深いリアクティブ（オブジェクトが代入された場合、そのオブジェクトを reactive に変換する）
    // shallow ref： 浅いリアクティブ（reactive への変換をスキップ）
    this._value = __v_isShallow ? value : toReactive(value)
  }

  // Refの値にアクセスされたら、現在のエフェクトをdepに登録する
  get value() {
    trackRefValue(this)
    return this._value
  }

  // Refの値が変更されたら、depに登録されたエフェクトを実行する
  set value(newVal) {
    this._value = this.__v_isShallow ? newVal : toReactive(newVal)
    triggerRefValue(this)
  }
}

//
// trigger ref
//

export function triggerRef(ref: Ref) {
  triggerRefValue(ref)
}

//
// to ref
//
// toRef によって作られた ref は元の reactive オブジェクトと同期される
// - この ref に変更を加えると元の reactive オブジェクトも更新される
// - 元の reactive オブジェクトに変更があるとこの ref も更新される
//

export type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>

export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K
): ToRef<T[K]>
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue: T[K]
): ToRef<Exclude<T[K], undefined>>
export function toRef(
  source: Record<string, any>, // reactive オブジェクト
  key?: string, // refに変換したいプロパティ
  defaultValue?: unknown
): Ref {
  return propertyToRef(source, key!, defaultValue)
}

function propertyToRef(
  source: Record<string, any>,
  key: string,
  defaultValue?: unknown
) {
  return new ObjectRefImpl(source, key, defaultValue) as any
}

class ObjectRefImpl<T extends object, K extends keyof T> {
  public readonly __v_isRef = true

  constructor(
    private readonly _object: T,
    private readonly _key: K,
    private readonly _defaultValue?: T[K]
  ) {}

  get value() {
    // 元のリアクティブオブジェクトのプロパティを直接取り出す
    const val = this._object[this._key]
    return val === undefined ? (this._defaultValue as T[K]) : val
  }

  set value(newVal) {
    // 元のリアクティブオブジェクトのプロパティを直接更新
    this._object[this._key] = newVal
  }

  get dep(): Dep | undefined {
    return getDepFromReactive(this._object, this._key)
  }
}
