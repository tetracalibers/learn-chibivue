import { computed, createApp, h, reactive, ref } from 'chibivue'

const app = createApp({
  setup() {
    const count = reactive({ value: 0 })
    const count2 = reactive({ value: 0 })

    const double = computed(() => count.value * 2)
    const doubleDouble = computed(() => double.value * 2)

    const countRef = ref(0)
    const doubleCountRef = computed(() => countRef.value * 2)

    return () =>
      h('div', {}, [
        h('pre', {}, [`count           : ${count.value}`]),
        h('pre', {}, [`count2          : ${count2.value}`]),
        h('pre', {}, [`count * 2       : ${double.value}`]),
        h('pre', {}, [`(count * 2) * 2 : ${doubleDouble.value}`]),
        h('pre', {}, [`countRef * 2    : ${doubleCountRef.value}`]),
        h('button', { onClick: () => count.value++ }, ['update count']),
        h('button', { onClick: () => count2.value++ }, ['update count2']),
        h('button', { onClick: () => countRef.value++ }, ['update countRef']),
      ])
  },
})

app.mount('#app')
