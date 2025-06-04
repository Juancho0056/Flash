import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

const config: Config = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  plugins: [forms]
};

export default config;