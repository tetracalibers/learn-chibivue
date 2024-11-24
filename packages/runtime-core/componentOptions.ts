export type ComponentOptions = {
  render?: Function
  setup?: (props: Record<string, any>) => Function
  props?: Record<string, any>
}
