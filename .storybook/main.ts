import type { StorybookConfig } from "@storybook/react-vite"

const config: StorybookConfig = {
  staticDirs: ["../public"],
  stories: ["../.generated/storybook/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "msw-storybook-addon",
  ],
  framework: "@storybook/react-vite",
}
export default config
