import { defineComponentDoc } from "../../../component-docs/schema"

import { GridLayoutDemo } from "./grid-layout.demo"

export const componentDoc = defineComponentDoc({
  name: "grid-layout",
  title: "Grid Layout",
  description:
    "A responsive, accessible dashboard layout with controlled persistence, edge resizing, and composable interaction controls.",
  component: GridLayoutDemo,
  source: {
    path: "app/components/ui/grid-layout.tsx",
    exportName: "GridLayout",
    propsType: "GridLayoutProps",
    additionalTypes: [
      { title: "GridLayout.Static", name: "GridLayoutStaticProps" },
      { title: "GridLayout.Item", name: "GridLayoutItemProps" },
      {
        title: "GridLayout.DragHandle",
        name: "GridLayoutDragHandleProps",
      },
      {
        title: "GridLayout.ResizeAnchor",
        name: "GridLayoutResizeAnchorProps",
      },
      { title: "Persisted value", name: "GridLayoutValue" },
      { title: "Change detail", name: "GridLayoutChangeDetail" },
    ],
  },
  preview: {
    path: "app/components/ui/grid-layout.demo.tsx",
    exportName: "GridLayoutDemo",
  },
  docs: {
    slug: "components/grid-layout",
    order: 0,
    usage: `import { GridLayout } from "@/components/ui/grid-layout"

export function Dashboard() {
  return (
    <GridLayout defaultLayout={{ version: 1, items: {} }}>
      <GridLayout.Item id="revenue">
        <section>Revenue</section>
      </GridLayout.Item>
      <GridLayout.Item id="filters" resize="horizontal">
        <section>Filters</section>
        <GridLayout.ResizeAnchor direction="e">
          Resize filters
        </GridLayout.ResizeAnchor>
      </GridLayout.Item>
      <GridLayout.Item id="orders" locked>
        <section>Orders</section>
      </GridLayout.Item>
    </GridLayout>
  )
}`,
    sections: [
      {
        title: "Persistence",
        markdown:
          "Use `layout` and `onLayoutChange` for controlled persistence, or `defaultLayout` for local state. The versioned snapshot stores one canonical 12-column layout and sparse overrides for narrower profiles.",
      },
      {
        title: "Keyboard controls",
        markdown:
          "Focus a move or resize control and press Enter or Space to begin. Arrow keys adjust by one cell, Shift + Arrow adjusts by five, Enter commits, and Escape cancels. The southeast corner is the default resize tab stop; provide a visible `GridLayout.ResizeAnchor` when resize discoverability is important.",
      },
      {
        title: "Resizing",
        markdown:
          'Items resize directly from their edges and corners. `resize="both"` enables N, NE, E, SE, S, SW, W, and NW; `horizontal` enables E and W; `vertical` enables N and S; and `false` disables resizing. Add one or more `GridLayout.ResizeAnchor` children with a `direction` when you want visible or otherwise custom resize controls; custom anchors replace that item\'s built-in edge hit areas.',
      },
      {
        title: "Motion",
        markdown:
          "Pointer dragging and resizing track the gesture directly, while displaced items and release states use short, interruptible transform transitions. Keyboard changes remain immediate, and `prefers-reduced-motion: reduce` disables spatial interpolation.",
      },
      {
        title: "Read-only layouts",
        markdown:
          "Use `GridLayout.Static` when the same persisted layout should render without editing controls.",
      },
      {
        title: "CSS variables",
        markdown:
          "Set `--grid-layout-row-height` and `--grid-layout-gap` to pixel values on the root to customize its geometry while preserving pointer math. Each item exposes `--grid-layout-column`, `--grid-layout-row`, `--grid-layout-width`, and `--grid-layout-height` for styling and inspection.",
      },
    ],
  },
  controls: {
    collision: { control: "inline-radio", options: ["push", "block"] },
    editable: { control: "boolean" },
  },
  variants: [
    {
      id: "editable",
      title: "Editable",
      initial: { collision: "push", editable: true },
      storybook: {
        parameters: { viewport: { defaultViewport: "desktop" } },
        play: async ({ canvas, canvasElement, userEvent }) => {
          const { expect } = await import("storybook/test")
          const handle = canvas.getByRole("button", {
            name: "Resize Revenue from southeast corner",
          })
          const item = canvasElement.querySelector<HTMLElement>(
            '[data-grid-layout-id="revenue"]'
          )
          if (!item) {
            throw new Error("Revenue grid item was not rendered")
          }
          await userEvent.click(handle)
          await userEvent.keyboard("{Enter}{ArrowDown}")
          await expect(item.getAnimations()).toHaveLength(0)
          await userEvent.keyboard("{Enter}")
          await expect(canvas.getByTestId("last-change")).toHaveTextContent(
            "resize:revenue:1"
          )
          const moveHandle = canvas.getByRole("button", {
            name: "Move Revenue",
          })
          await userEvent.click(moveHandle)
          await userEvent.keyboard("{Enter}{ArrowDown}{Escape}")
          await expect(canvas.getByTestId("last-change")).toHaveTextContent(
            "resize:revenue:1"
          )

          const rect = moveHandle.getBoundingClientRect()
          const itemBeforePointer = item.getBoundingClientRect()
          await userEvent.pointer([
            {
              keys: "[MouseLeft>]",
              target: moveHandle,
              coords: { x: rect.left + 4, y: rect.top + 4 },
            },
            { coords: { x: rect.left + 24, y: rect.top + 18 } },
          ])
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve())
          )
          const itemDuringPointer = item.getBoundingClientRect()
          await expect(item.style.transform).not.toBe("")
          await expect(itemDuringPointer.left - itemBeforePointer.left).toBe(20)
          await expect(itemDuringPointer.top - itemBeforePointer.top).toBe(14)
          await userEvent.pointer({ keys: "[/MouseLeft]" })

          const resizeHandle = canvas.getByRole("button", {
            name: "Resize Revenue from southeast corner",
          })
          const resizeRect = resizeHandle.getBoundingClientRect()
          const itemBeforeResize = item.getBoundingClientRect()
          await userEvent.pointer([
            {
              keys: "[MouseLeft>]",
              target: resizeHandle,
              coords: { x: resizeRect.left + 4, y: resizeRect.top + 4 },
            },
            { coords: { x: resizeRect.left + 22, y: resizeRect.top + 18 } },
          ])
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve())
          )
          const itemDuringResize = item.getBoundingClientRect()
          await expect(itemDuringResize.width - itemBeforeResize.width).toBe(18)
          await expect(itemDuringResize.height - itemBeforeResize.height).toBe(
            14
          )
          await userEvent.pointer({ keys: "[/MouseLeft]" })
          await Promise.all(
            item
              .getAnimations()
              .map((animation) => animation.finished.catch(() => undefined))
          )

          const defaultAnchors = item.querySelectorAll(
            '[data-slot="grid-layout-resize-anchor"]'
          )
          await expect(defaultAnchors).toHaveLength(8)
          const filters = canvasElement.querySelector<HTMLElement>(
            '[data-grid-layout-id="filters"]'
          )
          if (!filters) throw new Error("Filters grid item was not rendered")
          await expect(
            filters.querySelectorAll('[data-slot="grid-layout-resize-anchor"]')
          ).toHaveLength(1)
          await expect(
            canvas.getByRole("button", {
              name: "Resize Filters from east edge",
            })
          ).toBeInTheDocument()

          const westAnchor = item.querySelector<HTMLElement>(
            '[data-slot="grid-layout-resize-anchor"][data-direction="w"]'
          )
          if (!westAnchor) throw new Error("West resize edge was not rendered")
          const westRect = westAnchor.getBoundingClientRect()
          const beforeWestResize = item.getBoundingClientRect()
          await userEvent.pointer([
            {
              keys: "[MouseLeft>]",
              target: westAnchor,
              coords: { x: westRect.left + 4, y: westRect.top + 4 },
            },
            { coords: { x: westRect.left + 22, y: westRect.top + 4 } },
          ])
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve())
          )
          const duringWestResize = item.getBoundingClientRect()
          await expect(duringWestResize.left - beforeWestResize.left).toBe(18)
          await expect(duringWestResize.width - beforeWestResize.width).toBe(
            -18
          )
          await expect(duringWestResize.right).toBeCloseTo(
            beforeWestResize.right,
            1
          )
          await userEvent.pointer({ keys: "[/MouseLeft]" })
        },
      },
    },
    {
      id: "pointer-reflow",
      title: "Pointer reflow",
      fixed: { collision: "push", editable: true },
      docs: false,
      storybook: {
        parameters: { viewport: { defaultViewport: "desktop" } },
        play: async ({ canvas, canvasElement, userEvent }) => {
          const { expect } = await import("storybook/test")
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
          const grid = canvas.getByLabelText("Dashboard layout")
          const item = canvasElement.querySelector<HTMLElement>(
            '[data-grid-layout-id="revenue"]'
          )
          const resizeHandle = canvas.getByRole("button", {
            name: "Resize Revenue from southeast corner",
          })
          if (!item) throw new Error("Revenue grid item was not rendered")

          const gap = Number.parseFloat(
            getComputedStyle(grid).getPropertyValue("--grid-layout-gap")
          )
          const columns =
            grid.dataset.profile === "wide"
              ? 12
              : grid.dataset.profile === "medium"
                ? 6
                : 1
          const columnStep =
            (grid.clientWidth - gap * (columns - 1)) / columns + gap
          const rowStep =
            Number.parseFloat(
              getComputedStyle(grid).getPropertyValue(
                "--grid-layout-row-height"
              )
            ) + gap
          const peerMotions = ["filters", "activity"].map((id) => {
            const node = canvasElement.querySelector<HTMLElement>(
              `[data-grid-layout-id="${id}"][data-slot="grid-layout-item"]`
            )
            if (!node) throw new Error(`${id} grid item was not rendered`)
            return node
          })
          const itemGridSizeBefore = {
            height: item.parentElement?.style.getPropertyValue(
              "--grid-layout-height"
            ),
            width: item.parentElement?.style.getPropertyValue(
              "--grid-layout-width"
            ),
          }
          const peerRowsBefore = peerMotions.map((node) =>
            node.parentElement?.style.getPropertyValue("--grid-layout-row")
          )
          const itemBefore = item.getBoundingClientRect()
          const handleRect = resizeHandle.getBoundingClientRect()
          await userEvent.pointer([
            {
              keys: "[MouseLeft>]",
              target: resizeHandle,
              coords: { x: handleRect.left + 4, y: handleRect.top + 4 },
            },
            {
              coords: {
                x:
                  handleRect.left + (columns === 1 ? 0 : columnStep * 1.25) + 4,
                y: handleRect.top + (columns === 1 ? rowStep * 1.25 : 0) + 4,
              },
            },
          ])
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve())
          )

          const itemDuring = item.getBoundingClientRect()
          const peerRowsDuring = peerMotions.map((node) =>
            node.parentElement?.style.getPropertyValue("--grid-layout-row")
          )
          const itemGridSizeDuring = {
            height: item.parentElement?.style.getPropertyValue(
              "--grid-layout-height"
            ),
            width: item.parentElement?.style.getPropertyValue(
              "--grid-layout-width"
            ),
          }
          await expect(
            columns === 1
              ? itemDuring.height - itemBefore.height
              : itemDuring.width - itemBefore.width
          ).toBeCloseTo((columns === 1 ? rowStep : columnStep) * 1.25, 1)
          await expect(itemGridSizeDuring).not.toEqual(itemGridSizeBefore)
          await expect(peerRowsDuring).not.toEqual(peerRowsBefore)
          await expect(
            peerMotions.some((node) => node.getAnimations().length > 0)
          ).toBe(true)
          await userEvent.pointer({ keys: "[/MouseLeft]" })
        },
      },
    },
    {
      id: "static",
      title: "Static",
      fixed: { editable: false },
      storybook: {
        play: async ({ canvas }) => {
          const { expect } = await import("storybook/test")
          await expect(
            canvas.queryByRole("button", { name: /Move/ })
          ).not.toBeInTheDocument()
          await expect(
            canvas.queryByRole("button", { name: /Resize/ })
          ).not.toBeInTheDocument()
        },
      },
    },
  ],
  registry: {
    type: "registry:ui",
    dependencies: ["@base-ui/react", "react-grid-layout"],
    files: [
      { path: "app/components/ui/grid-layout.tsx", type: "registry:ui" },
      {
        path: "app/components/ui/grid-layout/accessibility.ts",
        type: "registry:lib",
      },
      {
        path: "app/components/ui/grid-layout/geometry.ts",
        type: "registry:lib",
      },
      {
        path: "app/components/ui/grid-layout/interactions.ts",
        type: "registry:lib",
      },
      { path: "app/components/ui/grid-layout/model.ts", type: "registry:lib" },
      {
        path: "app/components/ui/grid-layout/responsive.ts",
        type: "registry:lib",
      },
    ],
  },
})
