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
// Fumadocs' MDX and story transforms introduce these imports after Vite's
// source scan. Pre-bundle them up front so Vite never reloads mid-hydration.
const docsOptimizedDependencies = [
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@base-ui/react/button",
  "@base-ui/react/collapsible",
  "@base-ui/react/dialog",
  "@base-ui/react/direction-provider",
  "@base-ui/react/input",
  "@base-ui/react/menu",
  "@base-ui/react/navigation-menu",
  "@base-ui/react/popover",
  "@base-ui/react/scroll-area",
  "@base-ui/react/tabs",
  "@base-ui/react/use-render",
  "@fuma-translate/react",
  "bloom-menu",
  "class-variance-authority",
  "clsx",
  "cnfast",
  "framer-motion",
  "hast-util-to-jsx-runtime",
  "lucide-react",
  "next-themes",
  "react-grid-layout/core",
  "react-grid-layout/extras",
  "rehype-raw",
  "remark",
  "remark-rehype",
  "scroll-into-view-if-needed",
  "tailwind-merge",
  "unist-util-visit",
  "vfile",
  "zbsearch",
]

export default defineConfig({
  base,
  cacheDir:
    process.env.DOCS_CACHE_DIR ??
    (isStorybook ? "node_modules/.vite-storybook" : "node_modules/.vite-docs"),
  plugins: isStorybook
    ? [tailwindcss()]
    : [story(), fumadocsMdx(), tailwindcss(), reactRouter()],
  optimizeDeps: {
    include: isStorybook
      ? ["msw-storybook-addon/csf3"]
      : docsOptimizedDependencies,
    noDiscovery: !isStorybook,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "app"),
    },
    dedupe: ["react", "react-dom"],
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
