/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./app/**/*.{ts,tsx,js,jsx}', './components/**/*.{ts,tsx,js,jsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui'],
            },
        },
    },
    plugins: [],
};