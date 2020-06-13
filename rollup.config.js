import pkg from './package.json';

const input = 'src/index.js';

export default [
  // browser-friendly UMD build
  {
    input,
    output: {
      name: pkg.name,
      file: pkg.browser,
      format: 'umd',
      sourcemap: true,
      globals: {
        '@ethersproject/contracts': 'contracts',
        '@ethersproject/providers': 'providers',
      },
    },
    external: ['@ethersproject/contracts', '@ethersproject/providers'],
  },

  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // an array for the `output` option, where we can specify
  // `file` and `format` for each target)
  {
    input,
    external: ['ms', '@ethersproject/contracts', '@ethersproject/providers'],
    output: [
      {file: pkg.main, format: 'cjs'},
      {file: pkg.module, format: 'es'},
    ],
  },
];
