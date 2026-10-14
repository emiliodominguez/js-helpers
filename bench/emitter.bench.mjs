import { createEmitter } from '@emiliodominguez/js-helpers/emitter';

/**
 * Builds an emitter with `count` listeners on `tick` that sum the payloads they receive.
 * @param {number} count - Number of listeners
 * @param {boolean} wildcard - Whether to add a wildcard listener too
 * @returns {{ emitter: object, totals: number[] }} The emitter and the shared accumulator
 */
function setup(count, wildcard) {
	const emitter = createEmitter();
	const totals = [0];
	for (let i = 0; i < count; i++) {
		emitter.on('tick', function (n) {
			totals[0] += n;
		});
	}
	if (wildcard) {
		emitter.on('*', function (_event, n) {
			totals[0] -= n;
		});
	}
	return { emitter, totals };
}

const one = setup(1, false);
const many = setup(50, false);
const withWildcard = setup(10, true);
const empty = setup(0, false);
const churn = createEmitter();

export default [
	{
		name: 'emit (1 listener)',
		fn: function () {
			for (let i = 0; i < 100; i++) one.emitter.emit('tick', i);
			return one.totals[0];
		}
	},
	{
		name: 'emit (50 listeners)',
		fn: function () {
			for (let i = 0; i < 100; i++) many.emitter.emit('tick', i);
			return many.totals[0];
		}
	},
	{
		name: 'emit (10 listeners + wildcard)',
		fn: function () {
			for (let i = 0; i < 100; i++) withWildcard.emitter.emit('tick', i);
			return withWildcard.totals[0];
		}
	},
	{
		name: 'emit (no listener)',
		fn: function () {
			for (let i = 0; i < 100; i++) empty.emitter.emit('tick', i);
			return empty.totals[0];
		}
	},
	{
		name: 'on + unsubscribe (20 listeners)',
		fn: function () {
			const stops = [];
			for (let i = 0; i < 20; i++) {
				stops.push(
					churn.on('tick', function () {
						return i;
					})
				);
			}
			for (const stop of stops) stop();
			return churn.listenerCount();
		}
	}
];
