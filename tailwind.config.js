/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "!./_archive/**",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#f0f5ff',
                    100: '#dce8ff',
                    200: '#b8d0ff',
                    300: '#8fb3f5',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1a2d50',
                    900: '#131c30',
                    950: '#0c1220',
                },
            },
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
            },
            boxShadow: {
                'glow-brand': '0 0 30px -5px rgba(100, 116, 139, 0.25)',
                'card': '0 1px 3px 0 rgba(0,0,0,0.04), 0 4px 12px 0 rgba(0,0,0,0.06)',
                'card-hover': '0 4px 16px 0 rgba(0,0,0,0.15), 0 1px 3px 0 rgba(0,0,0,0.04)',
            },
            animation: {
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'float': 'float 6s ease-in-out infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-6px)' },
                }
            }
        },
    },
    plugins: [],
}
