module.exports = [
    {
        ignores: ['node_modules/**', '.next/**', 'dist/**'],
    },
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.js'],
        languageOptions: {
            parser: require('@typescript-eslint/parser'),
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: 'module',
            },
        },
        plugins: {
            '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
            'react-hooks': require('eslint-plugin-react-hooks')
        },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn'
        },
    },
];
