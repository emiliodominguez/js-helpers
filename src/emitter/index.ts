import { AbortError, TimeoutError } from '../async/index.js';
import type { AbortSignalLike, AnyFunction } from '../utils/index.js';

/**
 * Largest delay accepted by `setTimeout` (2^31 - 1 ms).
 */
const MAX_TIMEOUT = 2 ** 31 - 1;

/**
 * The reserved event name used to listen to every event.
 */
const WILDCARD = '*';

/**
 * Removes the subscription it was returned for. Calling it more than once is a no-op.
 */
export type Unsubscribe = () => void;

/**
 * A map from event name (string, number or symbol key) to payload type; any object type works, interfaces included.
 * Use `void` (or `undefined`) as payload type for events emitted without an argument.
 */
export type EventMap = object;

/**
 * A listener for an event whose payload has type `P`.
 * @template P - The payload type
 */
export type EventHandler<P> = (payload: P) => void;

/**
 * A listener registered with `on('*', ...)`: receives the event name and its payload. The `(event, payload)` pairs form a
 * discriminated union, so checking `event` narrows `payload`.
 * @template Events - The event map
 */
export type WildcardHandler<Events extends EventMap> = (...args: { [K in keyof Events]-?: [event: K, payload: Events[K]] }[keyof Events]) => void;

/**
 * The argument list accepted by `emit` after the event name: the payload is optional when `P` is `void`, `undefined` or includes `undefined`.
 * @template P - The payload type
 */
export type EmitArgs<P> = [P] extends [void] ? [payload?: P] : undefined extends P ? [payload?: P] : [payload: P];

/**
 * Options accepted by {@link Emitter.waitFor}.
 * @template P - The payload type
 */
export interface WaitForOptions<P> {
	/** Stops waiting, rejecting with the signal's `reason` (or an `AbortError`). */
	signal?: AbortSignalLike;
	/** Time limit in ms (`0` to `2^31 - 1`, or `Infinity`), after which the promise rejects with a `TimeoutError`. Defaults to `Infinity`. */
	timeout?: number;
	/** Only payloads for which this returns `true` settle the promise. If it throws, the promise rejects with that error. */
	filter?(payload: P): boolean;
}

/**
 * A strictly typed, synchronous event emitter. See {@link createEmitter} for the exact semantics.
 * @template Events - Maps each event name to its payload type
 */
export interface Emitter<Events extends EventMap> {
	/** Listens to every event (`'*'`). Returns a function removing exactly this registration. */
	on(event: '*', handler: WildcardHandler<Events>): Unsubscribe;
	/** Listens to `event`. Returns a function removing exactly this registration. */
	on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): Unsubscribe;
	/** Like `on('*', handler)`, but the registration is removed before its first call. */
	once(event: '*', handler: WildcardHandler<Events>): Unsubscribe;
	/** Like `on`, but the registration is removed before its first call. */
	once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): Unsubscribe;
	/** Removes every registration of `handler` for wildcard listeners; returns whether anything was removed. */
	off(event: '*', handler: WildcardHandler<Events>): boolean;
	/** Removes every registration of `handler` for `event`; returns whether anything was removed. */
	off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): boolean;
	/** Synchronously calls the listeners of `event`, then the wildcard listeners. */
	emit<K extends keyof Events>(event: K, ...args: EmitArgs<Events[K]>): void;
	/** Removes the listeners of `event` (`'*'` for wildcard listeners), or every listener when called without argument. */
	clear(event?: keyof Events | '*'): void;
	/** Number of registrations for `event` (`'*'` for wildcard listeners), or the total when called without argument. */
	listenerCount(event?: keyof Events | '*'): number;
	/**
	 * Resolves with the payload of the next `event` accepted by `filter`. Its internal listener, timer and abort listener are always removed
	 * on settle. The internal listener counts as a registration, so `clear()` removes it too: the promise then only settles through
	 * `timeout` or `signal`.
	 */
	waitFor<K extends keyof Events>(event: K, options?: WaitForOptions<Events[K]>): Promise<Events[K]>;
}

/**
 * One registration of a listener.
 */
interface Registration {
	readonly handler: (...args: unknown[]) => unknown;
	readonly once: boolean;
	active: boolean;
}

/**
 * Throws a `TypeError` unless `value` is callable.
 * @param {string} caller - Name of the public method, used in the error message
 * @param {unknown} value - The value to validate
 * @returns {void}
 * @throws {TypeError} when `value` is not a function
 */
