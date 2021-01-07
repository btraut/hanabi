const colors = require('tailwindcss/colors');

module.exports = {
	purge: [],
	darkMode: false,
	theme: {
		textShadow: {
			default: '4px 5px 0 black',
		},
		extend: {
			fontFamily: {
				sans: [
					'-apple-system',
					'BlinkMacSystemFont',
					'Segoe UI',
					'Roboto',
					'Helvetica',
					'Arial',
					'sans-serif',
					'Apple Color Emoji',
					'Segoe UI Emoji',
					'Segoe UI Symbol',
				],
			},
			colors: {
				transparent: 'transparent',
				current: 'currentColor',
				black: colors.black,
				white: colors.white,
				gray: colors.trueGray,
				indigo: colors.indigo,
				red: colors.rose,
				yellow: colors.amber,
			},
			borderWidth: {
				6: '6px',
			},
			gridTemplateColumns: {
				form: 'auto 1fr',
			},
			width: {
				tiles: '500px',
			},
			height: {
				tiles: '300px',
			},
		},
	},
	variants: {
		textShadow: ['responsive'],
		scale: ['active', 'hover', 'group-hover'],
	},
	plugins: [require('tailwindcss-typography')()],
};
