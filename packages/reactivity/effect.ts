import { isArray } from '../shared'
import { Dep, createDep } from './dep'

// target: リアクティブにしたいオブジェクト
type Target = any // 任意のtarget
type TargetKey = any // targetが持つ任意のkey

// targetのkeyと作用のマップ
// - dep：target[key]の値を追跡して処理を行う関数（Reactive Effect）の集合
// - Reactive Effect：依存関係を自動的に追跡し、依存関係が変更されるたびに再実行する副作用（エフェクト）
type KeyToDepMap = Map<TargetKey, Dep>
// エフェクトの購読を格納するマップ
const targetMap = new WeakMap<Target, KeyToDepMap>()

// trackで登録する関数（作用）を管理する
export let activeEffect: ReactiveEffect | undefined

export type EffectScheduler = (...args: any[]) => any

//
// Reactive な作用として扱うものを、2パターンに分ける
// - 能動的に実行する作用： 作用を設定した側で明示的に呼び出される
// - 受動的に実行される作用： dep に追加された後で、何らかの外部のアクションによって trigger される
//
// スケジューリングの対応が必要なのは、受動的に実行される作用のみ
// （不特定多数の depsMap に追加され，バラバラにいろんなところから trigger されるため）
//

export class ReactiveEffect<T = any> {
  constructor(
    public fn: () => T, // 能動的な作用
    public scheduler: EffectScheduler | null = null // 受動的な作用
  ) {}

  run() {
    // ※ fnを実行する前のactiveEffectを保持しておいて、実行が終わった後元に戻します。
    // これをやらないと、どんどん上書きしてしまって、意図しない挙動をしてしまいます。(用が済んだら元に戻そう)
    let parent: ReactiveEffect | undefined = activeEffect
    activeEffect = this
    const res = this.fn()
    activeEffect = parent
    return res
  }
}

// TargetMap に登録する
export function track(target: object, key: unknown) {
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    // target[key]が初めて追跡された場合は、Setがまだ存在しないので新規作成
    depsMap.set(key, (dep = createDep()))
  }

  trackEffects(dep)
}

// 現在実行中のエフェクトがあれば、dep に追加する
export function trackEffects(dep: Dep) {
  if (activeEffect) {
    dep.add(activeEffect)
  }
}

// TargetMap から作用を取り出して実行する
export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)

  // 購読者がいない場合は何もしない（実行すべき作用がない）
  if (!depsMap) return

  // target[key]を追跡している作用を取得
  const dep = depsMap.get(key)

  if (dep) {
    const effects = [...dep]
    triggerEffects(effects)
  }
}

// 作用のリストを順に実行する
export function triggerEffects(dep: Dep | ReactiveEffect[]) {
  const effects = isArray(dep) ? dep : [...dep]
  for (const effect of effects) {
    triggerEffect(effect)
  }
}

// 作用を実行する
function triggerEffect(effect: ReactiveEffect) {
  if (effect.scheduler) {
    // scheduler を優先して実行
    effect.scheduler()
  } else {
    // なければ通常の作用を実行
    effect.run()
  }
}

export function getDepFromReactive(object: any, key: string | number | symbol) {
  return targetMap.get(object)?.get(key)
}