function assertHandler(caller: string, value: unknown): asserts value is AnyFunction {
	if (typeof value !== 'function') throw new TypeError(`${caller}: expected the handler to be a function, got ${typeof value}`);
}

/**
 * Creates a strictly typed, synchronous event emitter.
 *
 * Semantics:
 * - `emit` calls the listeners of the event in registration order, then the wildcard (`'*'`) listeners, synchronously. Listeners receive
 *   exactly the payload argument given to `emit` (no argument when it was omitted); wildcard listeners always receive `(event, payload)`.
 * - Listeners are taken from a snapshot at the start of `emit`: listeners added during an emit do not run for that emit; listeners removed
 *   (through `off`, an unsubscribe function or `clear`) during an emit and not yet called are skipped.
 * - Registering the same handler twice registers it twice: it is called twice per emit. The function returned by `on`/`once` removes
 *   exactly its own registration, while `off(event, handler)` removes every registration of `handler` for `event`.
 * - `once` registrations are removed before their handler runs, so a nested emit of the same event does not call them again.
 * - Nested `emit` calls from inside a listener run immediately (depth first).
 * - A throwing listener does not stop the others: every listener is called, then the error is rethrown (or an `AggregateError` holding
 *   every error, in call order, when several listeners threw).
 * - `'*'` is reserved for wildcard listeners and cannot be emitted.
 * @template Events - Maps each event name to its payload type (`void` payloads can be emitted without argument)
 * @returns {Emitter<Events>} A new emitter
 * @throws {TypeError} from `on`/`once`/`off` when the handler is not a function, from `emit` when the event is `'*'`, and (as a rejection)
 *   from `waitFor` when the event is `'*'` or `filter` is not a function
 * @throws {RangeError} (as a rejection) from `waitFor` when `timeout` is neither a number between `0` and `2^31 - 1` nor `Infinity`
 * @example
 * const events = createEmitter<{ ready: void; message: { text: string } }>();
 * const received: string[] = [];
 * const stop = events.on('message', function (msg) { received.push(msg.text); });
 * events.emit('ready');
 * events.emit('message', { text: 'hi' });
 * stop();
 * events.emit('message', { text: 'unheard' });
 * received; // => ['hi']
 * setTimeout(function () { events.emit('message', { text: 'later' }); }, 10);
 * await events.waitFor('message', { timeout: 1000 }); // => { text: 'later' }
 */
