import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['src/index'],
  clean: true,
  declaration: true,
  rollup: {
    emitCJS: true,
  },
  externals: [
    '@aptx/api-query-adapter',
    '@tanstack/vue-query',
    '@tanstack/query-core',
    'vue',
  ],
})
