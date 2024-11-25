import { generate } from './codegen'
import { CompilerOptions } from './options'
import { baseParse } from './parse'

// templateから関数のコードを生成する
export function baseCompile(
  template: string,
  option: Required<CompilerOptions>
) {
  // template -> AST
  const parseResult = baseParse(template.trim()) // templateはトリムしておく
  // AST -> code
  const code = generate(parseResult, option)

  return code
}
