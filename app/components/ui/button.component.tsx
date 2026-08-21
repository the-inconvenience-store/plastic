import { defineComponentDoc } from "../../../component-docs/schema"

import { Button } from "./button"

export const componentDoc = defineComponentDoc({
  name: "button",
  title: "Button",
  description: "Displays a button or a link styled as a button.",
  component: Button,
  source: {
    path: "app/components/ui/button.tsx",
    exportName: "Button",
    propsType: "ButtonProps",
  },
  docs: {
    slug: "components/button",
    order: 0,
    usage: `import { Button } from "@/components/ui/button"

export function Example() {
  return <Button>Continue</Button>
}`,
    sections: [
      {
        title: "Guidance",
        markdown:
          "Use a button for actions and a rendered link for navigation. Prefer a built-in variant and size before adding layout classes.",
      },
    ],
  },
  controls: {
    variant: {
      control: "select",
      options: [
        "default",
        "outline",
        "secondary",
        "ghost",
        "destructive",
        "link",
      ],
    },
    size: {
      control: "select",
      options: [
        "default",
        "xs",
        "sm",
        "lg",
        "icon",
        "icon-xs",
        "icon-sm",
        "icon-lg",
      ],
    },
  },
  variants: [
    {
      id: "default",
      title: "Default",
      initial: { children: "Continue" },
    },
    {
      id: "outline",
      title: "Outline",
      initial: { children: "Continue" },
      fixed: { variant: "outline" },
    },
    {
      id: "disabled",
      title: "Disabled",
      initial: { children: "Continue" },
      fixed: { disabled: true },
      storybook: {
        play: async ({ canvas }) => {
          const { expect } = await import("storybook/test")
          await expect(
            canvas.getByRole("button", { name: "Continue" })
          ).toBeDisabled()
        },
      },
    },
    {
      id: "css-check",
      title: "CSS check",
      initial: { children: "Styled button" },
      docs: false,
      storybook: {
        play: async ({ canvas }) => {
          const { expect } = await import("storybook/test")
          const button = canvas.getByRole("button", { name: "Styled button" })
          await expect(getComputedStyle(button).height).toBe("32px")
        },
      },
    },
  ],
  registry: {
    type: "registry:ui",
    dependencies: ["@base-ui/react", "class-variance-authority"],
    files: [
      {
        path: "app/components/ui/button.tsx",
        type: "registry:ui",
      },
    ],
  },
})
