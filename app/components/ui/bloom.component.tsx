import { defineComponentDoc } from "../../../component-docs/schema"

import { BloomDemo } from "./bloom.demo"

export const componentDoc = defineComponentDoc({
  name: "bloom",
  title: "Bloom",
  description:
    "An iOS-inspired menu whose shadcn trigger physically morphs into its measured content.",
  component: BloomDemo,
  source: {
    path: "app/components/ui/bloom.tsx",
    exportName: "Bloom",
    propsType: "BloomRootApi",
    additionalTypes: [
      { title: "Bloom.Container", name: "BloomContainerApi" },
      { title: "Bloom.Trigger", name: "BloomTriggerApi" },
      { title: "Bloom.Item", name: "BloomItemApi" },
    ],
  },
  preview: {
    path: "app/components/ui/bloom.demo.tsx",
    exportName: "BloomDemo",
  },
  docs: {
    slug: "components/bloom",
    order: 1,
    usage: `import { Bloom } from "@/components/ui/bloom"

export function Actions() {
  return (
    <Bloom direction="top" anchor="start">
      <Bloom.Container buttonSize={36} menuWidth={160} menuRadius={12}>
        <Bloom.Trigger aria-label="Open actions">
          <MoreHorizontalIcon />
        </Bloom.Trigger>
        <Bloom.Content>
          <Bloom.Group>
            <Bloom.Item onSelect={() => {}}>Edit</Bloom.Item>
            <Bloom.Item onSelect={() => {}}>Duplicate</Bloom.Item>
          </Bloom.Group>
        </Bloom.Content>
      </Bloom.Container>
    </Bloom>
  )
}`,
    sections: [
      {
        title: "Directions and anchors",
        markdown:
          'Set `direction` to `"top"`, `"bottom"`, `"left"`, or `"right"`, then use `anchor` to align the expanded surface with the start, center, or end of the trigger.',
        example: "directions",
      },
      {
        title: "Motion presets",
        markdown:
          "Tune the reference spring with `visualDuration` and `bounce`. Trigger and content choreography keeps the original blur and stagger, while reduced-motion preferences remove the spatial spring.",
        example: "motion",
      },
      {
        title: "Custom triggers",
        markdown:
          "`Bloom.Trigger` renders the shadcn Button and accepts its variants, sizes, and styling props while the surrounding `Bloom.Container` owns the morphing surface.",
        example: "custom-trigger",
      },
      {
        title: "Submenus",
        markdown:
          "Bloom reuses the shadcn Dropdown Menu submenu primitives, including focus management, keyboard navigation, collision-aware positioning, and nested dismissal.",
        example: "submenus",
      },
      {
        title: "Disabled items",
        markdown:
          "Items are shadcn Dropdown Menu items, so disabled semantics, keyboard behavior, destructive variants, shortcuts, labels, and grouping remain consistent with the rest of the application.",
        example: "disabled-items",
      },
      {
        title: "Selection controls",
        markdown:
          "Compose checkbox and radio items for menu preferences without implementing selection or indicator behavior yourself.",
        example: "selection-controls",
      },
      {
        title: "Controlled state",
        markdown:
          "Use `open` and `onOpenChange` when another part of the interface needs to coordinate the menu. Omit `open` for local uncontrolled state.",
        example: "controlled",
      },
      {
        title: "Backdrop",
        markdown:
          "Add `Bloom.Backdrop` for stronger modal emphasis. The backdrop uses the underlying Base UI menu lifecycle and remains optional.",
        example: "backdrop",
      },
      {
        title: "Credits",
        markdown:
          "Bloom was created by [Josh Puckett](https://github.com/joshpuckett/bloom) and released under the MIT License. Plastic preserves the original morphing engine and adapts its trigger and item styling to shadcn; the original copyright and license notice is retained in the installed source.",
      },
    ],
  },
  controls: {
    anchor: {
      control: "inline-radio",
      options: ["start", "center", "end"],
    },
    bounce: { control: "number" },
    controlled: { control: "boolean" },
    direction: {
      control: "inline-radio",
      options: ["top", "bottom", "left", "right"],
    },
    disabledItem: { control: "boolean" },
    selectionControls: { control: "boolean" },
    showBackdrop: { control: "boolean" },
    submenu: { control: "boolean" },
    textTrigger: { control: "boolean" },
    visualDuration: { control: "number" },
  },
  variants: [
    {
      id: "default",
      title: "Default",
      initial: {
        anchor: "start",
        bounce: 0.2,
        direction: "top",
        visualDuration: 0.25,
      },
      storybook: {
        play: async ({ canvas, canvasElement, userEvent }) => {
          const { expect, waitFor, within } = await import("storybook/test")
          const page = within(canvasElement.ownerDocument.body)
          const trigger = canvas.getByRole("button", {
            name: "Open Bloom menu",
          })
          trigger.focus()
          await userEvent.keyboard("{Enter}")
          await waitFor(() => expect(page.getByRole("menu")).toBeVisible())
          await userEvent.click(page.getByRole("menuitem", { name: "Edit" }))
          await expect(canvas.getByTestId("result")).toHaveTextContent(
            "Edit selected"
          )
        },
      },
    },
    {
      id: "directions",
      title: "Directions and anchors",
      fixed: { anchor: "end", direction: "bottom" },
      storybook: {
        play: async ({ canvas, canvasElement, userEvent }) => {
          const { expect, waitFor, within } = await import("storybook/test")
          const page = within(canvasElement.ownerDocument.body)
          const trigger = canvas.getByRole("button", {
            name: "Open Bloom menu",
          })

          await userEvent.click(trigger)
          await waitFor(() => expect(page.getByRole("menu")).toBeVisible())
          await userEvent.keyboard("{Escape}")
          await waitFor(() => expect(page.queryByRole("menu")).toBeNull())
          await waitFor(() =>
            expect(
              canvas.getByRole("button", { name: "Open Bloom menu" })
            ).toBeVisible()
          )
        },
      },
    },
    {
      id: "motion",
      title: "Motion presets",
      fixed: { bounce: 0.1, direction: "right", visualDuration: 0.18 },
    },
    {
      id: "custom-trigger",
      title: "Custom trigger",
      fixed: { textTrigger: true },
    },
    {
      id: "submenus",
      title: "Submenus",
      fixed: { submenu: true },
      storybook: {
        play: async ({ canvas, canvasElement, userEvent }) => {
          const { expect, waitFor, within } = await import("storybook/test")
          const page = within(canvasElement.ownerDocument.body)

          await userEvent.click(
            canvas.getByRole("button", { name: "Open Bloom menu" })
          )
          await userEvent.click(
            await page.findByRole("menuitem", { name: "Share" })
          )

          const share = page.getByRole("menuitem", { name: "Share" })
          const copyLink = page.getByRole("menuitem", { name: "Copy link" })
          const email = page.getByRole("menuitem", { name: "Email" })
          let panel = copyLink.parentElement

          while (
            panel &&
            !(
              getComputedStyle(panel).position === "absolute" &&
              getComputedStyle(panel).overflow === "hidden"
            )
          ) {
            panel = panel.parentElement
          }

          await expect(panel).not.toBeNull()
          await waitFor(() => {
            const shareRect = share.getBoundingClientRect()
            const copyRect = copyLink.getBoundingClientRect()
            const emailRect = email.getBoundingClientRect()
            const panelRect = panel!.getBoundingClientRect()
            const insets = [
              shareRect.top - panelRect.top,
              panelRect.right - copyRect.right,
              panelRect.bottom - emailRect.bottom,
              copyRect.left - panelRect.left,
            ]

            expect(Math.max(...insets) - Math.min(...insets)).toBeLessThan(1)
          })

          await userEvent.click(share)
          await waitFor(() =>
            expect(
              page.queryByRole("menuitem", { name: "Copy link" })
            ).toBeNull()
          )
        },
      },
    },
    {
      id: "disabled-items",
      title: "Disabled items",
      fixed: { disabledItem: true },
      storybook: {
        play: async ({ canvas, canvasElement, userEvent }) => {
          const { expect, within } = await import("storybook/test")
          const page = within(canvasElement.ownerDocument.body)
          const trigger = canvas.getByRole("button", {
            name: "Open Bloom menu",
          })
          trigger.focus()
          await userEvent.keyboard("{Enter}")
          await expect(
            page.getByRole("menuitem", { name: "Archive" })
          ).toHaveAttribute("aria-disabled", "true")
        },
      },
    },
    {
      id: "selection-controls",
      title: "Selection controls",
      fixed: { selectionControls: true },
    },
    {
      id: "controlled",
      title: "Controlled state",
      fixed: { controlled: true },
      storybook: {
        play: async ({ canvas, userEvent }) => {
          const { expect } = await import("storybook/test")
          await userEvent.click(
            canvas.getByRole("button", { name: "Open from outside" })
          )
          await expect(canvas.getByTestId("state")).toHaveTextContent("Open")
          await userEvent.keyboard("{Escape}")
          await expect(canvas.getByTestId("state")).toHaveTextContent("Closed")
        },
      },
    },
    {
      id: "backdrop",
      title: "Backdrop",
      fixed: { showBackdrop: true },
    },
  ],
  registry: {
    type: "registry:ui",
    dependencies: ["bloom-menu", "framer-motion"],
    registryDependencies: ["button"],
    files: [
      {
        path: "app/components/ui/bloom.tsx",
        type: "registry:ui",
        target: "components/ui/bloom.tsx",
      },
    ],
  },
  storybook: {
    parameters: {
      layout: "centered",
    },
  },
})
