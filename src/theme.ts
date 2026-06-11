import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#fff5f0' },
          100: { value: '#ffe6db' },
          200: { value: '#ffc9b3' },
          300: { value: '#ffa280' },
          400: { value: '#ff7b4d' },
          500: { value: '#FF6B35' },
          600: { value: '#e55a2a' },
          700: { value: '#c44a22' },
          800: { value: '#9e3c1b' },
          900: { value: '#7a2f15' },
        },
        gray: {
          50: { value: '#fafafa' },
          100: { value: '#f5f5f5' },
          200: { value: '#e5e5e5' },
          300: { value: '#d4d4d4' },
          400: { value: '#a3a3a3' },
          500: { value: '#737373' },
          600: { value: '#525252' },
          700: { value: '#404040' },
          800: { value: '#262626' },
          900: { value: '#171717' },
          950: { value: '#0a0a0a' },
        },
      },
      fonts: {
        heading: { value: "'Space Grotesk', sans-serif" },
        body: { value: "'Inter', sans-serif" },
        mono: { value: "'JetBrains Mono', monospace" },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: { value: '#0a0a0a' },
          subtle: { value: '#141414' },
          muted: { value: '#1a1a1a' },
        },
        fg: {
          DEFAULT: { value: '#faf9f6' },
          muted: { value: 'rgba(255, 255, 255, 0.5)' },
          subtle: { value: 'rgba(255, 255, 255, 0.3)' },
        },
        accent: {
          DEFAULT: { value: '{colors.brand.500}' },
          hover: { value: '{colors.brand.600}' },
        },
      },
    },
  },
  globalCss: {
    'html, body': {
      bg: '#0a0a0a',
      color: '#faf9f6',
      fontFamily: 'body',
      lineHeight: '1.6',
    },
    '::selection': {
      bg: 'brand.500',
      color: 'white',
    },
    '::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '::-webkit-scrollbar-track': {
      bg: '#0a0a0a',
    },
    '::-webkit-scrollbar-thumb': {
      bg: '#404040',
      borderRadius: '4px',
    },
    '::-webkit-scrollbar-thumb:hover': {
      bg: '#525252',
    },
  },
})

export const system = createSystem(defaultConfig, config)
