// Generates docs/API.md: one table per module listing every exported function/class with its JSDoc summary.
// Usage: yarn docs:api
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import ts from 'typescript';

const MODULES = [
	['arrays', 'Collection helpers: set algebra, grouping, chunking, sorting, sampling.'],
	['objects', 'Shallow/deep cloning, merging, equality, path access and object reshaping.'],
	['guards', 'Runtime type predicates that narrow `unknown` values.'],
	['strings', 'Unicode-aware transformations, case conversion, escaping and templating.'],
	['math', 'Precise arithmetic, statistics, number theory and random numbers.'],
	['functions', 'Function composition, currying, memoization and rate limiting.'],
	['async', 'Promise utilities: sleeping, timeouts, retries and bounded concurrency.'],
	['date', 'DST-safe, non-mutating local-time date arithmetic, formatting and parsing.'],
	['decorators', 'Class decorators for TypeScript (legacy and TC39 standard) and Babel.']
];

/**
 * Extracts the first sentence of a JSDoc comment, rendering `{@link X}` as inline code.
 * @param {ts.JSDoc | undefined} doc - The JSDoc node
 * @returns {string} The summary sentence
 */
function summarize(doc) {
	if (!doc || !doc.comment) return '';
	const text = typeof doc.comment === 'string'
		? doc.comment
		: doc.comment
				.map(function (part) {
					return part.kind === ts.SyntaxKind.JSDocText ? part.text : '`' + (part.name ? part.name.getText() : part.text) + '`';
				})
				.join('');
	const flat = text
		.replace(/\s*\n\s*/g, ' ')
		.trim()
		.replace(/:\s+-\s.*$/, '.');
	const codeSpans = [];
	const masked = flat.replace(/`[^`]*`/g, function (code) {
		codeSpans.push(code);
		return `\u0000${codeSpans.length - 1}\u0000`;
	});
	const match = /^(.+?(?<!\b(?:i\.e|e\.g|etc))\.)(\s|$)/.exec(masked);
	const sentence = (match ? match[1] : masked).replace(/\u0000(\d+)\u0000/g, function (_placeholder, index) {
		return codeSpans[Number(index)];
	});
	return sentence.replace(/\|/g, '\\|');
}

/**
 * Lists the exported functions and classes of a module, in source order, ignoring overload duplicates.
 * @param {string} name - Module folder name
 * @returns {Array<{ name: string; kind: string; summary: string }>} The exports
 */
function listExports(name) {
	const file = `src/${name}/index.ts`;
	const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
	const seen = new Set();
	const rows = [];

	for (const statement of source.statements) {
		const isExported = (ts.getModifiers(statement) || []).some(function (modifier) {
			return modifier.kind === ts.SyntaxKind.ExportKeyword;
		});
		if (!isExported || !statement.name || seen.has(statement.name.text)) continue;
		if (!ts.isFunctionDeclaration(statement) && !ts.isClassDeclaration(statement)) continue;
		seen.add(statement.name.text);
		rows.push({ name: statement.name.text, kind: ts.isClassDeclaration(statement) ? 'class' : 'function', summary: summarize(statement.jsDoc && statement.jsDoc[0]) });
	}

	return rows;
}

const sections = MODULES.map(function ([name, description]) {
	const rows = listExports(name)
		.map(function (row) {
			return `| \`${row.name}\`${row.kind === 'class' ? ' _(class)_' : ''} | ${row.summary} |`;
		})
		.join('\n');
	return `## ${name}\n\n${description}\n\n\`\`\`ts\nimport { … } from '@emiliodominguez/js-helpers/${name}';\n\`\`\`\n\n| Export | Description |\n| --- | --- |\n${rows}\n`;
});

const toc = MODULES.map(function ([name]) {
	return `[\`${name}\`](#${name})`;
}).join(' · ');

const output = `# API reference\n\n> Generated from the JSDoc in \`src/*/index.ts\` by \`yarn docs:api\` — do not edit by hand.\n> Every function documents its parameters, return value, thrown errors and examples in its JSDoc, so your editor shows the full details on hover.\n> For a browsable HTML version run \`yarn docs\` (TypeDoc, output in \`docs/reference\`).\n\n${toc}\n\n${sections.join('\n')}`;

mkdirSync('docs', { recursive: true });
writeFileSync('docs/API.md', output);
