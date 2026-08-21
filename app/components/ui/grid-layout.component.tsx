import { defineComponentDoc } from "../../../component-docs/schema"

import { GridLayoutDemo } from "./grid-layout.demo"

export const componentDoc = defineComponentDoc({
  name: "grid-layout",
  title: "Grid Layout",
  description:
    "A responsive, accessible dashboard layout with controlled persistence and composable drag handles.",
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
          "Focus a move or resize handle and press Enter or Space to begin. Arrow keys adjust by one cell, Shift + Arrow adjusts by five, Enter commits, and Escape cancels.",
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
            name: "Resize Revenue",
          })
          const item = canvasElement.querySelector<HTMLElement>(
            '[data-grid-layout-id="revenue"]'
          )
          if (!item) throw new Error("Revenue grid item was not rendered")
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
          await expect(item.getAnimations()).not.toHaveLength(0)
          await expect(itemDuringPointer.left - itemBeforePointer.left).toBe(20)
          await expect(itemDuringPointer.top - itemBeforePointer.top).toBe(14)
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
