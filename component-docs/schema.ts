import type { ElementType, ComponentProps } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

type PropsOf<Component extends ElementType> = ComponentProps<Component>

export type ComponentVariant<Component extends ElementType> = {
  id: string
  title: string
  initial?: Partial<PropsOf<Component>>
  fixed?: Partial<PropsOf<Component>>
  docs?: boolean
  storybook?: Pick<StoryObj<{ component: Component }>, "parameters" | "play">
}

export type ComponentDoc<Component extends ElementType> = {
  name: string
  title: string
  description: string
  component: Component
  source: {
    path: string
    exportName: string
    propsType: string
  }
  docs: {
    slug: `components/${string}`
    order: number
    usage: string
    sections?: Array<{
      title: string
      markdown: string
    }>
  }
  controls?: Meta<Component>["argTypes"]
  variants: Array<ComponentVariant<Component>>
  registry: {
    type:
      | "registry:ui"
      | "registry:block"
      | "registry:lib"
      | "registry:hook"
      | "registry:item"
    dependencies?: string[]
    devDependencies?: string[]
    registryDependencies?: string[]
    files: Array<{
      path: string
      type: string
      target?: string
    }>
  }
  storybook?: {
    parameters?: Meta<Component>["parameters"]
  }
}

export function defineComponentDoc<Component extends ElementType>(
  definition: ComponentDoc<Component>
) {
  return definition
}
