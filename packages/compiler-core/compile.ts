import { baseParse } from './parse'

// template から関数の文字列を生成する
export function baseCompile(template: string) {
  const parseResult = baseParse(template.trim()) // templateはトリムしておく

  // 生成されたASTをconsoleに出力して確認
  console.log(
    '🚀 ~ file: compile.ts:6 ~ baseCompile ~ parseResult:',
    parseResult
  )

  // TODO: codegen
  // const code = generate(parseResult);
  // return code;
  return ''
}
