import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const state = ref({ count: 0 })

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.value.count}`]),

        h(
          'button',
          {
            onClick: () => {
              // 描画が更新される
              state.value = { count: state.value.count + 1 }
            },
          },
          ['increment']
        ),

        h(
          'button',
          {
            onClick: () => {
              // 描画が更新される
              state.value.count++
            },
          },
          ['not trigger ... ?']
        ),
      ])
  },
})

app.mount('#app')
