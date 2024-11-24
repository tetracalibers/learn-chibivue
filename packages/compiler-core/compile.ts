import { generate } from './codegen'
import { baseParse } from './parse'

// templateから関数のコードを生成する
export function baseCompile(template: string) {
  // template -> AST
  const parseResult = baseParse(template.trim()) // templateはトリムしておく
  // AST -> code
  const code = generate(parseResult)

  return code
}
