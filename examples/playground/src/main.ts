import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ list: ['A', 'B', 'C', 'D'] })
    const updateList = () => {
      state.list = ['1', '2', '3']
    }

    return () =>
      h('div', { id: 'app' }, [
        h(
          'ul',
          {},
          state.list.map((item) => h('li', {}, [item]))
        ),
        h('button', { onClick: updateList }, ['update']),
      ])
  },
})

app.mount('#app')
