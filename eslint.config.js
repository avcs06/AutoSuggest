import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
    { ignores: ['dist', 'node_modules'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    reactHooks.configs.flat.recommended,
    {
        languageOptions: {
            globals: { ...globals.browser }
        },
        rules: {
            'no-var': 2,
            'prefer-const': 2,
            'no-shadow-restricted-names': 2,
            'no-console': 1,
            'no-debugger': 1,
            'no-alert': 1,
            'curly': [2, 'multi-line'],
            'eqeqeq': 2,
            'no-eval': 2,
            'no-new-wrappers': 2,
            'no-throw-literal': 2,
            'radix': 0,
            'yoda': 2,
            'no-sequences': 0,
            '@typescript-eslint/no-non-null-assertion': 0
        }
    }
);
