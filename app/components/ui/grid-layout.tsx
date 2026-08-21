"use client"

import { useRender } from "@base-ui/react/use-render"
import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentPropsWithRef,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react"

import { cn } from "@/lib/utils"

import {
  describeGridCommit,
  describeGridPlacement,
} from "./grid-layout/accessibility"
import {
  resolveMove,
  resolveResize,
  type GridCollision,
  type GridGeometryItem,
  type GridItemConstraints,
  type GridPlacement,
} from "./grid-layout/geometry"
import {
  pixelsToGridDelta,
  type GridMeasurement,
} from "./grid-layout/interactions"
import {
  commitProfileLayout,
  reconcileGridLayout,
  resolveProfileLayout,
  type GridLayoutItemDefinition,
  type GridLayoutProfile,
  type GridLayoutValue,
} from "./grid-layout/model"
import {
  DEFAULT_GRID_LAYOUT_PROFILES,
  selectGridLayoutProfile,
} from "./grid-layout/responsive"

type GridInteractionReason = "move" | "resize"

export type GridLayoutChangeDetail = {
  itemId: string
  profile: string
  reason: GridInteractionReason
}

export type GridLayoutResize = "both" | "horizontal" | "vertical" | false

type SharedGridLayoutProps = Omit<
  ComponentPropsWithRef<"div">,
  "defaultValue"
> & {
  children: ReactNode
  layout?: GridLayoutValue
  defaultLayout?: GridLayoutValue
  profiles?: readonly GridLayoutProfile[]
  columns?: never
  rowHeight?: number
  gap?: number
}

export type GridLayoutProps = SharedGridLayoutProps & {
  collision?: GridCollision
  onLayoutChange?: (
    layout: GridLayoutValue,
    detail: GridLayoutChangeDetail
  ) => void
}

export type GridLayoutStaticProps = SharedGridLayoutProps

export type GridLayoutItemProps = Omit<HTMLAttributes<HTMLDivElement>, "id"> &
  GridItemConstraints & {
    id: string
    initial?: Partial<GridPlacement>
    label?: string
    locked?: boolean
    resize?: GridLayoutResize
    ref?: Ref<HTMLDivElement>
  }

export type GridLayoutDragHandleProps = Omit<
  useRender.ComponentProps<"button">,
  "onPointerDown" | "onKeyDown"
>

type ItemConfiguration = GridLayoutItemDefinition &
  GridItemConstraints & {
    label?: string
    locked?: boolean
    resize: GridLayoutResize
  }

type InteractionSession = {
  base: GridGeometryItem[]
  draft: GridGeometryItem[]
  changed: boolean
}

type GridLayoutContextValue = {
  collision: GridCollision
  commit: (
    layout: GridGeometryItem[],
    itemId: string,
    reason: GridInteractionReason
  ) => void
  configuration: Map<string, ItemConfiguration>
  editable: boolean
  layout: GridGeometryItem[]
  measurement: () => GridMeasurement
  nodes: Map<string, HTMLDivElement>
  preview: (layout: GridGeometryItem[]) => void
  profile: GridLayoutProfile
  rowHeight: number
  gap: number
  resetPreview: () => void
  setAnnouncement: (message: string) => void
}

type GridLayoutItemContextValue = {
  id: string
  label: string
}

const GridContext = createContext<GridLayoutContextValue | null>(null)
const GridItemContext = createContext<GridLayoutItemContextValue | null>(null)

function requireGridContext() {
  const context = use(GridContext)
  if (!context)
    throw new Error("Grid Layout parts must be rendered inside GridLayout")
  return context
}

function requireItemContext() {
  const context = use(GridItemContext)
  if (!context)
    throw new Error(
      "GridLayout.DragHandle must be rendered inside GridLayout.Item"
    )
  return context
}

function collectItemConfigurations(children: ReactNode): ItemConfiguration[] {
  const configurations: ItemConfiguration[] = []

  Children.forEach(children, (child) => {
    if (!isValidElement<GridLayoutItemProps>(child)) return
    if (child.type === GridLayoutItem) {
      configurations.push({
        id: child.props.id,
        initial: child.props.initial,
        label: child.props.label,
        locked: child.props.locked,
        resize: child.props.resize ?? "both",
        minWidth: child.props.minWidth,
        maxWidth: child.props.maxWidth,
        minHeight: child.props.minHeight,
        maxHeight: child.props.maxHeight,
      })
      return
    }
    if (child.type === Fragment) {
      configurations.push(...collectItemConfigurations(child.props.children))
    }
  })

  return configurations
}

