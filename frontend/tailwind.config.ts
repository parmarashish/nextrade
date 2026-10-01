import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          dark: 'var(--primary-dark)',
          light: 'var(--primary-light)',
        },
        sidebar: {
          bg: 'var(--sidebar-bg)',
          text: 'var(--sidebar-text)',
          activeBg: 'var(--sidebar-active-bg)',
          activeText: 'var(--sidebar-active-text)',
        },
        content: {
          bg: 'var(--content-bg)',
        },
        card: {
          bg: 'var(--card-bg)',
        },
        border: 'var(--border)',
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        badge: {
          bg: 'var(--badge-bg)',
        },
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '2px',
        md: '4px',
        lg: '6px',
        xl: '8px',
      },
      boxShadow: {
        card: '0 2px 4px rgba(0, 0, 0, 0.08)',
        subtle: '0 1px 3px rgba(0, 0, 0, 0.05)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        base: ['14px', '20px'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
