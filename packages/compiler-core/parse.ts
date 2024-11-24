import { TemplateChildNode } from './ast'

// parse する際に使う状態
// パース中に必要な情報をここにまとめる
export interface ParserContext {
  // 元々のテンプレート文字列
  readonly originalSource: string

  source: string

  // このパーサが読み取っている現在地
  offset: number
  line: number
  column: number
}

function createParserContext(content: string): ParserContext {
  return {
    originalSource: content,
    source: content,
    column: 1,
    line: 1,
    offset: 0,
  }
}

// template の文字列を AST に変換する
export const baseParse = (
  content: string
): { children: TemplateChildNode[] } => {
  const context = createParserContext(content) // contextを生成

  // TODO:
  return { children: [] }
}
