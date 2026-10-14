// Fails when the published tarball grows past its budget. Run after `yarn build`.
import { execSync } from 'node:child_process';

const BUDGET = { packed: 60 * 1024, unpacked: 260 * 1024 };
const [report] = JSON.parse(execSync('npm pack --dry-run --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const javascript = report.files
	.filter(function (file) {
		return file.path.endsWith('.js');
	})
	.reduce(function (total, file) {
		return total + file.size;
	}, 0);

/**
 * Formats a byte count as kilobytes.
 * @param {number} bytes - The byte count
 * @returns {string} The formatted size
 */
function kb(bytes) {
	return `${(bytes / 1024).toFixed(1)} kB`;
}

console.log(`packed ${kb(report.size)} · unpacked ${kb(report.unpackedSize)} · runtime JS ${kb(javascript)} · ${report.entryCount} files`);

if (report.size > BUDGET.packed || report.unpackedSize > BUDGET.unpacked) {
	console.error(`Size budget exceeded (packed ≤ ${kb(BUDGET.packed)}, unpacked ≤ ${kb(BUDGET.unpacked)}).`);
	process.exit(1);
}