export function createEmitter<Events extends EventMap>(): Emitter<Events> {
	const registry = new Map<PropertyKey, Registration[]>();

	/**
	 * Adds a registration (copy-on-write, so in-progress emits keep iterating their snapshot).
	 * @param {string} caller - Name of the public method, used in error messages
	 * @param {PropertyKey} event - The event name (`'*'` for wildcard listeners)
	 * @param {unknown} handler - The listener
	 * @param {boolean} once - Whether to remove the registration before its first call
	 * @returns {Unsubscribe} Removes this registration
	 * @throws {TypeError} when `handler` is not a function
	 */
	function add(caller: string, event: PropertyKey, handler: unknown, once: boolean): Unsubscribe {
		assertHandler(caller, handler);

		const registration: Registration = { handler: handler as (...args: unknown[]) => unknown, once, active: true };

		registry.set(event, [...(registry.get(event) ?? []), registration]);

		return function (): void {
			remove(event, function (candidate) {
				return candidate === registration;
			});
		};
	}

	/**
	 * Deactivates and removes the registrations of `event` matching `predicate`.
	 * @param {PropertyKey} event - The event name
	 * @param {(registration: Registration) => boolean} predicate - Selects the registrations to remove
	 * @returns {boolean} Whether anything was removed
	 */
	function remove(event: PropertyKey, predicate: (registration: Registration) => boolean): boolean {
		const list = registry.get(event);

		if (!list) return false;

		const kept = list.filter(function (registration) {
			if (!predicate(registration)) return true;

			registration.active = false;
			return false;
		});

		if (kept.length === 0) registry.delete(event);
		else registry.set(event, kept);

		return kept.length !== list.length;
	}

	/**
	 * Calls the active registrations of a snapshot, collecting thrown errors.
	 * @param {PropertyKey} event - The event the registrations belong to (`'*'` for wildcard listeners)
	 * @param {ReadonlyArray<Registration>} snapshot - The registrations at the start of the emit
	 * @param {unknown[]} args - The arguments to pass
	 * @param {unknown[]} errors - Collects the thrown errors
	 * @returns {void}
	 */
	function run(event: PropertyKey, snapshot: ReadonlyArray<Registration>, args: unknown[], errors: unknown[]): void {
		for (const registration of snapshot) {
			if (!registration.active) continue;
			if (registration.once) {
				remove(event, function (candidate) {
					return candidate === registration;
				});
			}

			try {
				registration.handler(...args);
			} catch (error) {
				errors.push(error);
			}
		}
	}

	/**
	 * Throws a `TypeError` when `event` is the reserved wildcard name.
	 * @param {string} caller - Name of the public method, used in the error message
	 * @param {PropertyKey} event - The event name
	 * @returns {void}
	 * @throws {TypeError} when `event` is `'*'`
	 */
	function assertNotWildcard(caller: string, event: PropertyKey): void {
		if (event === WILDCARD) throw new TypeError(`${caller}: '*' is reserved for wildcard listeners and cannot be used as an event name here`);
	}

	const emitter: Emitter<Events> = {
		on(event: PropertyKey, handler: AnyFunction): Unsubscribe {
			return add('on', event, handler, false);
		},

		once(event: PropertyKey, handler: AnyFunction): Unsubscribe {
			return add('once', event, handler, true);
		},

		off(event: PropertyKey, handler: AnyFunction): boolean {
			assertHandler('off', handler);

			return remove(event, function (registration) {
				return registration.handler === handler;
			});
		},

		emit(event: PropertyKey, ...args: unknown[]): void {
			assertNotWildcard('emit', event);

			const listeners = registry.get(event) ?? [];
			const wildcards = registry.get(WILDCARD) ?? [];
			const errors: unknown[] = [];

			run(event, listeners, args.slice(0, 1), errors);
			run(WILDCARD, wildcards, [event, args[0]], errors);

			if (errors.length === 1) throw errors[0];
			if (errors.length > 1) throw new AggregateError(errors, `emit: ${errors.length} listeners of ${String(event)} threw`);
		},

		clear(event?: PropertyKey): void {
			const events = event === undefined ? [...registry.keys()] : [event];

			for (const name of events) {
				remove(name, function () {
					return true;
				});
			}
		},

		listenerCount(event?: PropertyKey): number {
			if (event !== undefined) return registry.get(event)?.length ?? 0;

			let total = 0;

			for (const list of registry.values()) total += list.length;

			return total;
		},

		waitFor(event: PropertyKey, options: WaitForOptions<unknown> = {}): Promise<never> {
			return new Promise<never>(function (resolve, reject) {
				const { signal, timeout = Infinity, filter } = options;

				assertNotWildcard('waitFor', event);
				if (timeout !== Infinity && (typeof timeout !== 'number' || !(timeout >= 0 && timeout <= MAX_TIMEOUT))) {
					throw new RangeError(`waitFor: \`timeout\` must be Infinity or a number between 0 and ${MAX_TIMEOUT}, got ${String(timeout)}`);
				}
				if (filter !== undefined) assertHandler('waitFor', filter);

				if (signal?.aborted) {
					reject(signal.reason ?? new AbortError());
					return;
				}

				const timer =
					timeout === Infinity
						? undefined
						: setTimeout(function () {
								finish(reject, new TimeoutError(`waitFor: ${String(event)} was not emitted within ${timeout} ms`));
							}, timeout);
				const unsubscribe = add('waitFor', event, onEvent, false);

				/**
				 * Settles the promise and releases the listener, the timer and the abort listener.
				 * @param {(value: never) => void} settle - `resolve` or `reject`
				 * @param {unknown} value - The value or reason
				 * @returns {void}
				 */
				function finish(settle: (value: never) => void, value: unknown): void {
					unsubscribe();
					clearTimeout(timer);
					signal?.removeEventListener('abort', onAbort);
					settle(value as never);
				}

				/**
				 * Abort listener.
				 * @returns {void}
				 */
				function onAbort(): void {
					finish(reject, (signal as AbortSignalLike).reason ?? new AbortError());
				}

				/**
				 * Event listener: settles with the first accepted payload.
				 * @param {unknown} payload - The emitted payload
				 * @returns {void}
				 */
				function onEvent(payload: unknown): void {
					let accepted: boolean;

					try {
						accepted = filter === undefined || filter(payload);
					} catch (error) {
						finish(reject, error);
						return;
					}

					if (accepted) finish(resolve, payload);
				}

				signal?.addEventListener('abort', onAbort, { once: true });
			});
		}
	};

	return emitter;
}
