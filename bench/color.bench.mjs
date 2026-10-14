import { contrastRatio, hslToRgb, lighten, mix, parseColor, parseHex, rgbToHsl, toHex } from '@emiliodominguez/js-helpers/color';

// 1000 deterministic colours in the formats seen in real stylesheets.
const rgbs = Array.from({ length: 1000 }, function (_, index) {
	return { r: (index * 37) % 256, g: (index * 101) % 256, b: (index * 193) % 256 };
});
const hexes = rgbs.map(function ({ r, g, b }) {
	return `#${[r, g, b]
		.map(function (channel) {
			return channel.toString(16).padStart(2, '0');
		})
		.join('')}`;
});
const shortHexes = hexes.map(function (hex) {
	return `#${hex[1]}${hex[3]}${hex[5]}`;
});
const functions = rgbs.map(function ({ r, g, b }, index) {
	return index % 2 === 0 ? `rgba(${r}, ${g}, ${b}, 0.5)` : `hsl(${index % 360}deg ${index % 101}% ${(index * 7) % 101}%)`;
});
const hsls = rgbs.map(function (_, index) {
	return { h: (index * 13) % 360, s: index % 101, l: (index * 7) % 101 };
});

export default [
	{
		name: 'parseHex (1000 × #rrggbb)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < hexes.length; i++) total += parseHex(hexes[i]).r;
			return total;
		}
	},
	{
		name: 'parseColor (1000 × #rgb)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < shortHexes.length; i++) total += parseColor(shortHexes[i]).g;
			return total;
		}
	},
	{
		name: 'parseColor (1000 × rgba()/hsl())',
		fn: function () {
			let total = 0;
			for (let i = 0; i < functions.length; i++) total += parseColor(functions[i]).b;
			return total;
		}
	},
	{
		name: 'toHex (1000 objects)',
		fn: function () {
			let length = 0;
			for (let i = 0; i < rgbs.length; i++) length += toHex(rgbs[i]).length;
			return length;
		}
	},
	{
		name: 'contrastRatio (1000 hex pairs)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < hexes.length; i++) total += contrastRatio(hexes[i], '#ffffff');
			return total;
		}
	},
	{
		name: 'rgbToHsl + hslToRgb (1000)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < rgbs.length; i++) total += rgbToHsl(rgbs[i]).h + hslToRgb(hsls[i]).r;
			return total;
		}
	},
	{
		name: 'mix (1000 hex pairs)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < hexes.length; i++) total += mix(hexes[i], '#000000', 0.3).r;
			return total;
		}
	},
	{
		name: 'lighten (1000 hexes)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < hexes.length; i++) total += lighten(hexes[i], 10).r;
			return total;
		}
	}
];
