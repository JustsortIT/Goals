import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // src/shell is a copy of PubPixels' shell, checked there: see src/shell/COPIED_FROM.
  globalIgnores(['dist/', '.claude/', 'src/shell/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Node scripts, not part of the game bundle.
    files: ['tools/**/*.mjs', 'src/games/*/tools/**/*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        URL: 'readonly',
        crypto: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
);