function containsDragHandle(children: ReactNode): boolean {
  let found = false
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || found) return
    if (child.type === GridLayoutDragHandle) found = true
    else if (
      child.props &&
      typeof child.props === "object" &&
      "children" in child.props
    ) {
      found = containsDragHandle(child.props.children as ReactNode)
    }
  })
  return found
}

function placementStyle(
  item: GridGeometryItem,
  profile: GridLayoutProfile,
  rowHeight: number,
  gap: number
): CSSProperties {
  return {
    "--grid-layout-column": item.column,
    "--grid-layout-row": item.row,
    "--grid-layout-width": item.width,
    "--grid-layout-height": item.height,
    left: `calc(var(--grid-layout-column) * ((100% - ${(profile.columns - 1) * gap}px) / ${profile.columns} + ${gap}px))`,
    top: `calc(var(--grid-layout-row) * (${rowHeight}px + ${gap}px))`,
    width: `calc(var(--grid-layout-width) * ((100% - ${(profile.columns - 1) * gap}px) / ${profile.columns}) + (var(--grid-layout-width) - 1) * ${gap}px)`,
    height: `calc(var(--grid-layout-height) * ${rowHeight}px + (var(--grid-layout-height) - 1) * ${gap}px)`,
  } as CSSProperties
}

function sameLayout(
  left: readonly GridGeometryItem[],
  right: readonly GridGeometryItem[]
) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function GridLayoutRoot({
  children,
  className,
  collision = "push",
  defaultLayout,
  gap = 12,
  layout: controlledLayout,
  onLayoutChange,
  profiles = DEFAULT_GRID_LAYOUT_PROFILES,
  rowHeight = 48,
  style,
  ref,
  ...props
}: GridLayoutProps & { editable?: boolean }) {
  const editable = props.editable ?? true
  const { editable: _editable, ...rootProps } = props
  const configurations = useMemo(
    () => collectItemConfigurations(children),
    [children]
  )
  const definitions = configurations.map(({ id, initial }) => ({ id, initial }))
  const configuration = useMemo(
    () => new Map(configurations.map((item) => [item.id, item])),
    [configurations]
  )
  const [uncontrolledLayout, setUncontrolledLayout] = useState(defaultLayout)
  const value = reconcileGridLayout(
    controlledLayout ?? uncontrolledLayout,
    definitions
  )
  const orderedProfiles = useMemo(
    () => [...profiles].sort((left, right) => left.minWidth - right.minWidth),
    [profiles]
  )
  const [profile, setProfile] = useState<GridLayoutProfile>(orderedProfiles[0])
  const resolved = resolveProfileLayout(value, definitions, profile).map(
    (item) => ({
      ...item,
      ...(configuration.get(item.id)?.locked ? { locked: true } : {}),
    })
  )
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [nodes] = useState(() => new Map<string, HTMLDivElement>())
  const [announcement, setAnnouncement] = useState("")

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      setProfile(
        selectGridLayoutProfile(orderedProfiles, entry.contentRect.width)
      )
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [orderedProfiles])

  const applyPreview = useCallback(
    (nextLayout: GridGeometryItem[]) => {
      for (const item of nextLayout) {
        const node = nodes.get(item.id)
        if (node)
          Object.assign(
            node.style,
            placementStyle(item, profile, rowHeight, gap)
          )
      }
      const bottom = Math.max(
        0,
        ...nextLayout.map((item) => item.row + item.height)
      )
      if (containerRef.current) {
        containerRef.current.style.height = `${bottom * rowHeight + Math.max(0, bottom - 1) * gap}px`
      }
    },
    [gap, nodes, profile, rowHeight]
  )

  const commit = useCallback(
    (
      nextLayout: GridGeometryItem[],
      itemId: string,
      reason: GridInteractionReason
    ) => {
      const nextValue = commitProfileLayout(value, nextLayout, profile)
      if (controlledLayout === undefined) setUncontrolledLayout(nextValue)
      onLayoutChange?.(nextValue, {
        itemId,
        profile: profile.id,
        reason,
      })
    },
    [controlledLayout, onLayoutChange, profile, setUncontrolledLayout, value]
  )

  const context = useMemo<GridLayoutContextValue>(
    () => ({
      collision,
      commit,
      configuration,
      editable,
      layout: resolved,
      measurement: () => {
        const width = containerRef.current?.clientWidth ?? 0
        return {
          columnWidth: (width - gap * (profile.columns - 1)) / profile.columns,
          rowHeight,
          gap,
        }
      },
      nodes,
      preview: applyPreview,
      profile,
      rowHeight,
      gap,
      resetPreview: () => applyPreview(resolved),
      setAnnouncement,
    }),
    [
      applyPreview,
      collision,
      commit,
      configuration,
      editable,
      gap,
      nodes,
      profile,
      resolved,
      rowHeight,
    ]
  )
  const bottom = Math.max(0, ...resolved.map((item) => item.row + item.height))
  const height = bottom * rowHeight + Math.max(0, bottom - 1) * gap

  return (
    <GridContext value={context}>
      <div
        ref={setContainerRef}
        data-slot="grid-layout"
        data-profile={profile.id}
        data-editable={editable ? "" : undefined}
        className={cn("relative w-full", className)}
        style={{ ...style, height }}
        {...rootProps}
      >
        {children}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
      </div>
    </GridContext>
  )
}

