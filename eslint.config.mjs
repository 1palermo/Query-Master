export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        require: "readonly",
        module: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly"
      }
    },
    rules: {
      // Allow require/module.exports
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off",
      // Allow lexical declarations in case blocks
      "no-case-declarations": "off"
    }
  }
];
