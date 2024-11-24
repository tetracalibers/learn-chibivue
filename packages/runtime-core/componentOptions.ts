export type ComponentOptions = {
  render?: Function
  setup?: (
    props: Record<string, any>,
    ctx: { emit: (event: string, ...args: any[]) => void }
  ) => Function
  props?: Record<string, any>
}
