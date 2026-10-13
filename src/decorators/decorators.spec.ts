import * as decorators from '.';

class Test {
	@decorators.readonly
	testProp: string = 'test';

	@decorators.readonly
	static staticProp = 'static';

	count: number = 0;

	id: number;

	constructor(id = 1) {
		this.id = id;
	}

	@decorators.log
	testLogMethod(arg: string): string {
		return `test ${arg}`;
	}

	@decorators.log
	async testAsyncLogMethod(fail: boolean): Promise<number> {
		if (fail) throw new Error('async failure');
		return this.id;
	}

	@decorators.log
	testThrowingLogMethod(): never {
		throw new Error('sync failure');
	}

	@decorators.memoize
	testMemoizeMethod(arg: string): string {
		this.count += 1;
		return `test ${arg} ${this.id}`;
	}

	@decorators.memoize
	falsy(value: number): number {
		this.count += 1;
		return value * 0;
	}

	@decorators.bound
	getId(): number {
		return this.id;
	}

	@decorators.debounced(100)
	debouncedMethod(value: number): void {
		calls.push(['debounced', this.id, value]);
	}

	@decorators.throttled(100)
	throttledMethod(value: number): void {
		calls.push(['throttled', this.id, value]);
	}

	@decorators.deprecated()
	oldMethod(): number {
		return this.id;
	}

	@decorators.deprecated('Use something else.')
	otherOldMethod(): string {
		return 'other';
	}

	@decorators.memoize
	static staticSquare(n: number): number {
		staticCalls += 1;
		return n * n;
	}

	@decorators.bound
	static staticName(): string {
		return (this as unknown as { name: string }).name;
	}
}

const calls: Array<[string, number, number]> = [];
let staticCalls = 0;

/**
 * Builds a fake TC39 standard decorator context and collects its initializers.
 */
function fakeContext(kind: string, name: string | symbol, extra: Record<string, unknown> = {}) {
	const initializers: Array<(this: unknown) => void> = [];
	const context = {
		kind,
		name,
		static: false,
		private: false,
		addInitializer: function (initializer: (this: unknown) => void) {
			initializers.push(initializer);
		},
		...extra
	};

	return {
		context: context as any,
		initializers,
		runInitializers: function (instance: unknown) {
			initializers.forEach(function (initializer) {
				initializer.call(instance);
			});
		}
	};
}

