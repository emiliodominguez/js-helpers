// Type-checks test-d/consumer.ts against the built declarations (run after `yarn build`) and fails when the
// declarations stop compiling for a plain ES2022 consumer or when type-checking them gets expensive.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const INSTANTIATION_BUDGET = 60_000;
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
let output;

try {
	output = execFileSync(process.execPath, [tsc, '-p', 'test-d', '--extendedDiagnostics'], { encoding: 'utf8' });
} catch (error) {
	console.error(error.stdout || error.message);
	console.error('The published declarations do not type-check for a plain ES2022 consumer.');
	process.exit(1);
}

const instantiations = Number(/Instantiations:\s+(\d+)/.exec(output)?.[1]);
const checkTime = /Check time:\s+([\d.]+s)/.exec(output)?.[1];
console.log(`declarations OK · ${instantiations} type instantiations · check time ${checkTime}`);

if (!(instantiations <= INSTANTIATION_BUDGET)) {
	console.error(`Type instantiations exceed the budget of ${INSTANTIATION_BUDGET}: a public type got more expensive to check.`);
	process.exit(1);
}
