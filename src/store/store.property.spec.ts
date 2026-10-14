import fc from 'fast-check';
import { createStore } from '.';

type Op = { kind: 'set'; value: number } | { kind: 'add'; value: number } | { kind: 'reset' };

const opArb: fc.Arbitrary<Op> = fc.oneof(
	fc.record({ kind: fc.constant('set' as const), value: fc.integer({ min: -20, max: 20 }) }),
	fc.record({ kind: fc.constant('add' as const), value: fc.integer({ min: -3, max: 3 }) }),
	fc.record({ kind: fc.constant('reset' as const) })
);

const equalsArb = fc.constantFrom<{ name: string; fn: (a: number, b: number) => boolean }>(
	{ name: 'Object.is', fn: Object.is },
	{
		name: 'same mod 4',
		fn: function (a, b) {
			return ((a % 4) + 4) % 4 === ((b % 4) + 4) % 4;
		}
	}
);

const selectorArb = fc.constantFrom<(n: number) => unknown>(
	function (n) {
		return n % 3;
	},
	function (n) {
		return Math.sign(n);
	},
	function (n) {
		return n > 5;
	},
	function (n) {
		return n;
	}
);

/**
 * Applies `op` to `state` the way the store is expected to compute the candidate next state.
 */
function next(state: number, op: Op, initial: number): number {
	if (op.kind === 'set') return op.value;
	if (op.kind === 'add') return state + op.value;
	return initial;
}

/**
 * Runs `op` against the store.
 */
function apply(store: ReturnType<typeof createStore<number>>, op: Op): void {
	if (op.kind === 'set') store.setState(op.value);
	else if (op.kind === 'add')
		store.setState(function (n) {
			return n + op.value;
		});
	else store.reset();
}

describe('createStore (properties)', function () {
	it('getState equals the reference fold and listeners fire once per non-equal transition', function () {
		fc.assert(
			fc.property(fc.integer({ min: -20, max: 20 }), equalsArb, fc.array(opArb, { maxLength: 50 }), function (initial, equals, ops) {
				const store = createStore(initial, { equals: equals.fn });
				let calls = 0;
				let expectedCalls = 0;
				let expected = initial;

				store.subscribe(function () {
					calls++;
				});

				for (const op of ops) {
					const candidate = next(expected, op, initial);
					if (!equals.fn(expected, candidate)) {
						expected = candidate;
						expectedCalls++;
					}
					apply(store, op);
					expect(store.getState()).toBe(expected);
				}

				expect(calls).toBe(expectedCalls);
			})
		);
	});

	it('select notifies exactly when the projection changes and always reflects the source', function () {
		fc.assert(
			fc.property(fc.integer({ min: -20, max: 20 }), selectorArb, fc.array(opArb, { maxLength: 50 }), function (initial, selector, ops) {
				const store = createStore(initial);
				const derived = store.select(selector);
				let calls = 0;
				let expectedCalls = 0;
				let projection = selector(initial);

				derived.subscribe(function () {
					calls++;
				});

				for (const op of ops) {
					apply(store, op);
					const current = selector(store.getState());
					if (!Object.is(current, projection)) {
						projection = current;
						expectedCalls++;
					}
					expect(derived.getState()).toBe(current);
				}

				expect(calls).toBe(expectedCalls);
			})
		);
	});

	it('never loses notifications under re-entrant setState: every listener last observes the final state', function () {
		fc.assert(
			fc.property(
				fc.array(fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }), { minLength: 1, maxLength: 5 }),
				fc.array(fc.integer({ min: -20, max: 20 }), { maxLength: 20 }),
				function (clamps, values) {
					const store = createStore(0);
					const lastSeen: Array<number | undefined> = clamps.map(function () {
						return undefined;
					});
					const bounds = clamps.filter(function (c): c is number {
						return c !== undefined;
					});
					const limit = bounds.length > 0 ? Math.min(...bounds) : Infinity;

					clamps.forEach(function (clamp, index) {
						store.subscribe(function () {
							lastSeen[index] = store.getState();
							// Re-entrant listeners clamp the state from above.
							if (clamp !== undefined && store.getState() > clamp) store.setState(clamp);
						});
					});

					let changed = false;

					for (const value of values) {
						const before = store.getState();
						store.setState(value);
						changed ||= value !== before;
						expect(store.getState()).toBe(Math.min(value, limit));
						// Once anything was notified, every listener has observed the latest state.
						expect(lastSeen).toEqual(
							lastSeen.map(function () {
								return changed ? store.getState() : undefined;
							})
						);
					}
				}
			)
		);
	});
});
