import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'ivory-bg': '#FAF8F5',
        'ivory-card': '#FFFFFF',
        'blush-soft': '#FAF0F0',
        'blush-deep': '#A62626',
        champagne: '#B58938',
        'champagne-light': '#F8F3E8',
        sage: '#2E5E4E',
        'sage-light': '#EEF4F1',
        charcoal: '#1F1C19',
        'muted-taupe': '#7A7267',
        'border-warm': '#EAE2D3',
        sandal: '#F4EDE1',
        'champagne-border': '#EAE2D3',
        sindoor: '#A62626',
        ink: '#1F1C19',
        muted: '#7A7267',
        ivory: '#FAF8F5',
        silk: '#FFFFFF',
        'brass-line': '#EAE2D3',
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        body: ['Plus Jakarta Sans', 'sans-serif'],
      },
      boxShadow: {
        'card-warm': '0 4px 16px -2px rgba(36, 30, 28, 0.06), 0 1px 3px rgba(198, 146, 20, 0.08)',
        float: '0 10px 25px -5px rgba(166, 38, 38, 0.22)',
        device: '0 24px 60px -12px rgba(31, 28, 25, 0.12), 0 0 0 1px #EAE2D3',
      },
    },
  },
  plugins: [],
}

export default config