describe('Decorators', function () {
	let test: Test;

	beforeEach(function () {
		test = new Test();
		calls.length = 0;
	});

	afterEach(function () {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('readonly', function () {
		it('should throw a TypeError when assigning after construction and keep the value', function () {
			expect(function () {
				test.testProp = 'new value';
			}).toThrow(TypeError);
			expect(test.testProp).toBe('test');
		});

		it('should create an enumerable, non-writable own property', function () {
			expect(Object.getOwnPropertyDescriptor(test, 'testProp')).toEqual({ value: 'test', writable: false, enumerable: true, configurable: false });
			expect(Object.keys(test)).toContain('testProp');
		});

		it('should keep each instance independent', function () {
			class Box {
				@decorators.readonly
				value: number;

				constructor(value: number) {
					this.value = value;
				}
			}

			const a = new Box(1);
			const b = new Box(2);
			expect([a.value, b.value]).toEqual([1, 2]);
			expect(function () {
				a.value = 3;
			}).toThrow(TypeError);
			expect([a.value, b.value]).toEqual([1, 2]);
		});

		it('should read undefined before initialisation', function () {
			expect((Test.prototype as any).testProp).toBeUndefined();
		});

		it('should make an already initialised static field non-writable', function () {
			expect(Test.staticProp).toBe('static');
			expect(function () {
				Test.staticProp = 'changed';
			}).toThrow(TypeError);
			expect(Test.staticProp).toBe('static');
		});

		it('should return a non-writable descriptor for Babel legacy fields', function () {
			function initializer() {
				return 42;
			}

			const descriptor = { configurable: true, enumerable: true, writable: true, initializer };
			const result = decorators.readonly({}, 'field', descriptor);
			expect(result).toEqual({ configurable: true, enumerable: true, writable: false, initializer });
			expect(descriptor.writable).toBe(true);
		});

		it('should make legacy methods non-writable', function () {
			function method() {
				return 1;
			}

			const result = decorators.readonly({}, 'm', { value: method, writable: true, configurable: true, enumerable: false });
			expect(result).toEqual({ value: method, writable: false, configurable: true, enumerable: false });
		});

		it('should reject legacy accessors', function () {
			expect(function () {
				decorators.readonly({}, 'acc', {
					get: function () {
						return 1;
					}
				});
			}).toThrow(TypeError);
		});

		it('should lock the field via an initializer with standard decorators', function () {
			const { context, initializers, runInitializers } = fakeContext('field', 'x');
			expect(decorators.readonly(undefined, context)).toBeUndefined();
			expect(initializers).toHaveLength(1);

			const instance: { x: number } = { x: 1 };
			runInitializers(instance);
			expect(Object.getOwnPropertyDescriptor(instance, 'x')).toEqual({ value: 1, writable: false, enumerable: true, configurable: false });
			expect(function () {
				instance.x = 2;
			}).toThrow(TypeError);

			const withoutField: Record<string, unknown> = {};
			runInitializers(withoutField);
			withoutField.x = 5;
			expect(withoutField.x).toBe(5);
		});

		it.each([
			['method', {}],
			['accessor', {}],
			['field', { private: true }],
			['field', { addInitializer: undefined }]
		])('should reject standard %s contexts %p', function (kind, extra) {
			const { context } = fakeContext(kind, 'x', extra);
			expect(function () {
				decorators.readonly(undefined, context);
			}).toThrow(TypeError);
		});
	});

	describe('log', function () {
		let logSpy: jest.SpyInstance;

		beforeEach(function () {
			logSpy = jest.spyOn(console, 'log').mockImplementation(function () {});
		});

		it("should log a method's call and return value", function () {
			test.testLogMethod('arg');
			expect(logSpy).toHaveBeenCalledWith('testLogMethod method called with arguments:', ['arg']);
			expect(logSpy).toHaveBeenCalledWith('testLogMethod method returned:', 'test arg');
		});

		it('should log resolved promises and return the original promise', async function () {
			const result = test.testAsyncLogMethod(false);
			expect(result).toBeInstanceOf(Promise);
			await expect(result).resolves.toBe(1);
			await Promise.resolve();
			expect(logSpy).toHaveBeenCalledWith('testAsyncLogMethod method called with arguments:', [false]);
			expect(logSpy).toHaveBeenCalledWith('testAsyncLogMethod method resolved:', 1);
			expect(logSpy).not.toHaveBeenCalledWith('testAsyncLogMethod method returned:', expect.anything());
		});

		it('should log rejected promises and still reject', async function () {
			await expect(test.testAsyncLogMethod(true)).rejects.toThrow('async failure');
			await Promise.resolve();
			expect(logSpy).toHaveBeenCalledWith('testAsyncLogMethod method rejected:', new Error('async failure'));
		});

		it('should log and rethrow synchronous errors', function () {
			expect(function () {
				test.testThrowingLogMethod();
			}).toThrow('sync failure');
			expect(logSpy).toHaveBeenCalledWith('testThrowingLogMethod method threw:', new Error('sync failure'));
		});

		it('should work as a standard decorator and preserve this', function () {
			const { context } = fakeContext('method', 'sum');
			const wrapped = decorators.log(function (this: { base: number }, a: number) {
				return this.base + a;
			}, context);
			expect(wrapped.call({ base: 1 }, 2)).toBe(3);
			expect(logSpy).toHaveBeenCalledWith('sum method called with arguments:', [2]);
			expect(logSpy).toHaveBeenCalledWith('sum method returned:', 3);
		});

		it('should reject non-methods', function () {
			expect(function () {
				(decorators.log as any)({}, 'prop', undefined);
			}).toThrow(TypeError);
			expect(function () {
				(decorators.log as any)(undefined, fakeContext('field', 'x').context);
			}).toThrow(TypeError);
		});
	});

	describe('memoize', function () {
		it("should memoize a method's results", function () {
			expect(test.testMemoizeMethod('arg')).toBe('test arg 1');
			expect(test.testMemoizeMethod('arg')).toBe('test arg 1');
			expect(test.count).toBe(1);
		});

		it('should keep a separate cache for every instance (previously shared)', function () {
			const other = new Test(2);
			expect(test.testMemoizeMethod('arg')).toBe('test arg 1');
			expect(other.testMemoizeMethod('arg')).toBe('test arg 2');
			expect([test.count, other.count]).toEqual([1, 1]);
		});

		it('should cache falsy results', function () {
			expect(test.falsy(5)).toBe(0);
			expect(test.falsy(5)).toBe(0);
			expect(test.count).toBe(1);
		});

		it('should work on static methods and with a missing this', function () {
			staticCalls = 0;
			expect(Test.staticSquare(3)).toBe(9);
			expect(Test.staticSquare(3)).toBe(9);
			expect(staticCalls).toBe(1);

			const detached = Test.staticSquare;
			expect(detached.call(undefined, 4)).toBe(16);
			expect(detached.call(undefined, 4)).toBe(16);
			expect(staticCalls).toBe(2);
		});

		it('should work as a standard decorator', function () {
			const { context } = fakeContext('method', 'm');
			const spy = jest.fn(function (x: number) {
				return x + 1;
			});
			const wrapped = decorators.memoize(spy, context);
			const a = {};
			const b = {};
			expect(wrapped.call(a, 1)).toBe(2);
			expect(wrapped.call(a, 1)).toBe(2);
			expect(wrapped.call(b, 1)).toBe(2);
			expect(spy).toHaveBeenCalledTimes(2);
		});
	});

	describe('bound', function () {
		it('should bind the method to its instance', function () {
			const { getId } = new Test(7);
			expect(getId()).toBe(7);
		});

		it('should cache the bound method as a non-enumerable own property', function () {
			const first = test.getId;
			expect(test.getId).toBe(first);
			expect(Object.getOwnPropertyDescriptor(test, 'getId')).toMatchObject({ writable: true, enumerable: false, configurable: true });
			expect(Object.keys(test)).not.toContain('getId');
		});

		it('should return the unbound method through the prototype', function () {
			const fromPrototype = Test.prototype.getId;
			expect(fromPrototype.call(new Test(3))).toBe(3);
			expect(Object.prototype.hasOwnProperty.call(Test.prototype, 'getId')).toBe(true);
			expect(Object.getOwnPropertyDescriptor(Test.prototype, 'getId')?.get).toBeDefined();
		});

		it('should allow reassignment on an instance', function () {
			test.getId = function () {
				return 99;
			};
			expect(test.getId()).toBe(99);
		});

		it('should bind static methods to the class', function () {
			const { staticName } = Test;
			expect(staticName()).toBe('Test');
		});

		it('should not shadow subclass overrides accessed through super', function () {
			class Sub extends Test {
				override getId(): number {
					return super.getId() * 10;
				}
			}

			const sub = new Sub(4);
			expect(sub.getId()).toBe(40);
			expect(sub.getId()).toBe(40);
			expect(Object.prototype.hasOwnProperty.call(sub, 'getId')).toBe(false);
		});

		it('should return the method for primitive receivers', function () {
			const descriptor = Object.getOwnPropertyDescriptor(Test.prototype, 'getId') as PropertyDescriptor;
			expect((descriptor.get as () => unknown).call(undefined)).toBeInstanceOf(Function);
		});

		it('should bind without caching for unrelated receivers', function () {
			const descriptor = Object.getOwnPropertyDescriptor(Test.prototype, 'getId') as PropertyDescriptor;
			const unrelated = { id: 8 };
			const boundMethod = (descriptor.get as () => () => number).call(unrelated);
			expect(boundMethod()).toBe(8);
			expect(Object.prototype.hasOwnProperty.call(unrelated, 'getId')).toBe(false);
		});

		it('should treat objects with a non-function own constructor as instances', function () {
			const descriptor = Object.getOwnPropertyDescriptor(Test.prototype, 'getId') as PropertyDescriptor;
			const fake = Object.create(Test.prototype, { constructor: { value: 'not a function' }, id: { value: 12 } });
			const boundMethod = (descriptor.get as () => () => number).call(fake);
			expect(boundMethod()).toBe(12);
		});

		it('should bind via an initializer with standard decorators', function () {
			const { context, runInitializers } = fakeContext('method', 'getValue');

			function getValue(this: { value: number }) {
				return this.value;
			}

			expect(decorators.bound(getValue, context)).toBeUndefined();

			const instance = Object.create({ getValue }, { value: { value: 5 } });
			runInitializers(instance);
			const { getValue: extracted } = instance;
			expect(extracted()).toBe(5);
			expect(Object.getOwnPropertyDescriptor(instance, 'getValue')).toMatchObject({ enumerable: false, writable: true });

			const overridden = Object.create(
				{
					getValue: function () {
						return 'override';
					}
				},
				{ value: { value: 6 } }
			);
			runInitializers(overridden);
			expect(Object.prototype.hasOwnProperty.call(overridden, 'getValue')).toBe(false);
		});

		it('should reject non-methods and private methods', function () {
			expect(function () {
				(decorators.bound as any)({}, 'x', { get: function () {} });
			}).toThrow(TypeError);
			expect(function () {
				(decorators.bound as any)({}, 'x');
			}).toThrow(TypeError);
			expect(function () {
				decorators.bound(function () {}, fakeContext('method', '#x', { private: true }).context);
			}).toThrow(TypeError);
			expect(function () {
				(decorators.bound as any)(undefined, fakeContext('field', 'x').context);
			}).toThrow(TypeError);
		});
	});

	describe('debounced', function () {
		it('should debounce per instance', function () {
			jest.useFakeTimers();

			const other = new Test(2);
			test.debouncedMethod(1);
			test.debouncedMethod(2);
			other.debouncedMethod(3);
			expect(calls).toEqual([]);

			jest.advanceTimersByTime(100);
			expect(calls).toEqual([
				['debounced', 1, 2],
				['debounced', 2, 3]
			]);
		});

		it('should validate its arguments eagerly', function () {
			expect(function () {
				decorators.debounced(-1);
			}).toThrow(RangeError);
			expect(function () {
				decorators.debounced(10, { leading: false, trailing: false });
			}).toThrow(TypeError);
		});

		it('should work as a standard decorator', function () {
			jest.useFakeTimers();

			const spy = jest.fn();
			const wrapped = decorators.debounced(10)(spy, fakeContext('method', 'm').context);
			wrapped.call(undefined, 1);
			wrapped.call(undefined, 2);
			jest.advanceTimersByTime(10);
			expect(spy.mock.calls).toEqual([[2]]);
		});
	});

	describe('throttled', function () {
		it('should throttle per instance', function () {
			jest.useFakeTimers();

			const other = new Test(2);
			test.throttledMethod(1);
			test.throttledMethod(2);
			other.throttledMethod(3);
			other.throttledMethod(4);
			expect(calls).toEqual([
				['throttled', 1, 1],
				['throttled', 2, 3]
			]);

			jest.advanceTimersByTime(100);
			test.throttledMethod(5);
			expect(calls[calls.length - 1]).toEqual(['throttled', 1, 5]);
		});

		it('should validate its arguments eagerly', function () {
			expect(function () {
				decorators.throttled(NaN);
			}).toThrow(RangeError);
		});

		it('should reject non-methods', function () {
			expect(function () {
				(decorators.throttled(10) as any)({}, 'field', undefined);
			}).toThrow(TypeError);
		});
	});

	describe('deprecated', function () {
		let warnSpy: jest.SpyInstance;

		beforeEach(function () {
			warnSpy = jest.spyOn(console, 'warn').mockImplementation(function () {});
		});

		it('should warn once per method, not per call or instance', function () {
			const other = new Test(2);
			expect(test.oldMethod()).toBe(1);
			expect(test.oldMethod()).toBe(1);
			expect(other.oldMethod()).toBe(2);
			expect(test.otherOldMethod()).toBe('other');
			expect(warnSpy.mock.calls).toEqual([['oldMethod is deprecated.'], ['Use something else.']]);
		});

		it('should work as a standard decorator', function () {
			const wrapped = decorators.deprecated()(function () {
				return 'x';
			}, fakeContext('method', 'legacyApi').context);
			expect(wrapped()).toBe('x');
			expect(wrapped()).toBe('x');
			expect(warnSpy.mock.calls).toEqual([['legacyApi is deprecated.']]);
		});
	});
});
