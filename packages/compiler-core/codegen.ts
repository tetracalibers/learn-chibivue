import { toHandlerKey } from '../shared'
import {
  AttributeNode,
  DirectiveNode,
  ElementNode,
  InterpolationNode,
  NodeTypes,
  TemplateChildNode,
  TextNode,
} from './ast'
import { CompilerOptions } from './options'

// parseの結果（AST）をもとにコード（文字列）を生成
export const generate = (
  { children }: { children: TemplateChildNode[] },
  option: Required<CompilerOptions>
): string => {
  // ブラウザモードでない場合には with 文を含まないコードを生成
  // Vite は ESM を扱う都合上、非厳格モード（sloppy モード）でのみ動作するコードを処理できず、with 文を扱うことができないため

  // 'return' のプレフィックスを決定
  const returnPrefix = option.isBrowser ? 'return ' : ''

  // 'with' 文の開始と終了を決定
  const withOpen = option.isBrowser ? 'with (_ctx) {' : ''
  const withClose = option.isBrowser ? '}' : ''

  // render 関数の本体を生成
  const renderBody = `
    const { h } = ChibiVue;
    return ${genNode(children[0], option)};
  `

  // 最終的なコードを組み立て
  const renderFunction = `${returnPrefix}function render(_ctx) {
    ${withOpen}
      ${renderBody}
    ${withClose}
  }`

  return renderFunction
}

const genNode = (
  node: TemplateChildNode,
  option: Required<CompilerOptions>
): string => {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      return genElement(node, option)
    case NodeTypes.TEXT:
      return genText(node)
    case NodeTypes.INTERPOLATION:
      return genInterpolation(node, option)
    default:
      return ''
  }
}

const genElement = (
  el: ElementNode,
  option: Required<CompilerOptions>
): string => {
  return `h("${el.tag}", {${el.props
    .map((prop) => genProp(prop, option))
    .join(
      ', '
    )}}, [${el.children.map((it) => genNode(it, option)).join(', ')}])`
}

const genProp = (
  prop: AttributeNode | DirectiveNode,
  option: Required<CompilerOptions>
): string => {
  switch (prop.type) {
    case NodeTypes.ATTRIBUTE:
      return `${prop.name}: "${prop.value?.content}"`
    case NodeTypes.DIRECTIVE: {
      switch (prop.name) {
        case 'on':
          // バインド対象のデータに関しては、 with 文を使用せずに prefix として _cxt.　を付与する形で制御
          return `${toHandlerKey(prop.arg)}: ${
            option.isBrowser ? '' : '_ctx.'
          }${prop.exp}`
        default:
          // TODO: other directives
          throw new Error(`unexpected directive name. got "${prop.name}"`)
      }
    }
    default:
      throw new Error(`unexpected prop type.`)
  }
}

const genText = (text: TextNode): string => {
  return `\`${text.content}\``
}

const genInterpolation = (
  node: InterpolationNode,
  option: Required<CompilerOptions>
): string => {
  // バインド対象のデータに関しては、 with 文を使用せずに prefix として _cxt.　を付与する形で制御
  return `${option.isBrowser ? '' : '_ctx.'}${node.content}`
}
