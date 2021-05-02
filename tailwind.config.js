const colors = require('tailwindcss/colors');

module.exports = {
	purge: ['./app/**/*.html', './app/**/*.js'],
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
			boxShadow: {
				dark: '0 0 50px -20px black',
				light: '0 0 0 1px white',
			},
			cursor: {
				'zoom-in': 'zoom-in',
				'zoom-out': 'zoom-out',
			},
			outline: {
				none: ['none', '0'],
			},
		},
	},
	variants: {
		extend: {
			textShadow: ['responsive'],
			scale: ['active', 'hover', 'group-hover'],
			borderColor: ['group-focus', 'group-hover'],
			backgroundColor: ['group-focus', 'group-hover'],
		},
	},
	plugins: [require('tailwindcss-typography')()],
};
