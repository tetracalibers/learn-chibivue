import {
  ElementNode,
  NodeTypes,
  Position,
  SourceLocation,
  TemplateChildNode,
  TextNode,
} from './ast'

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
  // contextを生成
  const context = createParserContext(content)
  // 子ノードをパースする
  const children = parseChildren(context, [])

  return { children }
}

function parseChildren(
  context: ParserContext,

  // HTMLは再起的な構造を持っているため、祖先要素をスタックとして持っておいて、子にネストして行くたびにpushしていく
  // endタグを見つけたら、parseChildrenを終了してancestorsをpopする
  ancestors: ElementNode[]
): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = []

  while (!isEnd(context, ancestors)) {
    const s = context.source
    let node: TemplateChildNode | undefined = undefined

    if (s[0] === '<') {
      // sが"<"で始まり、かつ次の文字がアルファベットの場合は要素としてパースする
      if (/[a-z]/i.test(s[1])) {
        // node = parseElement(context, ancestors)
      }
    }

    if (!node) {
      // 上記の条件に当てはまらなかった場合はTextNodeとしてパースする
      node = parseText(context)
    }

    pushNode(nodes, node)
  }

  return nodes
}

// 子要素パースの while を判定(パース終了)するための関数
function isEnd(context: ParserContext, ancestors: ElementNode[]): boolean {
  const s = context.source

  // 閉じタグがあるか(parseChildrenが終了するべきか)を判定する
  // sが"</"で始まり、かつその後にancestorsのタグ名が続くかどうか
  if (startsWith(s, '</')) {
    for (let i = ancestors.length - 1; i >= 0; --i) {
      if (startsWithEndTagOpen(s, ancestors[i].tag)) {
        return true
      }
    }
  }

  return !s
}

function startsWith(source: string, searchString: string): boolean {
  return source.startsWith(searchString)
}

function pushNode(nodes: TemplateChildNode[], node: TemplateChildNode): void {
  // Textが連続している場合は結合する
  if (node.type === NodeTypes.TEXT) {
    const prev = last(nodes)
    if (prev && prev.type === NodeTypes.TEXT) {
      prev.content += node.content
      return
    }
  }

  nodes.push(node)
}

function last<T>(xs: T[]): T | undefined {
  return xs[xs.length - 1]
}

function startsWithEndTagOpen(source: string, tag: string): boolean {
  return (
    startsWith(source, '</') &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
    /[\t\r\n\f />]/.test(source[2 + tag.length] || '>')
  )
}

function parseText(context: ParserContext): TextNode {
  // "<" (タグの開始(開始タグ終了タグ問わず))まで読み進め、何文字読んだかを元にTextデータの終了時点のindexを算出する
  const endToken = '<'
  let endIndex = context.source.length
  const index = context.source.indexOf(endToken, 1)
  if (index !== -1 && endIndex > index) {
    endIndex = index
  }

  const start = getCursor(context) // これは loc 用

  // endIndexの情報を元に Text データをパースする
  const content = parseTextData(context, endIndex)

  return {
    type: NodeTypes.TEXT,
    content,
    loc: getSelection(context, start),
  }
}

// content と length を元に text を抽出する
function parseTextData(context: ParserContext, length: number): string {
  const rawText = context.source.slice(0, length)
  advanceBy(context, length)
  return rawText
}

function advanceBy(context: ParserContext, numberOfCharacters: number): void {
  const { source } = context
  advancePositionWithMutation(context, source, numberOfCharacters)
  context.source = source.slice(numberOfCharacters)
}

function advanceSpaces(context: ParserContext): void {
  const match = /^[\t\r\n\f ]+/.exec(context.source)
  if (match) {
    advanceBy(context, match[0].length)
  }
}

// pos の計算を行う
// 引数でもらった pos のオブジェクトを破壊的に更新する
function advancePositionWithMutation(
  pos: Position,
  source: string,
  numberOfCharacters: number = source.length
): Position {
  let linesCount = 0
  let lastNewLinePos = -1
  for (let i = 0; i < numberOfCharacters; i++) {
    if (source.charCodeAt(i) === 10 /* newline char code */) {
      linesCount++
      lastNewLinePos = i
    }
  }

  pos.offset += numberOfCharacters
  pos.line += linesCount
  pos.column =
    lastNewLinePos === -1
      ? pos.column + numberOfCharacters
      : numberOfCharacters - lastNewLinePos

  return pos
}

function getCursor(context: ParserContext): Position {
  const { column, line, offset } = context
  return { column, line, offset }
}

function getSelection(
  context: ParserContext,
  start: Position,
  end?: Position
): SourceLocation {
  end = end || getCursor(context)
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset),
  }
}