function useGridInteraction(id: string, reason: GridInteractionReason) {
  const context = requireGridContext()
  const session = useRef<InteractionSession | null>(null)
  const frame = useRef<number | null>(null)

  const calculate = useCallback(
    (base: GridGeometryItem[], columns: number, rows: number) => {
      const active = base.find((item) => item.id === id)
      if (!active) throw new Error(`Unknown Grid Layout item: ${id}`)
      if (reason === "move") {
        return resolveMove(
          base,
          id,
          {
            column: Math.max(
              0,
              Math.min(
                context.profile.columns - active.width,
                active.column + columns
              )
            ),
            row: Math.max(0, active.row + rows),
          },
          context.profile.columns,
          context.collision
        )
      }

      const configuration = context.configuration.get(id)
      const resize = configuration?.resize ?? "both"
      const constraints = configuration
        ? {
            minWidth: configuration.minWidth,
            maxWidth: configuration.maxWidth,
            minHeight: configuration.minHeight,
            maxHeight: configuration.maxHeight,
          }
        : undefined
      return resolveResize(
        base,
        id,
        {
          width: active.width + (resize === "vertical" ? 0 : columns),
          height: active.height + (resize === "horizontal" ? 0 : rows),
        },
        context.profile.columns,
        context.collision,
        constraints
      )
    },
    [context, id, reason]
  )

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.currentTarget.focus()
      event.preventDefault()
      const start = { x: event.clientX, y: event.clientY }
      const measurement = context.measurement()
      const base = context.layout.map((item) => ({ ...item }))
      session.current = { base, draft: base, changed: false }

      const onMove = (moveEvent: PointerEvent) => {
        const delta = pixelsToGridDelta(
          { x: moveEvent.clientX - start.x, y: moveEvent.clientY - start.y },
          measurement
        )
        const next = calculate(base, delta.columns, delta.rows)
        const current = session.current
        if (!current || sameLayout(current.draft, next)) return
        current.draft = next
        current.changed = !sameLayout(base, next)
        if (frame.current !== null) cancelAnimationFrame(frame.current)
        frame.current = requestAnimationFrame(() => context.preview(next))
      }

      const finish = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", finish)
        window.removeEventListener("pointercancel", cancel)
        if (frame.current !== null) cancelAnimationFrame(frame.current)
        const current = session.current
        session.current = null
        if (current?.changed) context.commit(current.draft, id, reason)
        else context.resetPreview()
      }
      const cancel = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", finish)
        window.removeEventListener("pointercancel", cancel)
        if (frame.current !== null) cancelAnimationFrame(frame.current)
        session.current = null
        context.resetPreview()
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", finish)
      window.addEventListener("pointercancel", cancel)
    },
    [calculate, context, id, reason]
  )

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if ((event.key === "Enter" || event.key === " ") && !session.current) {
        event.preventDefault()
        const base = context.layout.map((item) => ({ ...item }))
        session.current = { base, draft: base, changed: false }
        const active = base.find((item) => item.id === id)
        if (active)
          context.setAnnouncement(
            describeGridPlacement(
              reason === "move" ? "Moving" : "Resizing",
              active
            )
          )
        return
      }
      if (!session.current) return
      if (event.key === "Escape") {
        event.preventDefault()
        session.current = null
        context.resetPreview()
        context.setAnnouncement(`Cancelled ${reason} for ${id}.`)
        return
      }
      if (event.key === "Enter") {
        event.preventDefault()
        const current = session.current
        session.current = null
        if (current.changed) context.commit(current.draft, id, reason)
        const active = current.draft.find((item) => item.id === id)
        if (active)
          context.setAnnouncement(
            describeGridCommit(reason === "move" ? "Moved" : "Resized", active)
          )
        return
      }
      const amount = event.shiftKey ? 5 : 1
      const delta =
        event.key === "ArrowLeft"
          ? [-amount, 0]
          : event.key === "ArrowRight"
            ? [amount, 0]
            : event.key === "ArrowUp"
              ? [0, -amount]
              : event.key === "ArrowDown"
                ? [0, amount]
                : null
      if (!delta) return
      event.preventDefault()
      const current = session.current
      const next = calculate(current.draft, delta[0], delta[1])
      current.draft = next
      current.changed = !sameLayout(current.base, next)
      context.preview(next)
      const active = next.find((item) => item.id === id)
      if (active)
        context.setAnnouncement(
          describeGridPlacement(
            reason === "move" ? "Moving" : "Resizing",
            active
          )
        )
    },
    [calculate, context, id, reason]
  )

  return { onKeyDown, onPointerDown }
}

