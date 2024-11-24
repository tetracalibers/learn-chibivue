const defaultExportRE = /((?:^|\n|;)\s*)export(\s*)default/
const namedDefaultExportRE = /((?:^|\n|;)\s*)export(.+)(?:as)?(\s*)default/s

// input: 対象のソースコード
// as: 最終的にバインドしたい変数名
export function rewriteDefault(input: string, as: string): string {
  // export の宣言が存在しない場合のハンドリング
  if (!hasDefaultExport(input)) {
    // 空のオブジェクトをバインドして終了
    return input + `\nconst ${as} = {}`
  }

  // TODO:
  return ''
}

export function hasDefaultExport(input: string): boolean {
  return defaultExportRE.test(input) || namedDefaultExportRE.test(input)
}
