// Marks each build output folder with its module format so Node resolves `.js` files correctly.
import { writeFileSync } from 'node:fs';

writeFileSync(new URL('../dist/cjs/package.json', import.meta.url), JSON.stringify({ type: 'commonjs' }, null, '\t') + '\n');
writeFileSync(new URL('../dist/esm/package.json', import.meta.url), JSON.stringify({ type: 'module', sideEffects: false }, null, '\t') + '\n');
