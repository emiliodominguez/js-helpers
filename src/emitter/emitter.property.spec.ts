import fc from 'fast-check';
import { createEmitter } from '.';

type Name = 'a' | 'b' | 'c';
type Target = Name | '*';

interface Events {
	a: number;
	b: number;
	c: number;
}

type Op =
	| { kind: 'on'; event: Target; handler: number; once: boolean }
	| { kind: 'off'; event: Target; handler: number }
	| { kind: 'unsubscribe'; index: number }
	| { kind: 'emit'; event: Name; payload: number }
	| { kind: 'clear'; event: Target | undefined };

const nameArb = fc.constantFrom<Name>('a', 'b', 'c');
const targetArb = fc.constantFrom<Target>('a', 'b', 'c', '*');
const handlerArb = fc.integer({ min: 0, max: 3 });

const opArb: fc.Arbitrary<Op> = fc.oneof(
	{ arbitrary: fc.record({ kind: fc.constant('on' as const), event: targetArb, handler: handlerArb, once: fc.boolean() }), weight: 4 },
	{ arbitrary: fc.record({ kind: fc.constant('off' as const), event: targetArb, handler: handlerArb }), weight: 1 },
	{ arbitrary: fc.record({ kind: fc.constant('unsubscribe' as const), index: fc.nat() }), weight: 1 },
	{ arbitrary: fc.record({ kind: fc.constant('emit' as const), event: nameArb, payload: fc.integer() }), weight: 4 },
	{ arbitrary: fc.record({ kind: fc.constant('clear' as const), event: fc.option(targetArb, { nil: undefined }) }), weight: 1 }
);

interface ModelRegistration {
	id: number;
	handler: number;
	once: boolean;
}

describe('createEmitter (properties)', function () {
	it('calls handlers exactly like a reference model for random on/once/off/unsubscribe/emit/clear sequences', function () {
		fc.assert(
			fc.property(fc.array(opArb, { maxLength: 60 }), function (ops) {
				const emitter = createEmitter<Events>();
				const log: unknown[][] = [];
				const handlers = [0, 1, 2, 3].map(function (index) {
					return function (...args: unknown[]) {
						log.push([index, ...args]);
					};
				});
				const subscriptions: Array<{ id: number; unsubscribe: () => void }> = [];

				const model = new Map<Target, ModelRegistration[]>();
				const expected: unknown[][] = [];
				let nextId = 0;

				function modelRemove(target: Target, predicate: (r: ModelRegistration) => boolean) {
					model.set(
						target,
						(model.get(target) ?? []).filter(function (r) {
							return !predicate(r);
						})
					);
				}

				for (const op of ops) {
					switch (op.kind) {
						case 'on': {
							const id = nextId++;
							const handler = handlers[op.handler] as any;
							const unsubscribe = op.once ? emitter.once(op.event as any, handler) : emitter.on(op.event as any, handler);
							subscriptions.push({ id, unsubscribe });
							model.set(op.event, [...(model.get(op.event) ?? []), { id, handler: op.handler, once: op.once }]);
							break;
						}
						case 'off': {
							const removed = emitter.off(op.event as any, handlers[op.handler] as any);
							const before = (model.get(op.event) ?? []).length;
							modelRemove(op.event, function (r) {
								return r.handler === op.handler;
							});
							expect(removed).toBe((model.get(op.event) ?? []).length !== before);
							break;
						}
						case 'unsubscribe': {
							if (subscriptions.length === 0) break;
							const subscription = subscriptions[op.index % subscriptions.length];
							subscription.unsubscribe();
							for (const target of ['a', 'b', 'c', '*'] as const) {
								modelRemove(target, function (r) {
									return r.id === subscription.id;
								});
							}
							break;
						}
						case 'emit': {
							emitter.emit(op.event, op.payload);
							for (const r of model.get(op.event) ?? []) expected.push([r.handler, op.payload]);
							for (const r of model.get('*') ?? []) expected.push([r.handler, op.event, op.payload]);
							modelRemove(op.event, function (r) {
								return r.once;
							});
							modelRemove('*', function (r) {
								return r.once;
							});
							break;
						}
						case 'clear': {
							emitter.clear(op.event);
							if (op.event === undefined) model.clear();
							else model.delete(op.event);
							break;
						}
					}

					let total = 0;
					for (const target of ['a', 'b', 'c', '*'] as const) {
						const count = (model.get(target) ?? []).length;
						total += count;
						expect(emitter.listenerCount(target)).toBe(count);
					}
					expect(emitter.listenerCount()).toBe(total);
				}

				expect(log).toEqual(expected);
			})
		);
	});

	it('calls every handler once per emit and rethrows the errors in call order', function () {
		fc.assert(
			fc.property(fc.array(fc.boolean(), { maxLength: 10 }), fc.array(fc.boolean(), { maxLength: 5 }), function (specific, wildcard) {
				const emitter = createEmitter<Events>();
				const calls: number[] = [];
				const errors: Error[] = [];

				[...specific, ...wildcard].forEach(function (throws, index) {
					const error = new Error(String(index));
					if (throws) errors.push(error);
					emitter.on((index < specific.length ? 'a' : '*') as 'a', function () {
						calls.push(index);
						if (throws) throw error;
					});
				});

				let caught: unknown = null;
				try {
					emitter.emit('a', 1);
				} catch (error) {
					caught = error;
				}

				expect(calls).toEqual(
					[...specific, ...wildcard].map(function (_, index) {
						return index;
					})
				);
				if (errors.length === 0) expect(caught).toBeNull();
				else if (errors.length === 1) expect(caught).toBe(errors[0]);
				else expect((caught as AggregateError).errors).toEqual(errors);
			})
		);
	});

	it('waitFor resolves with the first payload accepted by the filter and always removes its listener', async function () {
		await fc.assert(
			fc.asyncProperty(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 20 }), fc.integer({ min: -50, max: 50 }), async function (payloads, threshold) {
				const emitter = createEmitter<Events>();
				let settled: { value: number } | undefined;
				const promise = emitter.waitFor('a', {
					filter: function (n) {
						return n > threshold;
					}
				});
				void promise.then(function (value) {
					settled = { value };
				});

				for (const payload of payloads) emitter.emit('a', payload);
				await Promise.resolve();
				await Promise.resolve();

				const match = payloads.find(function (n) {
					return n > threshold;
				});

				if (match === undefined) {
					expect(settled).toBeUndefined();
					expect(emitter.listenerCount('a')).toBe(1);
				} else {
					expect(settled).toEqual({ value: match });
					expect(emitter.listenerCount('a')).toBe(0);
				}
			})
		);
	});
});
