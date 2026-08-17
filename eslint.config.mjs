import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "packages/*/extraction/**",
      "**/*.mjs",
      "**/*.js",
      "**/next-env.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { disallowTypeAnnotations: false },
      ],
    },
  },
  {
    // Purity boundary: domain packages do no I/O and read no environment.
    files: ["packages/*/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["node:*", "fs", "path", "os", "child_process", "http", "https"], message: "Domain packages must stay pure (no I/O)." },
            { group: ["react", "react-dom", "next", "next/*"], message: "Domain packages must not depend on UI frameworks." },
            { group: ["drizzle-orm", "drizzle-orm/*", "better-sqlite3"], message: "Domain packages must not touch persistence." },
          ],
        },
      ],
      "no-restricted-globals": ["error", "process"],
    },
  },
);
