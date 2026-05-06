import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1a4731',
        secondary: '#c9a227',
        accent: '#f0c84a',
        dark: '#0f1e14',
        surface: '#1e3a28',
      },
    },
  },
  plugins: [],
}

export default config