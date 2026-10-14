import { createStore } from '@emiliodominguez/js-helpers/store';

/**
 * Builds a store with `count` selectors (each subscribed once) over a `{ counter, items }` state.
 * @param {number} count - Number of `select()` subscribers
 * @returns {object} The store
 */
function setup(count) {
	const store = createStore({ counter: 0, items: [] });
	let seen = 0;
	for (let i = 0; i < count; i++) {
		const selected = store.select(function (state) {
			return i % 2 === 0 ? state.counter : state.items;
		});
		selected.subscribe(function () {
			seen += 1;
		});
	}
	store.subscribe(function () {
		seen += 1;
	});
	return store;
}

const plain = createStore(0);
plain.subscribe(function () {
	return undefined;
});
const selected = setup(20);

/**
 * Increments the counter.
 * @param {{ counter: number, items: unknown[] }} state - The previous state
 * @returns {{ counter: number, items: unknown[] }} The next state
 */
function increment(state) {
	return { counter: state.counter + 1, items: state.items };
}

export default [
	{
		name: 'setState (1 listener)',
		fn: function () {
			for (let i = 0; i < 100; i++) plain.setState(i % 2);
			return plain.getState();
		}
	},
	{
		name: 'setState (20 select() subscribers)',
		fn: function () {
			for (let i = 0; i < 100; i++) selected.setState(increment);
			return selected.getState();
		}
	},
	{
		name: 'select().getState() (cached)',
		fn: function () {
			const counter = selected.select(function (state) {
				return state.counter;
			});
			let total = 0;
			for (let i = 0; i < 100; i++) total += counter.getState();
			return total;
		}
	}
];
