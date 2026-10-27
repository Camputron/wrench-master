import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintReact from '@eslint-react/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import { reactRefresh } from 'eslint-plugin-react-refresh'

export default defineConfig(
  globalIgnores(['**/node_modules', '**/dist', '**/out']),

  // JavaScript + TypeScript rules for every process (main, preload, renderer, shared, configs)
  tseslint.configs.recommended,

  // CommonJS build scripts (e.g. electron-builder hooks) use require().
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  },

  // React rules for the renderer only
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    extends: [eslintReact.configs['recommended-typescript'], reactHooks.configs.flat.recommended, reactRefresh.configs.vite()],
    rules: {
      // eslint-plugin-react-hooks (React's official rules) covers these; avoid reporting each problem twice.
      '@eslint-react/rules-of-hooks': 'off',
      '@eslint-react/exhaustive-deps': 'off',
      '@eslint-react/static-components': 'off',
      '@eslint-react/use-memo': 'off',
      '@eslint-react/purity': 'off',
      '@eslint-react/set-state-in-effect': 'off',
      '@eslint-react/set-state-in-render': 'off'
    }
  }
)
