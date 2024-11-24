import type { Plugin } from 'vite'
import { createFilter } from 'vite'

export default function vitePluginChibivue(): Plugin {
  const filter = createFilter(/\.vue$/)

  return {
    name: 'vite:chibivue',

    transform(code, id) {
      // transformの対象を「*.vue」に限定
      if (!filter(id)) return

      // vueファイルだった場合はファイル内容にtransform
      return { code: `export default {}` }
    },
  }
}
