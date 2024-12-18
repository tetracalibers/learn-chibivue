// Node の種類を表す
// ここでいう Node というのは HTML の Node のことではなく、あくまでこのテンプレートコンパイラで扱う粒度であることに注意
export const enum NodeTypes {
  ELEMENT,
  TEXT,
  INTERPOLATION, // マスタッシュ構文

  ATTRIBUTE,
  DIRECTIVE,
}

// 全ての Node は type と loc を持つ
// loc は location のことで、この Node がソースコード(テンプレート文字列)のどこに該当するかの情報を保持する
export interface Node {
  type: NodeTypes
  loc: SourceLocation
}

export interface ElementNode extends Node {
  type: NodeTypes.ELEMENT
  tag: string // eg. "div"
  props: Array<AttributeNode | DirectiveNode>
  children: TemplateChildNode[]
  isSelfClosing: boolean // eg. <img /> -> true
}

// ElementNode が持つ属性
// eg. { name: "class", value: { content: "container" } }
export interface AttributeNode extends Node {
  type: NodeTypes.ATTRIBUTE
  name: string
  value: TextNode | undefined
}

// ディレクティブ
// v-name:arg="exp" というような形式で表すことにする
// eg. v-on:click="increment"の場合は { name: "on", arg: "click", exp="increment" }
export interface DirectiveNode extends Node {
  type: NodeTypes.DIRECTIVE
  name: string
  arg: string
  exp: string
}

export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION
  content: string // マスタッシュの中に記述された内容
}

export type TemplateChildNode = ElementNode | TextNode | InterpolationNode

export interface TextNode extends Node {
  type: NodeTypes.TEXT
  content: string
}

// location の情報
// - start, end に位置情報が入る
// - source には実際のコード(文字列)が入る
export interface SourceLocation {
  start: Position
  end: Position
  source: string
}

export interface Position {
  offset: number // from start of file
  line: number
  column: number
}
