import { compareSemver, isCreditCardNumber, isEmail, isIPv4, isIPv6, isIsoDateTimeString, isUrl, isUuid } from '@emiliodominguez/js-helpers/validate';

const emails = ['jane.doe+news@example.co.uk', 'user@localhost', 'not an email', 'a@b@c.com', 'very.long.local.part.with.dots@sub.domain.example.org'];
const urls = ['https://example.com/path?q=1#top', 'http://localhost:3000', 'ftp://files.example.com', 'example.com', 'https://sub.example.co.uk/a/b/c'];
const uuids = [
	'f47ac10b-58cc-4372-a567-0e02b2c3d479',
	'F47AC10B-58CC-4372-A567-0E02B2C3D479',
	'00000000-0000-0000-0000-000000000000',
	'f47ac10b58cc4372a5670e02b2c3d479',
	'not-a-uuid'
];
const ipv6 = ['2001:0db8:0000:0000:0000:ff00:0042:8329', '2001:db8::ff00:42:8329', '::1', '::ffff:192.0.2.128', '1::2::3', 'fe80::1%eth0'];
const ipv4 = ['192.168.0.1', '255.255.255.255', '256.0.0.1', '10.0.0.1'];
const versions = ['1.0.0', '1.0.0-beta', '0.9.0', '1.0.0-alpha.10', '1.0.0-alpha.2', '2.1.3+build', '1.10.0', '1.2.3'];
const dateTimes = ['2024-02-29T13:45:00Z', '2024-02-29T13:45:00.123+05:30', '2023-02-29T13:45:00Z', '2024-01-01T12:00:00'];
const cards = ['4111 1111 1111 1111', '4111-1111-1111-1111', '4111111111111112'];

/**
 * Applies a predicate to every input.
 * @param {(value: string) => boolean} predicate - The validator
 * @param {string[]} inputs - The inputs
 * @returns {number} How many inputs passed
 */
function countValid(predicate, inputs) {
	let count = 0;
	for (const input of inputs) if (predicate(input)) count++;
	return count;
}

export default [
	{
		name: 'isEmail (5 inputs)',
		fn: function () {
			return countValid(isEmail, emails);
		}
	},
	{
		name: 'isUrl (5 inputs)',
		fn: function () {
			return countValid(isUrl, urls);
		}
	},
	{
		name: 'isUuid (5 inputs)',
		fn: function () {
			return countValid(isUuid, uuids);
		}
	},
	{
		name: 'isUuid v4 (5 inputs)',
		fn: function () {
			return countValid(function (value) {
				return isUuid(value, 4);
			}, uuids);
		}
	},
	{
		name: 'isIPv6 (6 inputs)',
		fn: function () {
			return countValid(isIPv6, ipv6);
		}
	},
	{
		name: 'isIPv4 (4 inputs)',
		fn: function () {
			return countValid(isIPv4, ipv4);
		}
	},
	{
		name: 'compareSemver sort (8 versions)',
		fn: function () {
			return versions.slice().sort(compareSemver);
		}
	},
	{
		name: 'isIsoDateTimeString (4 inputs)',
		fn: function () {
			return countValid(isIsoDateTimeString, dateTimes);
		}
	},
	{
		name: 'isCreditCardNumber (3 inputs)',
		fn: function () {
			return countValid(isCreditCardNumber, cards);
		}
	}
];
