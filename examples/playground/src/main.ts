import { createApp, h, shallowRef } from 'chibivue'

const app = createApp({
  setup() {
    const state = shallowRef({ count: 0 })

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.value.count}`]),

        h(
          'button',
          {
            onClick: () => {
              // 描画が更新される
              state.value = { count: state.value.count + 1 }
              console.log('valueを更新：', state.value.count)
            },
          },
          ['increment']
        ),

        h(
          'button',
          {
            onClick: () => {
              // 描画は更新されない（が、内部の値はインクリメントされる）
              state.value.count++
              console.log('value.countを更新：', state.value.count)
            },
          },
          ['not trigger ...']
        ),
      ])
  },
})

app.mount('#app')
