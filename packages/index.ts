import { compile } from './compiler-dom'
import { InternalRenderFunction, registerRuntimeCompiler } from './runtime-core'
import * as runtimeDom from './runtime-dom'

// 実際に実行可能な関数を生成する
function compileToFunction(template: string): InternalRenderFunction {
  const code = compile(template)
  // JavaScriptでは、Function コンストラクタを利用することで文字列から関数を生成することが可能
  return new Function('ChibiVue', code)(runtimeDom)
}
// 生成した関数を登録する
registerRuntimeCompiler(compileToFunction)

export * from './runtime-core'
export * from './runtime-dom'
export * from './reactivity'
