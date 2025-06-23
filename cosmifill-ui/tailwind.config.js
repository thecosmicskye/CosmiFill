/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    'bg-purple-50',
    'bg-purple-500',
    'bg-purple-600',
    'text-purple-600',
    'border-purple-200',
    'from-purple-50',
    'from-purple-500',
    'to-pink-600',
    'via-pink-50',
    'dark:bg-gray-900',
    'dark:text-purple-400',
    'shadow-lg',
    'shadow-purple-500',
    { pattern: /bg-purple-/, variants: ['hover', 'dark'] },
    { pattern: /text-purple-/, variants: ['hover', 'dark'] },
    { pattern: /from-purple-/, variants: ['hover', 'dark'] },
    { pattern: /to-pink-/, variants: ['hover', 'dark'] },
  ]
}