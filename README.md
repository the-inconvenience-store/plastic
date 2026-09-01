# Plastic

A shadcn component registry with Fumadocs documentation and a Storybook component workbench. The project uses Bun, React Router, Tailwind CSS v4, Base UI, and the shadcn Nova style.

## Develop components

```sh
bun install --frozen-lockfile
bun run storybook
```

The install also activates the tracked Lefthook git hooks. Pre-commit formats
and lints staged source files; pre-push runs the typecheck and unit tests.

Keep each component's metadata next to it as `*.component.tsx`. This typed manifest is the only component-specific authoring surface: it defines examples, Storybook tests and parameters, docs guidance, controls, and registry metadata. Storybook stories and Fumadocs Story modules are generated from it and refreshed while either development server is running.

Export a named props type with useful TSDoc from the component implementation. Fumadocs TypeScript turns that type into the generated API table.

## Write documentation

High-level guides live in `content/docs` and are rendered by Fumadocs. Component reference pages are generated; do not edit them directly. Start the local site with:

```sh
bun run dev
```

The static build includes the documentation, search index, LLM-friendly outputs, and built registry JSON:

```sh
bun run build
```

## Author the registry

The source registry metadata lives in the component manifests. `registry.json` is generated and committed so shadcn can resolve the repository shorthand; installer payloads remain generated build output.

```sh
bun run generate
bun run registry:validate
bun run registry:build
```

The registry build writes installer payloads to `public/r`. Locally, Fumadocs serves them at `http://localhost:5173/r`. GitHub Pages serves them under the repository path, for example:

```sh
bunx --bun shadcn@latest add https://the-inconvenience-store.github.io/plastic/r/button.json
```

Because the generated root registry is committed, the public GitHub repository shorthand is also available:

```sh
bunx --bun shadcn@latest add the-inconvenience-store/plastic/button
```

## Checks

```sh
bun run generate:check
bun run registry:validate
bun run format:check
bun run typecheck
bun run lint
bun run test:unit
bun run test-storybook
bun run build
bun run build-storybook
bun audit
```

Pull requests run the complete check and build sequence in GitHub Actions.

## GitHub Pages

`.github/workflows/pages.yml` runs `bun run build:pages` and deploys `build/client` on pushes to `main`. The Pages build applies the `/plastic/` project basename and stages the pre-rendered routes at the artifact root. In the repository settings, set Pages → Build and deployment → Source to **GitHub Actions**.
