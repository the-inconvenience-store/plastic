# React Grid Layout static elements

Research basis: upstream `react-grid-layout` at commit [`3db8224`](https://github.com/react-grid-layout/react-grid-layout/tree/3db82246e6dbd65a186afed007a9b8cb6c358b29) (2026-08-24). Only first-party examples, documentation, source, and tests were used.

## Contract

A layout item becomes static by adding the optional `static: true` field to its normal serialized layout record:

```ts
{ i: "2", x: 2, y: 0, w: 4, h: 3, static: true }
```

The official static-elements example declares it through a child's `data-grid`; the v2 quick start shows the same field in an explicit `layout` array. The item still has the ordinary `i`, `x`, `y`, `w`, and `h` fields. Sources: [static example](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/test/examples/05-static-elements.jsx#L6-L35), [README quick start](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/README.md#L212-L235), [layout-item type](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/src/core/types.ts#L45-L81).

By default, `static: true` makes the item neither draggable nor resizable. The renderer derives both capabilities as false for a static item. In current v2, an explicit per-item `isDraggable` or `isResizable` boolean takes precedence, so `static: true, isDraggable: true` or `static: true, isResizable: true` is a supported escape hatch in the implementation even though the ordinary documented meaning of static is fully fixed. Sources: [render capability resolution](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/src/react/components/GridLayout.tsx#L1170-L1188), [move guard](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/src/core/layout.ts#L265-L279).

## Collision and compaction behavior

- A static item is an immovable obstacle. When a moving item collides with it, collision resolution moves the moving item, not the static one. With `preventCollision`, the attempted move is reverted; with `allowOverlap`, overlap is retained and the static item still does not move. Sources: [move collision pipeline](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/src/core/layout.ts#L307-L352), [upstream regression tests](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/test/spec/utils-test.js#L485-L516).
- Vertical and horizontal compactors seed collision checks with all static items, skip compacting each static item itself, and compact non-static items around them. Therefore ordinary dragging, resizing, or compaction must not displace a static item. Sources: [vertical and horizontal compactors](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/src/core/compactors.ts#L174-L245), [static compaction test](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/test/spec/compactors-test.ts#L55-L72).
- Initial bounds correction is a separate normalization step: it can move an out-of-bounds static item horizontally, and if authored static items overlap one another it moves later static items downward until they no longer collide. This is input correction, not interactive displacement. Source: [bounds correction](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/src/core/layout.ts#L185-L237).

## Persistence and responsive layouts

`static` is part of `LayoutItem`, is preserved by the library's layout-cloning path, and is included in layouts emitted to `onLayoutChange`; consequently it belongs in saved layout data alongside position and size. Sources: [clone implementation](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/src/core/layout.ts#L78-L106), [`data-grid` lifecycle test](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/test/spec/lifecycle-test.js#L277-L323), [README feature contract](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/README.md#L175-L184).

Responsive layouts are separate layout arrays per breakpoint. If a breakpoint has an authored layout, that layout is cloned; if missing, RGL clones the previous or nearest larger breakpoint, then corrects bounds and compacts it. Because cloning preserves `static`, the flag carries into generated breakpoint layouts. A static item's coordinates can nevertheless differ by breakpoint when explicitly authored that way, or be normalized to fit a narrower column count. Sources: [responsive API](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/README.md#L262-L306), [responsive layout generation](https://github.com/react-grid-layout/react-grid-layout/blob/3db82246e6dbd65a186afed007a9b8cb6c358b29/src/core/responsive.ts#L110-L155).

## Compatibility target for Grid Layout

The minimum compatible API is a `static?: boolean` field on each public layout item with these guarantees:

1. Static items are not draggable or resizable by default.
2. Static items retain their position and size during user interaction and ordinary compaction.
3. Dynamic items resolve collisions around static items; they never displace them.
4. The flag survives controlled updates, change callbacks, persistence, and responsive-layout derivation.
5. If per-item drag/resize overrides are supported, their precedence over `static` must be explicit and tested.
