import fs from 'node:fs'
import type { Plugin } from 'vite'
import { createFilter } from 'vite'
import { parse, rewriteDefault } from '../../compiler-sfc'
import { compile } from '../../compiler-dom'

export default function vitePluginChibivue(): Plugin {
  const filter = createFilter(/\.vue$/)

  return {
    name: 'vite:chibivue',

    //
    // 仮想モジュール（styleブロックの解決）
    // 1. resolveId に解決したいモジュールの id を任意に設定
    // 2. load でその id をハンドリングすることによってモジュールを読み込むことができる
    //

    resolveId(id) {
      // このidは実際には存在しないパスだが、loadで仮想的にハンドリングするのでidを返してあげる (読み込み可能だということにする)
      if (id.match(/\.vue\.css$/)) return id

      // ここでreturnされないidに関しては、実際にそのファイルが存在していたらそのファイルが解決されるし、存在していなければ存在しないというエラーになる
    },

    load(id) {
      // .vue.cssがloadされた (importが宣言され、読み込まれた) ときのハンドリング
      if (id.match(/\.vue\.css$/)) {
        // .cssを除いたファイルパス(つまり通常の Vue ファイル)から SFC をfs.readFileSyncで取得
        const filename = id.replace(/\.css$/, '')
        const content = fs.readFileSync(filename, 'utf-8')

        // パースして style タグの内容を取得
        const { descriptor } = parse(content, { filename })
        const styles = descriptor.styles.map((it) => it.content).join('\n')

        return { code: styles }
      }
    },

    //
    // vueファイルの変換（script, templateブロックの解決）
    //

    transform(code, id) {
      // transformの対象を「*.vue」に限定
      if (!filter(id)) return

      //
      // vueファイルだった場合はファイル内容を解析して、変換後のコードを返す
      //

      const outputs = []
      outputs.push("import * as ChibiVue from 'chibivue'\n")
      outputs.push("import '" + id + ".css'")

      const { descriptor } = parse(code, { filename: id })

      const SFC_MAIN = '_sfc_main'
      const scriptCode = rewriteDefault(
        descriptor.script?.content ?? '',
        SFC_MAIN
      )
      outputs.push(scriptCode)

      const templateCode = compile(descriptor.template?.content ?? '', {
        isBrowser: false,
      })
      outputs.push(templateCode)

      outputs.push('\n')
      outputs.push(`export default { ...${SFC_MAIN}, render }`)

      return { code: outputs.join('\n') }
    },
  }
}
