import { Dep, createDep } from './dep'

// target: リアクティブにしたいオブジェクト
type Target = any // 任意のtarget
type TargetKey = any // targetが持つ任意のkey

// targetのkeyと作用のマップ
// - dep: 実行したい作用(関数)
type KeyToDepMap = Map<TargetKey, Dep>
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
    depsMap.set(key, (dep = createDep()))
  }

  if (activeEffect) {
    dep.add(activeEffect)
  }
}

// TargetMap から作用を取り出して実行する
export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key)

  if (dep) {
    const effects = [...dep]
    for (const effect of effects) {
      if (effect.scheduler) {
        // scheduler を優先して実行
        effect.scheduler()
      } else {
        // なければ通常の作用を実行
        effect.run()
      }
    }
  }
}
