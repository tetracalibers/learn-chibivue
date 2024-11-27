import { computed, createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const count = ref(0)

    const writeableDouble = computed<number>({
      get: () => count.value * 2,
      set: (val) => {
        console.log('set double:', val)
        count.value = val
      },
    })

    return () =>
      h('div', {}, [
        h('pre', {}, [`count : ${count.value}`]),
        h('pre', {}, [`double: ${writeableDouble.value}`]),
        h('button', { onClick: () => count.value++ }, ['update count']),
        h('button', { onClick: () => writeableDouble.value++ }, [
          'update double',
        ]),
      ])
  },
})

app.mount('#app')
