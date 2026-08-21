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
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react"

import { cn } from "@/lib/utils"

import {
  type GridCollision,
  type GridGeometryItem,
  type GridItemConstraints,
  type GridPlacement,
} from "./grid-layout/geometry"
import {
  getGridFlipTransform,
  parseGridPixelLength,
  useGridInteraction,
  type GridInteractionContext,
  type GridInteractionReason,
  type GridPointerPreview,
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

type GridLayoutContextValue = GridInteractionContext & {
  editable: boolean
  nodes: Map<string, HTMLDivElement>
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
  profile: GridLayoutProfile
): CSSProperties {
  const gutters = profile.columns - 1
  return {
    "--grid-layout-column": item.column,
    "--grid-layout-row": item.row,
    "--grid-layout-width": item.width,
    "--grid-layout-height": item.height,
    left: `calc(var(--grid-layout-column) * ((100% - ${gutters} * var(--grid-layout-gap)) / ${profile.columns} + var(--grid-layout-gap)))`,
    top: `calc(var(--grid-layout-row) * (var(--grid-layout-row-height) + var(--grid-layout-gap)))`,
    width: `calc(var(--grid-layout-width) * ((100% - ${gutters} * var(--grid-layout-gap)) / ${profile.columns}) + (var(--grid-layout-width) - 1) * var(--grid-layout-gap))`,
    height: `calc(var(--grid-layout-height) * var(--grid-layout-row-height) + (var(--grid-layout-height) - 1) * var(--grid-layout-gap))`,
  } as CSSProperties
}

const GRID_LAYOUT_MOTION = {
  duration: 180,
  reflowEasing: "cubic-bezier(0.77, 0, 0.175, 1)",
  settleEasing: "cubic-bezier(0.23, 1, 0.32, 1)",
} as const

function samePlacement(left?: GridGeometryItem, right?: GridGeometryItem) {
  return (
    left?.column === right?.column &&
    left?.row === right?.row &&
    left?.width === right?.width &&
    left?.height === right?.height
  )
}

function flipTransform(before: DOMRect, after: DOMRect) {
  const { scaleX, scaleY, x, y } = getGridFlipTransform(before, after)
  return `translate3d(${x}px, ${y}px, 0) scale(${scaleX}, ${scaleY})`
}

function hasVisibleFlip(before: DOMRect, after: DOMRect) {
  const flip = getGridFlipTransform(before, after)
  return (
    Math.abs(flip.x) > 0.5 ||
    Math.abs(flip.y) > 0.5 ||
    Math.abs(flip.scaleX - 1) > 0.005 ||
    Math.abs(flip.scaleY - 1) > 0.005
  )
}

function reducedMotionRequested() {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  )
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
  const definitions = configurations.map(
    ({ id, initial, locked, minWidth, maxWidth, minHeight, maxHeight }) => ({
      id,
      initial,
      locked,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight,
    })
  )
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
  const resolved = resolveProfileLayout(value, definitions, profile)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [nodes] = useState(() => new Map<string, HTMLDivElement>())
  const [announcement, setAnnouncement] = useState("")
  const visualLayout = useRef(resolved)
  const motionAnimations = useRef(new Map<string, Animation>())

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

  useEffect(() => {
    visualLayout.current = resolved
  }, [resolved])

  useEffect(
    () => () => {
      for (const animation of motionAnimations.current.values()) {
        animation.cancel()
      }
      motionAnimations.current.clear()
    },
    []
  )

  const cancelMotion = useCallback((id: string) => {
    motionAnimations.current.get(id)?.cancel()
    motionAnimations.current.delete(id)
  }, [])

  const animateFlip = useCallback(
    (
      id: string,
      node: HTMLDivElement,
      before: DOMRect,
      after: DOMRect,
      easing: string
    ) => {
      if (!hasVisibleFlip(before, after)) return
      const animation = node.animate(
        [
          {
            composite: "add",
            transform: flipTransform(before, after),
            transformOrigin: "top left",
          },
          {
            composite: "add",
            transform: "none",
            transformOrigin: "top left",
          },
        ],
        {
          duration: GRID_LAYOUT_MOTION.duration,
          easing,
        }
      )
      motionAnimations.current.set(id, animation)
      animation.onfinish = () => {
        if (motionAnimations.current.get(id) !== animation) return
        animation.cancel()
        motionAnimations.current.delete(id)
      }
    },
    []
  )

  const applyLayoutStyles = useCallback(
    (nextLayout: GridGeometryItem[]) => {
      for (const item of nextLayout) {
        const node = nodes.get(item.id)
        if (node) Object.assign(node.style, placementStyle(item, profile))
      }
      const bottom = Math.max(
        0,
        ...nextLayout.map((item) => item.row + item.height)
      )
      if (containerRef.current) {
        containerRef.current.style.height = `calc(${bottom} * var(--grid-layout-row-height) + ${Math.max(0, bottom - 1)} * var(--grid-layout-gap))`
      }
    },
    [nodes, profile]
  )

  const applyPreview = useCallback(
    (nextLayout: GridGeometryItem[], pointer?: GridPointerPreview) => {
      if (!pointer || reducedMotionRequested()) {
        for (const id of motionAnimations.current.keys()) cancelMotion(id)
        applyLayoutStyles(nextLayout)
        visualLayout.current = nextLayout
        return
      }

      const previous = new Map(
        visualLayout.current.map((item) => [item.id, item])
      )
      const reflowing = nextLayout.filter(
        (item) =>
          item.id !== pointer.itemId &&
          !samePlacement(previous.get(item.id), item)
      )
      const before = new Map<string, DOMRect>()
      for (const item of reflowing) {
        const node = nodes.get(item.id)
        if (node) before.set(item.id, node.getBoundingClientRect())
      }
      for (const item of reflowing) cancelMotion(item.id)
      cancelMotion(pointer.itemId)

      applyLayoutStyles(nextLayout)

      for (const item of reflowing) {
        const node = nodes.get(item.id)
        const previousRect = before.get(item.id)
        if (node && previousRect) {
          animateFlip(
            item.id,
            node,
            previousRect,
            node.getBoundingClientRect(),
            GRID_LAYOUT_MOTION.reflowEasing
          )
        }
      }

      const activeNode = nodes.get(pointer.itemId)
      if (activeNode) {
        const stepX = pointer.measurement.columnWidth + pointer.measurement.gap
        const stepY = pointer.measurement.rowHeight + pointer.measurement.gap
        let residualX = pointer.pixelDelta.x - pointer.gridDelta.columns * stepX
        let residualY = pointer.pixelDelta.y - pointer.gridDelta.rows * stepY
        let transform = `translate3d(${residualX}px, ${residualY}px, 0)`

        if (pointer.reason === "resize") {
          const resize = configuration.get(pointer.itemId)?.resize ?? "both"
          if (resize === "vertical") residualX = 0
          if (resize === "horizontal") residualY = 0
          const rect = activeNode.getBoundingClientRect()
          const scaleX = Math.max(0.01, (rect.width + residualX) / rect.width)
          const scaleY = Math.max(0.01, (rect.height + residualY) / rect.height)
          transform = `scale(${scaleX}, ${scaleY})`
        }

        const animation = activeNode.animate(
          [
            {
              composite: "add",
              transform,
              transformOrigin: "top left",
            },
            {
              composite: "add",
              transform,
              transformOrigin: "top left",
            },
          ],
          { duration: 1, fill: "forwards" }
        )
        motionAnimations.current.set(pointer.itemId, animation)
      }
      visualLayout.current = nextLayout
    },
    [animateFlip, applyLayoutStyles, cancelMotion, configuration, nodes]
  )

  const settlePreview = useCallback(
    (nextLayout: GridGeometryItem[], itemId: string) => {
      const previous = new Map(
        visualLayout.current.map((item) => [item.id, item])
      )
      const candidates = new Set(
        nextLayout
          .filter((item) => !samePlacement(previous.get(item.id), item))
          .map((item) => item.id)
      )
      candidates.add(itemId)
      for (const id of motionAnimations.current.keys()) candidates.add(id)

      const before = new Map<string, DOMRect>()
      for (const id of candidates) {
        const node = nodes.get(id)
        if (node) before.set(id, node.getBoundingClientRect())
      }
      for (const id of candidates) cancelMotion(id)
      applyLayoutStyles(nextLayout)
      visualLayout.current = nextLayout

      if (reducedMotionRequested()) return
      for (const id of candidates) {
        const node = nodes.get(id)
        const previousRect = before.get(id)
        if (node && previousRect) {
          animateFlip(
            id,
            node,
            previousRect,
            node.getBoundingClientRect(),
            GRID_LAYOUT_MOTION.settleEasing
          )
        }
      }
    },
    [animateFlip, applyLayoutStyles, cancelMotion, nodes]
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
        const container = containerRef.current
        const width = container?.clientWidth ?? 0
        const computed = container ? getComputedStyle(container) : null
        const gapValue = computed?.getPropertyValue("--grid-layout-gap")
        const rowHeightValue = computed?.getPropertyValue(
          "--grid-layout-row-height"
        )
        const activeGap = gapValue
          ? parseGridPixelLength(gapValue, "--grid-layout-gap")
          : gap
        const activeRowHeight = rowHeightValue
          ? parseGridPixelLength(rowHeightValue, "--grid-layout-row-height")
          : rowHeight
        return {
          columnWidth:
            (width - activeGap * (profile.columns - 1)) / profile.columns,
          rowHeight: activeRowHeight,
          gap: activeGap,
        }
      },
      nodes,
      preview: applyPreview,
      profile,
      resetPreview: () => applyPreview(resolved),
      settlePreview,
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
      settlePreview,
    ]
  )
  const bottom = Math.max(0, ...resolved.map((item) => item.row + item.height))
  const height = `calc(${bottom} * var(--grid-layout-row-height) + ${Math.max(0, bottom - 1)} * var(--grid-layout-gap))`

  return (
    <GridContext value={context}>
      <div
        ref={setContainerRef}
        data-slot="grid-layout"
        data-profile={profile.id}
        data-editable={editable ? "" : undefined}
        className={cn("relative w-full", className)}
        style={
          {
            "--grid-layout-row-height": `${rowHeight}px`,
            "--grid-layout-gap": `${gap}px`,
            ...style,
            height,
          } as CSSProperties
        }
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

function GridLayoutDragHandle({
  render,
  className,
  ...props
}: GridLayoutDragHandleProps) {
  const grid = requireGridContext()
  const { id, label } = requireItemContext()
  const interaction = useGridInteraction(grid, id, "move")

  return useRender({
    enabled: grid.editable,
    defaultTagName: "button",
    render,
    props: {
      type: "button",
      "aria-label": `Move ${label}`,
      "data-slot": "grid-layout-drag-handle",
      className: cn(
        "cursor-grab touch-none transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] select-none active:scale-[0.96] active:cursor-grabbing motion-reduce:transition-none motion-reduce:active:scale-100",
        className
      ),
      ...interaction,
      ...props,
    },
  })
}

function GridLayoutResizeHandle({ id, label }: { id: string; label: string }) {
  const grid = requireGridContext()
  const interaction = useGridInteraction(grid, id, "resize")
  return (
    <button
      type="button"
      aria-label={`Resize ${label}`}
      data-slot="grid-layout-resize-handle"
      className="absolute right-1 bottom-1 z-10 flex size-7 cursor-se-resize touch-none items-center justify-center rounded-md border bg-background/90 text-xs shadow-sm transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] select-none active:scale-[0.92] motion-reduce:transition-none motion-reduce:active:scale-100"
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
          ...placementStyle(placement, context.profile),
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
