export type ComponentOptions = {
  render?: Function
  setup?: (
    props: Record<string, any>,
    ctx: { emit: (event: string, ...args: any[]) => void }
  ) => Function | Record<string, unknown>
  props?: Record<string, any>
  template?: string
}
