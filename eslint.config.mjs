import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// eslint-config-next 16 ships flat configs; loading them through FlatCompat makes
// @eslint/eslintrc choke on the circular plugin objects, so they are imported directly.
const eslintConfig = defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Same file set as the Next.js config, so the plugins these rules belong to are in scope.
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      // React Compiler rules that eslint-plugin-react-hooks 7 turns on; the stock theme
      // provider and header sync state in effects on purpose, so these stay advisory.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  globalIgnores(['.next/', 'src/payload-types.ts', 'src/payload-generated-schema.ts', 'src/generated/']),
])

export default eslintConfig
