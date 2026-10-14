// Emits the runtime JavaScript: one minified ES module per source file (no bundling, so tree-shaking and
// deep imports keep working). Type declarations, with full JSDoc, are emitted separately by `tsc`.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const entryPoints = readdirSync('src', { recursive: true })
	.map(function (file) {
		return join('src', String(file));
	})
	.filter(function (file) {
		return file.endsWith('.ts') && !file.endsWith('.spec.ts');
	});

await build({
	entryPoints,
	outdir: 'dist',
	outbase: 'src',
	format: 'esm',
	platform: 'neutral',
	target: 'es2022',
	bundle: false,
	minify: true,
	legalComments: 'none',
	sourcemap: false,
	logLevel: 'warning'
});
