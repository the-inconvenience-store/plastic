# React Grid Layout feature-gap analysis

Research basis: upstream `react-grid-layout` at commit [`3db8224`](https://github.com/react-grid-layout/react-grid-layout/tree/3db82246e6dbd65a186afed007a9b8cb6c358b29) (2026-08-24), compared with Plastic's local Grid Layout source, tests, generated docs, and open issues. Only first-party upstream sources were used.

## Already covered

| Capability                                                                            | Plastic coverage                                                                                                                                                             |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dragging, eight-direction resizing, collision push/block, static items, min/max sizes | Supported. Static behavior and obstacle collision resolution are covered by unit and Storybook tests.                                                                        |
| Responsive layouts                                                                    | `profiles` select columns by container width; persisted canonical geometry gains sparse per-profile overrides. This replaces RGL's breakpoint-to-layout maps.                |
| Persistence and dynamic children                                                      | Controlled/uncontrolled versioned snapshots, reconciliation, auto-placement, and preservation of temporarily hidden items are supported.                                     |
| Measurement and SSR                                                                   | Container width is observed internally; callers do not need RGL's explicit `width`, `WidthProvider`, or `useContainerWidth`. SSR is tested.                                  |
| Handles and exclusions                                                                | Compound `DragHandle`/`ResizeAnchor` parts and automatic interactive-content exclusions replace CSS selector and render-callback configuration.                              |
| Read-only and accessible operation                                                    | `GridLayout.Static`, keyboard move/resize, live-region announcements, reduced-motion handling, and cancel/commit semantics go beyond the upstream static/read-only examples. |

Sources: [RGL component API](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/README.md#reactgridlayout-props), [responsive API](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/README.md#responsivegridlayout-props), [layout item API](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/src/core/types.ts#L45-L81).

## Implemented follow-up

The gaps identified during the initial comparison are now covered by the public
Grid Layout interface and its shared headless engine:

| Priority | Capability                                | Gap                                                                                                                                            |
| -------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | Per-item drag enablement                  | `draggable={false}` disables movement independently while preserving resize.                                                                   |
| High     | Compaction modes                          | `compaction` supports vertical, horizontal, wrapped, none, and validated custom compactors.                                                    |
| High     | Interaction lifecycle                     | `onInteraction` reports ordered start/change/end/cancel phases; `onLayoutChange` remains commit-only.                                          |
| High     | External palette drops                    | `drop` decodes native payloads, renders a collision-aware placeholder, and commits through an application callback.                            |
| Medium   | Overlap and stacking                      | `collision="overlap"` and item `layer` provide intentional overlap and deterministic stacking.                                                 |
| Medium   | Extensible constraints                    | Root/item constraint pipelines include bounds, axis ranges, pixel-aware aspect ratio, snapping, and custom functions.                          |
| Medium   | Scaled containers                         | `viewport.scale` supports automatic x/y transform detection and explicit scale values.                                                         |
| Medium   | Grid bounds and sizing                    | `viewport` supplies max rows, content/fixed height, x/y gaps, padding, and per-profile overrides.                                              |
| Medium   | Responsive lifecycle/control              | Controlled/uncontrolled profiles, width/profile callbacks, `controllerRef.replaceProfile`, and atomic `gridLayout.replaceProfile` are public.  |
| Low      | Drag threshold and selector configuration | Root/item thresholds and scoped handle/cancel selectors complement the compound controls.                                                      |
| Low      | Headless hooks and public algorithms      | `gridLayout` and `useGridLayoutEngine` expose the same transitions and policy operations used by the React adapter, using Plastic-owned types. |

Sources: [RGL configuration and callbacks](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/README.md#api-reference), [compactors and position strategies](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/README.md#compactor), [constraint API](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/src/core/constraints.ts), [external-drop example](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/test/examples/12-drag-from-outside.jsx), [overlap example](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/test/examples/16-allow-overlap.jsx).

## Recommended sequence

1. Add symmetric per-item interaction flags and start/change/end lifecycle events.
2. Introduce a small first-party compaction union: `vertical | horizontal | none`; keep custom compactor injection deferred until a real use case appears.
3. Implement the already-tracked external-drop and overlap capabilities as opt-in modules.
4. Add constraint composition beginning with aspect ratio, visible-container bounds, and snap steps.
5. Add scale-aware pointer measurement if transformed-canvas use cases emerge.

Avoid copying explicit width plumbing, HOCs, opaque child `data-grid` configuration, or the full low-level utility surface. Plastic's observed container, compound components, declarative item configuration, and versioned persistence are simpler replacements rather than gaps.
