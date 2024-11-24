import { ReactiveEffect } from '../reactivity'
import { emit } from './componentEmits'
import { ComponentOptions } from './componentOptions'
import { initProps, Props } from './componentProps'
import { VNode, VNodeChild } from './vnode'

type CompileFunction = (template: string) => InternalRenderFunction

// コンパイラ本体を保持する変数
let compile: CompileFunction | undefined

// コンパイラを登録する関数
export function registerRuntimeCompiler(_compile: any) {
  compile = _compile
}

export type Component = ComponentOptions

export type Data = Record<string, unknown>

export interface ComponentInternalInstance {
  type: Component // 元となるユーザー定義のコンポーネント
  vnode: VNode
  subTree: VNode // レンダリング結果であるVNode 1（差分を比較するためのもの）
  next: VNode | null // レンダリング結果である VNode 2（差分を比較するためのもの）
  effect: ReactiveEffect
  render: InternalRenderFunction
  update: () => void
  isMounted: boolean
  propsOptions: Props // コンポーネントの定義に含まれる、propsオプションの値
  props: Data // 実際に親から渡されたデータ
  emit: (event: string, ...args: any[]) => void
  setupState: Data // setupの結果がオブジェクトの場合、ここに格納
}

export type InternalRenderFunction = {
  (): VNodeChild
}

// コンポーネントのインスタンスを生成するための関数(コンストラクタの役割をするもの)
export function createComponentInstance(
  vnode: VNode
): ComponentInternalInstance {
  const type = vnode.type as Component

  // 各プロパティの型は non-null だが，インスタンスを生成した段階では null で入れてしまう
  const instance: ComponentInternalInstance = {
    type,
    vnode,
    next: null,
    effect: null!,
    subTree: null!,
    update: null!,
    render: null!,
    propsOptions: type.props || {},
    props: {},
    emit: null!, // to be set immediately
    setupState: {},
    isMounted: false,
  }

  instance.emit = emit.bind(null, instance)

  return instance
}

export const setupComponent = (instance: ComponentInternalInstance) => {
  // propsを初期化
  const { props } = instance.vnode
  initProps(instance, props)

  // setupを実行し、その結果をインスタンスに保持
  const component = instance.type as Component
  if (component.setup) {
    // setup関数が実行された時点で reactive proxy が生成される
    // componentRender は setup 関数の戻り値である render 関数
    // - render 関数は proxy によって作られたオブジェクトを参照している
    // - 実際に rerder 関数が走った時、target の getter 関数が実行され，track が実行されるようになっている
    const setupResult = component.setup(instance.props, {
      emit: instance.emit,
    }) as InternalRenderFunction

    if (typeof setupResult === 'function') {
      instance.render = setupResult
    } else if (typeof setupResult === 'object' && setupResult !== null) {
      instance.setupState = setupResult
    } else {
      // do nothing
    }
  }

  // コンパイルを実行することで生成されたrender関数をインスタンスに保持
  if (compile && !component.render) {
    const template = component.template ?? ''
    if (template) {
      instance.render = compile(template)
    }
  }
}
