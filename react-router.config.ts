import type { Config } from "@react-router/dev/config"
import { glob } from "node:fs/promises"
import { createGetUrl, getSlugs } from "fumadocs-core/source"

const getUrl = createGetUrl("/docs")
const configuredBasePath = process.env.DOCS_BASE_PATH ?? "/"
const basename =
  configuredBasePath === "/"
    ? "/"
    : `/${configuredBasePath.split("/").filter(Boolean).join("/")}/`

export default {
  basename,
  ssr: false,
  async prerender({ getStaticPaths }) {
    const paths: string[] = []
    const excluded: string[] = []

    for (const path of getStaticPaths()) {
      if (!excluded.includes(path)) paths.push(path)
    }

    for await (const entry of glob("**/*.mdx", { cwd: "content/docs" })) {
      const slugs = getSlugs(entry)
      paths.push(
        getUrl(slugs),
        `/llms.mdx/docs/${[...slugs, "content.md"].join("/")}`
      )
    }

    return paths
  },
} satisfies Config
