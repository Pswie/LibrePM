module.exports = {
    root: true,
    env: { browser: true, node: true, es2022: true },
    extends: ['eslint:recommended'],
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    globals: { __APP_VERSION__: 'readonly' },
    plugins: ['react-hooks'],
    ignorePatterns: ['dist/', 'dist-web/', 'dist-electron/', 'build-resources/', '.vercel/', '.mobile-smoke/'],
    rules: {
        // Legacy screens have unused props/imports; enforce runtime correctness first.
        'no-unused-vars': 'off',
        'no-empty': ['error', { allowEmptyCatch: true }],
        'react-hooks/rules-of-hooks': 'error',
    },
};
