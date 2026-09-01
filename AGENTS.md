# Plastic agent guide

Plastic is a shadcn component registry with a generated Fumadocs site and
Storybook workbench. Use Bun for every package and script command.

## Component workflow

- Treat each `app/components/**/*.component.tsx` manifest as the single source
  of truth for its component's examples, controls, Storybook tests, docs
  sections, API source types, and registry metadata.
- Keep reusable component code in `app/components/ui`. Put showcase-only state
  and fixtures in the adjacent `*.demo.tsx` file so registry consumers receive
  only the intended implementation.
- Represent each public feature with a manifest variant. Reference that variant
  from the matching docs section so the same working example appears in
  Storybook and Fumadocs.
- Export named public prop types and document meaningful props with TSDoc.
  Fumadocs generates the API reference from those types and places it after the
  authored documentation.
- Compose existing shadcn primitives for generic controls. Registry components
  must remain themeable and useful in the consumer's project rather than
  depending on Plastic-specific presentation.
- Prefer a clean current API. Remove obsolete surfaces outright when removal is
  requested; add compatibility aliases only when explicitly required.

## Generated boundaries

Run `bun run generate` after changing a component, manifest, demo, schema, or
generator. Inspect its output, but make source changes upstream.

Generated files include:

- `.generated/storybook/**`
- `app/.generated/fumadocs/**`
- `content/docs/components/*.mdx`
- `content/docs/components/meta.json`
- `registry.json`

The generated component docs are ignored. `registry.json` is generated and
committed because shadcn's `owner/repo/item` shorthand requires it.
Hand-authored guides belong elsewhere in `content/docs`.

## Verification

Use the narrowest red test that demonstrates a bug, then run checks in
proportion to the changed surface:

- Component logic: `bun run test:unit`
- Stories, interactions, accessibility, or examples: `bun run test-storybook`
- Public types or generated docs: `bun run typecheck`
- Registry metadata or payloads: `bun run registry:validate` and
  `bun run registry:build`
- Docs hydration or browser interaction: `bun run test:docs-restart`; also run
  `DOCS_BROWSER=webkit bun run test:docs-restart` for Safari-specific failures
- Broad or deployment-sensitive changes: `bun run lint`, `bun run build`, and
  `bun run build-storybook`

Verify interactive fixes in the actual Fumadocs page as well as Storybook.
Cold-start and restart behavior matter: server-rendered controls are not working
until hydration succeeds.

## Repository constraints

- Preserve unrelated work in a dirty tree and keep edits scoped to the task.
- Use the `@/` aliases defined by `components.json` and follow the existing Nova
  styling and Tailwind CSS v4 conventions.
- Keep GitHub Pages compatibility. Production docs run below `/plastic/`; use
  the existing base-path helpers instead of hard-coded root URLs.
- Add third-party code only when its license permits redistribution, retain the
  required notice in registry-delivered source, and credit the original author
  in the component docs.
