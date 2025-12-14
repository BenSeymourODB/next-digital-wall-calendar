/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
const config = {
  semi: true,
  singleQuote: false,
  trailingComma: "es5",
  tabWidth: 2,
  useTabs: false,
  endOfLine: "lf",
  plugins: [
    "@trivago/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss",
  ],
  importOrder: [
    "^@/(.*)$",
    "^react$",
    "^next",
    "<THIRD_PARTY_MODULES>",
    "^[./]",
  ],
  importOrderSeparation: false,
  importOrderSortSpecifiers: true,
};

export default config;
