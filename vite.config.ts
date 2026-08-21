import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"
import { defineConfig } from "vite"
import { fumadocsMdx } from "fumadocs-mdx/vite"
import story from "@fumadocs/story/vite"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import { playwright } from "@vitest/browser-playwright"

const base = process.env.DOCS_BASE_PATH ?? "/"
const isStorybook = process.env.STORYBOOK === "true"

export default defineConfig({
  base,
  plugins: isStorybook
    ? [tailwindcss()]
    : [story(), fumadocsMdx(), tailwindcss(), reactRouter()],
  optimizeDeps: {
    include: ["msw-storybook-addon/csf3"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "app"),
    },
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(import.meta.dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
})
