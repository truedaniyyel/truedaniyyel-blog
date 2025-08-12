import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { defineEcConfig } from 'astro-expressive-code';

export default defineEcConfig({
	plugins: [pluginLineNumbers()],
	themes: ['andromeeda'],

	styleOverrides: {
		borderRadius: '0.5rem',
		uiFontFamily: 'JetBrains Mono',
		codeFontFamily: 'JetBrains Mono',
		codeFontSize: '1rem',
		frames: {
			shadowColor: 'none',
		},
	},
});
