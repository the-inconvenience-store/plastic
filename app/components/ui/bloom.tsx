"use client"

/**
 * Plastic adapter for Bloom by Josh Puckett.
 * https://github.com/joshpuckett/bloom
 *
 * MIT License
 * Copyright (c) 2026 Josh Puckett
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import * as React from "react"
import {
  Menu as BloomPrimitive,
  type Anchor,
  type BloomContainerProps as PrimitiveContainerProps,
  type BloomContentProps as PrimitiveContentProps,
  type BloomItemProps as PrimitiveItemProps,
  type BloomRootProps as PrimitiveRootProps,
  type BloomSubMenuContentProps as PrimitiveSubContentProps,
  type BloomSubMenuProps as PrimitiveSubProps,
  type BloomSubMenuTriggerProps as PrimitiveSubTriggerProps,
  type BloomTriggerProps as PrimitiveTriggerProps,
  type DetailedAnimationConfig,
  type Direction,
} from "bloom-menu"

import { cn } from "@/lib/utils"
import { buttonVariants, type ButtonProps } from "@/components/ui/button"

export type BloomDirection = Direction
export type BloomAnchor = Anchor
export type BloomAnimationConfig = DetailedAnimationConfig
export type BloomRootProps = PrimitiveRootProps

export interface BloomContainerProps extends PrimitiveContainerProps {}

export interface BloomTriggerProps extends PrimitiveTriggerProps {
  "aria-label"?: string
  size?: ButtonProps["size"]
  variant?: ButtonProps["variant"]
}

export interface BloomContentProps extends PrimitiveContentProps {}

export interface BloomItemProps extends Omit<PrimitiveItemProps, "className"> {
  className?: string
  /** Applies a shadcn Button visual variant to the menu item. */
  variant?: ButtonProps["variant"]
}

export interface BloomSubProps extends PrimitiveSubProps {}
export interface BloomSubTriggerProps extends PrimitiveSubTriggerProps {
  /** Applies a shadcn Button visual variant to the submenu trigger. */
  variant?: ButtonProps["variant"]
}
export interface BloomSubContentProps extends PrimitiveSubContentProps {}

/** The source API name used by generated documentation. */
export interface BloomRootApi extends Pick<
  BloomRootProps,
  | "anchor"
  | "animationConfig"
  | "bounce"
  | "closeOnClickOutside"
  | "closeOnEscape"
  | "defaultOpen"
  | "direction"
  | "onOpenChange"
  | "open"
  | "visualDuration"
> {}

/** The source API name used by generated documentation. */
export interface BloomContainerApi extends Pick<
  BloomContainerProps,
  "buttonRadius" | "buttonSize" | "menuRadius" | "menuWidth"
> {}

/** The source API name used by generated documentation. */
export interface BloomTriggerApi extends Pick<
  BloomTriggerProps,
  "className" | "disabled" | "size" | "variant"
> {}

/** The source API name used by generated documentation. */
export interface BloomItemApi extends Pick<
  BloomItemProps,
  "className" | "closeOnSelect" | "disabled" | "onSelect" | "variant"
> {}

function BloomContainer({
  buttonRadius = 8,
  className,
  menuRadius = 12,
  ...props
}: BloomContainerProps) {
  return (
    <BloomPrimitive.Container
      data-slot="bloom-container"
      className={cn(
        "bg-popover text-popover-foreground [&:has(.bloom-trigger):not(:has([role=menu]))]:shadow-none! [&:has([role=menu])_.bloom-trigger]:opacity-0!",
        className
      )}
      buttonRadius={buttonRadius}
      menuRadius={menuRadius}
      {...props}
    />
  )
}

function BloomTrigger({
  "aria-label": ariaLabel,
  children,
  className,
  size = "icon-lg",
  variant = "outline",
  ...props
}: BloomTriggerProps) {
  return (
    <BloomPrimitive.Trigger
      data-slot="bloom-trigger"
      className={cn(
        buttonVariants({ size, variant }),
        "bloom-trigger size-full rounded-[inherit]",
        className
      )}
      {...props}
    >
      {ariaLabel ? <span className="sr-only">{ariaLabel}</span> : null}
      {children}
    </BloomPrimitive.Trigger>
  )
}

function BloomContent({ className, ...props }: BloomContentProps) {
  return (
    <BloomPrimitive.Content
      data-slot="bloom-content"
      className={cn("p-2", className)}
      {...props}
    />
  )
}

function BloomItem({ className, variant = "ghost", ...props }: BloomItemProps) {
  return (
    <BloomPrimitive.Item
      data-slot="bloom-item"
      className={cn(
        buttonVariants({ variant }),
        "h-8 w-full cursor-default justify-start px-2",
        className
      )}
      {...props}
    />
  )
}

function BloomSubTrigger({
  className,
  variant = "ghost",
  ...props
}: BloomSubTriggerProps) {
  return (
    <BloomPrimitive.SubMenuTrigger
      data-slot="bloom-sub-trigger"
      className={cn(
        buttonVariants({ variant }),
        "h-8 w-full cursor-default justify-start px-2",
        className
      )}
      {...props}
    />
  )
}

function BloomSubContent({ className, ...props }: BloomSubContentProps) {
  return (
    <BloomPrimitive.SubMenuContent
      data-slot="bloom-sub-content"
      className={cn(
        "-mt-2 rounded-lg bg-popover px-2 pt-4 pb-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
        className
      )}
      {...props}
    />
  )
}

function BloomGroup(props: React.ComponentProps<"div">) {
  return <div data-slot="bloom-group" role="group" {...props} />
}

function BloomLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bloom-label"
      className={cn(
        "px-2 py-1 text-xs font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function BloomSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bloom-separator"
      role="separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function BloomShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="bloom-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

const Bloom = Object.assign(BloomPrimitive.Root, {
  Backdrop: BloomPrimitive.Overlay,
  Container: BloomContainer,
  Content: BloomContent,
  Group: BloomGroup,
  Item: BloomItem,
  Label: BloomLabel,
  Overlay: BloomPrimitive.Overlay,
  Portal: BloomPrimitive.Portal,
  Separator: BloomSeparator,
  Shortcut: BloomShortcut,
  Sub: BloomPrimitive.SubMenu,
  SubContent: BloomSubContent,
  SubTrigger: BloomSubTrigger,
  Trigger: BloomTrigger,
})

export {
  Bloom,
  BloomContainer,
  BloomContent,
  BloomItem,
  BloomSubContent,
  BloomSubTrigger,
  BloomTrigger,
}
