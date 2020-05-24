import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from '@rollup/plugin-json';
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
			sourcemap: true
		},
		plugins: [
			// resolve(), // so Rollup can find `ms`
			// commonjs({
			// 	namedExports: {
			// 		"../node_modules/bn.js/lib/bn.js" : ["BN"],
			// 		"../node_modules/elliptic/lib/elliptic.js": ["ec"]
			// 	}
			// }), // so Rollup can convert `ms` to an ES module
			// json()
		],
		// external: [ '' ]
	},

	// CommonJS (for Node) and ES module (for bundlers) build.
	// (We could have three entries in the configuration array
	// instead of two, but it's quicker to generate multiple
	// builds from a single configuration where possible, using
	// an array for the `output` option, where we can specify 
	// `file` and `format` for each target)
	{
		input,
		external: ['ms'],
		output: [
			{ file: pkg.main, format: 'cjs' },
			{ file: pkg.module, format: 'es' }
		]
	}
];
