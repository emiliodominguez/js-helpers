import type { NestedKeyOf, PathValue } from './index.js';

interface Sample {
	a: { b: { c: string } };
	list: { id: number }[];
	opt?: { deep: boolean };
	when: Date;
}

/**
 * Compile-time equality assertion.
 */
type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

describe('utility types', function () {
	it('should compute nested keys and path values at compile time', function () {
		const keys: Array<NestedKeyOf<Sample>> = ['a', 'a.b', 'a.b.c', 'list', 'list.0', 'list.1.id', 'opt', 'opt.deep', 'when'];
		const checks: [
			Equals<PathValue<Sample, 'a.b.c'>, string>,
			Equals<PathValue<Sample, 'list.0.id'>, number | undefined>,
			Equals<PathValue<Sample, 'opt.deep'>, boolean | undefined>
		] = [true, true, true];

		expect(keys).toHaveLength(9);
		expect(checks).toEqual([true, true, true]);
	});
});