function GridLayoutDragHandle({
  render,
  className,
  ...props
}: GridLayoutDragHandleProps) {
  const { id, label } = requireItemContext()
  const interaction = useGridInteraction(id, "move")

  return useRender({
    defaultTagName: "button",
    render,
    props: {
      type: "button",
      "aria-label": `Move ${label}`,
      "data-slot": "grid-layout-drag-handle",
      className: cn(
        "cursor-grab touch-none select-none active:cursor-grabbing",
        className
      ),
      ...interaction,
      ...props,
    },
  })
}

function GridLayoutResizeHandle({ id, label }: { id: string; label: string }) {
  const interaction = useGridInteraction(id, "resize")
  return (
    <button
      type="button"
      aria-label={`Resize ${label}`}
      data-slot="grid-layout-resize-handle"
      className="absolute right-1 bottom-1 z-10 flex size-7 cursor-se-resize touch-none items-center justify-center rounded-md border bg-background/90 text-xs shadow-sm select-none"
      {...interaction}
    >
      ↘
    </button>
  )
}

function GridLayoutItem({
  id,
  initial: _initial,
  label = id,
  locked = false,
  resize = "both",
  minWidth: _minWidth,
  maxWidth: _maxWidth,
  minHeight: _minHeight,
  maxHeight: _maxHeight,
  children,
  className,
  style,
  ref,
  ...props
}: GridLayoutItemProps) {
  const context = requireGridContext()
  const placement = context.layout.find((item) => item.id === id)
  if (!placement) throw new Error(`Unknown Grid Layout item: ${id}`)
  const hasCustomDragHandle = containsDragHandle(children)

  return (
    <GridItemContext value={{ id, label }}>
      <div
        ref={(node) => {
          if (node) context.nodes.set(id, node)
          else context.nodes.delete(id)
          if (typeof ref === "function") ref(node)
          else if (ref) ref.current = node
        }}
        data-slot="grid-layout-item"
        data-grid-layout-id={id}
        data-locked={locked ? "" : undefined}
        className={cn("absolute", className)}
        style={{
          ...placementStyle(
            placement,
            context.profile,
            context.rowHeight,
            context.gap
          ),
          ...style,
        }}
        {...props}
      >
        {children}
        {context.editable && !locked && !hasCustomDragHandle ? (
          <GridLayoutDragHandle className="absolute top-1 right-1 z-10 flex size-7 items-center justify-center rounded-md border bg-background/90 text-xs shadow-sm">
            ⋮⋮
          </GridLayoutDragHandle>
        ) : null}
        {context.editable && !locked && resize !== false ? (
          <GridLayoutResizeHandle id={id} label={label} />
        ) : null}
      </div>
    </GridItemContext>
  )
}

function GridLayoutStatic(props: GridLayoutStaticProps) {
  return <GridLayoutRoot {...props} editable={false} />
}

type GridLayoutCompound = ((props: GridLayoutProps) => ReactElement) & {
  Static: typeof GridLayoutStatic
  Item: typeof GridLayoutItem
  DragHandle: typeof GridLayoutDragHandle
}

const GridLayout = Object.assign(
  function GridLayout(props: GridLayoutProps) {
    return <GridLayoutRoot {...props} />
  },
  {
    Static: GridLayoutStatic,
    Item: GridLayoutItem,
    DragHandle: GridLayoutDragHandle,
  }
) as GridLayoutCompound

export {
  GridLayout,
  type GridLayoutItemDefinition,
  type GridLayoutProfile,
  type GridLayoutValue,
}
