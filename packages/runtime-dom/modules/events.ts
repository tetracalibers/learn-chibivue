interface Invoker extends EventListener {
  value: EventValue
}

type EventValue = Function

export function addEventListener(
  el: Element,
  event: string,
  handler: EventListener
) {
  el.addEventListener(event, handler)
}

export function removeEventListener(
  el: Element,
  event: string,
  handler: EventListener
) {
  el.removeEventListener(event, handler)
}

export function patchEvent(
  el: Element & { _vei?: Record<string, Invoker | undefined> },
  rawName: string,
  value: EventValue | null
) {
  // 同じ要素に対して重複して addEventListener しないように、
  // 要素に _vei (vue event invokers)という名前で invoker を生やしてあげる
  const invokers = el._vei || (el._vei = {})
  // patch 時に existingInvoker.value を更新することで、
  // 重複して addEventListener せずにハンドラを更新することができる
  const existingInvoker = invokers[rawName]

  if (value && existingInvoker) {
    // patch
    existingInvoker.value = value
  } else {
    const name = parseName(rawName)
    if (value) {
      // add
      const invoker = (invokers[rawName] = createInvoker(value))
      addEventListener(el, name, invoker)
    } else if (existingInvoker) {
      // remove
      removeEventListener(el, name, existingInvoker)
      invokers[rawName] = undefined
    }
  }
}

// props のキー名は onClick や onInput のようになっているので、
// それらを on を除いた小文字に変換する
function parseName(rawName: string): string {
  return rawName.slice(2).toLocaleLowerCase()
}

function createInvoker(initialValue: EventValue) {
  const invoker: Invoker = (e: Event) => {
    invoker.value(e)
  }
  invoker.value = initialValue
  return invoker
}
