const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        test: "readonly",
        expect: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
