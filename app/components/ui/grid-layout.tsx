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
  type GridResizeDirection,
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

export type GridLayoutResizeAnchorProps = Omit<
  useRender.ComponentProps<"button">,
  "onPointerDown" | "onKeyDown"
> & {
  direction?: GridResizeDirection
}

type ItemConfiguration = GridLayoutItemDefinition &
  GridItemConstraints & {
    label?: string
    locked?: boolean
    resize: GridLayoutResize
  }

type GridLayoutContextValue = GridInteractionContext & {
  editable: boolean
  motionNodes: Map<string, HTMLDivElement>
  nodes: Map<string, HTMLDivElement>
}

type GridLayoutItemContextValue = {
  id: string
  label: string
  locked: boolean
  resize: GridLayoutResize
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
      "GridLayout handles must be rendered inside GridLayout.Item"
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

function containsResizeAnchor(children: ReactNode): boolean {
  let found = false
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || found) return
    if (child.type === GridLayoutResizeAnchor) found = true
    else if (
      child.props &&
      typeof child.props === "object" &&
      "children" in child.props
    ) {
      found = containsResizeAnchor(child.props.children as ReactNode)
    }
  })
  return found
}

const DEFAULT_DRAG_EXCLUSION_SELECTOR = [
  "a",
  "button",
  "input",
  "label",
  "select",
  "textarea",
  "summary",
  '[contenteditable=""]',
  "[contenteditable=true]",
  "[contenteditable=plaintext-only]",
  "[draggable=true]",
  '[tabindex]:not([tabindex="-1"])',
  "[role=button]",
  "[role=checkbox]",
  "[role=combobox]",
  "[role=link]",
  "[role=menuitem]",
  "[role=option]",
  "[role=radio]",
  "[role=slider]",
  "[role=spinbutton]",
  "[role=switch]",
  "[role=tab]",
  "[role=textbox]",
  "[data-grid-layout-no-drag]",
  "[data-slot=grid-layout-resize-anchor]",
].join(",")

function isDefaultDragExcluded(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest(DEFAULT_DRAG_EXCLUSION_SELECTOR) !== null
  )
}

const RESIZE_DIRECTIONS: Record<
  Exclude<GridLayoutResize, false>,
  readonly GridResizeDirection[]
> = {
  both: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
  horizontal: ["e", "w"],
  vertical: ["n", "s"],
}

const RESIZE_DIRECTION_META: Record<
  GridResizeDirection,
  { cursor: string; hitArea: string; label: string }
> = {
  n: {
    cursor: "cursor-n-resize",
    hitArea: "-top-1.5 right-6 left-6 h-3",
    label: "north edge",
  },
  ne: {
    cursor: "cursor-ne-resize",
    hitArea: "-top-1.5 -right-1.5 size-6",
    label: "northeast corner",
  },
  e: {
    cursor: "cursor-e-resize",
    hitArea: "top-6 -right-1.5 bottom-6 w-3",
    label: "east edge",
  },
  se: {
    cursor: "cursor-se-resize",
    hitArea: "-right-1.5 -bottom-1.5 size-6",
    label: "southeast corner",
  },
  s: {
    cursor: "cursor-s-resize",
    hitArea: "right-6 -bottom-1.5 left-6 h-3",
    label: "south edge",
  },
  sw: {
    cursor: "cursor-sw-resize",
    hitArea: "-bottom-1.5 -left-1.5 size-6",
    label: "southwest corner",
  },
  w: {
    cursor: "cursor-w-resize",
    hitArea: "top-6 bottom-6 -left-1.5 w-3",
    label: "west edge",
  },
  nw: {
    cursor: "cursor-nw-resize",
    hitArea: "-top-1.5 -left-1.5 size-6",
    label: "northwest corner",
  },
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

function applyPlacementStyle(
  node: HTMLDivElement,
  item: GridGeometryItem,
  profile: GridLayoutProfile
) {
  const next = placementStyle(item, profile)
  node.style.setProperty("--grid-layout-column", String(item.column))
  node.style.setProperty("--grid-layout-row", String(item.row))
  node.style.setProperty("--grid-layout-width", String(item.width))
  node.style.setProperty("--grid-layout-height", String(item.height))
  node.style.left = String(next.left)
  node.style.top = String(next.top)
  node.style.width = String(next.width)
  node.style.height = String(next.height)
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

function gridSpanPixels(span: number, cell: number, gap: number) {
  return span * cell + Math.max(0, span - 1) * gap
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
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
  const [motionNodes] = useState(() => new Map<string, HTMLDivElement>())
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

  const cancelMotion = useCallback(
    (id: string) => {
      motionAnimations.current.get(id)?.cancel()
      motionAnimations.current.delete(id)
      motionNodes.get(id)?.style.removeProperty("transform")
    },
    [motionNodes]
  )

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
            transform: flipTransform(before, after),
            transformOrigin: "top left",
          },
          {
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
        if (node) applyPlacementStyle(node, item, profile)
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
      if (!pointer) {
        for (const id of motionAnimations.current.keys()) cancelMotion(id)
        applyLayoutStyles(nextLayout)
        visualLayout.current = nextLayout
        return
      }

      const animateReflow = !reducedMotionRequested()
      if (!animateReflow) {
        for (const id of motionAnimations.current.keys()) cancelMotion(id)
      }
      const previous = new Map(
        visualLayout.current.map((item) => [item.id, item])
      )
      const reflowing = animateReflow
        ? nextLayout.filter(
            (item) =>
              item.id !== pointer.itemId &&
              !samePlacement(previous.get(item.id), item)
          )
        : []
      const before = new Map<string, DOMRect>()
      for (const item of reflowing) {
        const node = motionNodes.get(item.id)
        if (node) before.set(item.id, node.getBoundingClientRect())
      }
      for (const item of reflowing) cancelMotion(item.id)
      cancelMotion(pointer.itemId)

      applyLayoutStyles(nextLayout)

      for (const item of reflowing) {
        const node = motionNodes.get(item.id)
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
      const activeMotionNode = motionNodes.get(pointer.itemId)
      const activePlacement = nextLayout.find(
        (item) => item.id === pointer.itemId
      )
      if (activeNode && activeMotionNode && activePlacement) {
        const stepX = pointer.measurement.columnWidth + pointer.measurement.gap
        const stepY = pointer.measurement.rowHeight + pointer.measurement.gap
        const actualColumns = activePlacement.column - pointer.baseItem.column
        const actualRows = activePlacement.row - pointer.baseItem.row

        if (pointer.reason === "resize") {
          const direction = pointer.resizeDirection ?? "se"
          const resize = configuration.get(pointer.itemId)?.resize ?? "both"
          const horizontal = resize !== "vertical"
          const vertical = resize !== "horizontal"
          const west = horizontal && direction.includes("w")
          const east = horizontal && direction.includes("e")
          const north = vertical && direction.includes("n")
          const south = vertical && direction.includes("s")
          const itemConfiguration = configuration.get(pointer.itemId)
          const baseWidth = gridSpanPixels(
            pointer.baseItem.width,
            pointer.measurement.columnWidth,
            pointer.measurement.gap
          )
          const baseHeight = gridSpanPixels(
            pointer.baseItem.height,
            pointer.measurement.rowHeight,
            pointer.measurement.gap
          )
          const minimumWidth = gridSpanPixels(
            itemConfiguration?.minWidth ?? 1,
            pointer.measurement.columnWidth,
            pointer.measurement.gap
          )
          const maximumWidth = gridSpanPixels(
            Math.min(
              itemConfiguration?.maxWidth ?? profile.columns,
              west
                ? pointer.baseItem.column + pointer.baseItem.width
                : profile.columns - pointer.baseItem.column
            ),
            pointer.measurement.columnWidth,
            pointer.measurement.gap
          )
          const minimumHeight = gridSpanPixels(
            itemConfiguration?.minHeight ?? 1,
            pointer.measurement.rowHeight,
            pointer.measurement.gap
          )
          const maximumHeightInRows = Math.min(
            itemConfiguration?.maxHeight ?? Number.POSITIVE_INFINITY,
            north
              ? pointer.baseItem.row + pointer.baseItem.height
              : Number.POSITIVE_INFINITY
          )
          const maximumHeight = Number.isFinite(maximumHeightInRows)
            ? gridSpanPixels(
                maximumHeightInRows,
                pointer.measurement.rowHeight,
                pointer.measurement.gap
              )
            : Number.POSITIVE_INFINITY
          const liveWidth = clamp(
            baseWidth +
              (east ? pointer.pixelDelta.x : west ? -pointer.pixelDelta.x : 0),
            minimumWidth,
            maximumWidth
          )
          const liveHeight = clamp(
            baseHeight +
              (south
                ? pointer.pixelDelta.y
                : north
                  ? -pointer.pixelDelta.y
                  : 0),
            minimumHeight,
            maximumHeight
          )
          if (east || west) {
            activeNode.style.width = `${liveWidth}px`
          }
          if (north || south) {
            activeNode.style.height = `${liveHeight}px`
          }
          const residualX =
            (west ? baseWidth - liveWidth : 0) - actualColumns * stepX
          const residualY =
            (north ? baseHeight - liveHeight : 0) - actualRows * stepY
          if (residualX !== 0 || residualY !== 0) {
            activeMotionNode.style.transform = `translate3d(${residualX}px, ${residualY}px, 0)`
          }
        } else {
          const maximumX =
            (profile.columns -
              pointer.baseItem.width -
              pointer.baseItem.column) *
            stepX
          const clampedX = clamp(
            pointer.pixelDelta.x,
            -pointer.baseItem.column * stepX,
            maximumX
          )
          let residualX = clampedX - actualColumns * stepX
          let residualY =
            Math.max(pointer.pixelDelta.y, -pointer.baseItem.row * stepY) -
            actualRows * stepY
          if (actualColumns !== pointer.gridDelta.columns) {
            residualX = clamp(residualX, -stepX / 2, stepX / 2)
          }
          if (actualRows !== pointer.gridDelta.rows) {
            residualY = clamp(residualY, -stepY / 2, stepY / 2)
          }
          activeMotionNode.style.transform = `translate3d(${residualX}px, ${residualY}px, 0)`
        }
      }
      visualLayout.current = nextLayout
    },
    [
      animateFlip,
      applyLayoutStyles,
      cancelMotion,
      configuration,
      motionNodes,
      nodes,
      profile.columns,
    ]
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
        const node = motionNodes.get(id)
        if (node) before.set(id, node.getBoundingClientRect())
      }
      for (const id of candidates) cancelMotion(id)
      applyLayoutStyles(nextLayout)
      visualLayout.current = nextLayout

      if (reducedMotionRequested()) return
      for (const id of candidates) {
        const node = motionNodes.get(id)
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
    [animateFlip, applyLayoutStyles, cancelMotion, motionNodes]
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
      motionNodes,
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
      motionNodes,
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
  const { id, label, locked } = requireItemContext()
  const interaction = useGridInteraction(grid, id, "move")

  return useRender({
    enabled: grid.editable && !locked,
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

function GridLayoutResizeAnchor({
  direction = "se",
  render,
  className,
  ...props
}: GridLayoutResizeAnchorProps) {
  const grid = requireGridContext()
  const { id, label, locked, resize } = requireItemContext()
  const interaction = useGridInteraction(grid, id, "resize", direction)
  const meta = RESIZE_DIRECTION_META[direction]

  return useRender({
    enabled: grid.editable && !locked && resize !== false,
    defaultTagName: "button",
    render,
    props: {
      type: "button",
      "aria-label": `Resize ${label} from ${meta.label}`,
      "data-slot": "grid-layout-resize-anchor",
      "data-direction": direction,
      className: cn("touch-none select-none", meta.cursor, className),
      ...interaction,
      ...props,
    },
  })
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
  onPointerDown,
  ...props
}: GridLayoutItemProps) {
  const context = requireGridContext()
  const placement = context.layout.find((item) => item.id === id)
  if (!placement) throw new Error(`Unknown Grid Layout item: ${id}`)
  const hasCustomDragHandle = containsDragHandle(children)
  const hasCustomResizeAnchor = containsResizeAnchor(children)
  const defaultDragInteraction = useGridInteraction(context, id, "move")
  const defaultDragEnabled = context.editable && !locked && !hasCustomDragHandle

  return (
    <GridItemContext value={{ id, label, locked, resize }}>
      <div
        ref={(node) => {
          if (node) context.nodes.set(id, node)
          else context.nodes.delete(id)
        }}
        data-slot="grid-layout-positioner"
        data-grid-layout-positioner={id}
        className="absolute"
        style={placementStyle(placement, context.profile)}
      >
        <div
          ref={(node) => {
            if (node) context.motionNodes.set(id, node)
            else context.motionNodes.delete(id)
            if (typeof ref === "function") ref(node)
            else if (ref) ref.current = node
          }}
          data-slot="grid-layout-item"
          data-grid-layout-id={id}
          data-locked={locked ? "" : undefined}
          data-drag-surface={defaultDragEnabled ? "" : undefined}
          className={cn(
            "size-full",
            defaultDragEnabled &&
              "cursor-grab touch-none active:cursor-grabbing",
            className
          )}
          style={style}
          onPointerDown={(event) => {
            onPointerDown?.(event)
            if (
              event.defaultPrevented ||
              !defaultDragEnabled ||
              isDefaultDragExcluded(event.target)
            ) {
              return
            }
            defaultDragInteraction.onPointerDown(event)
          }}
          {...props}
        >
          {children}
          {defaultDragEnabled ? (
            <GridLayoutDragHandle className="pointer-events-none absolute top-1 right-1 z-10 flex size-7 items-center justify-center rounded-md border bg-background/90 text-xs opacity-0 shadow-sm focus:pointer-events-auto focus:opacity-100">
              ⋮⋮
            </GridLayoutDragHandle>
          ) : null}
          {context.editable &&
          !locked &&
          resize !== false &&
          !hasCustomResizeAnchor
            ? RESIZE_DIRECTIONS[resize].map((direction) => (
                <GridLayoutResizeAnchor
                  key={direction}
                  direction={direction}
                  tabIndex={direction === "se" ? 0 : -1}
                  className={cn(
                    "absolute bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    RESIZE_DIRECTION_META[direction].hitArea
                  )}
                />
              ))
            : null}
        </div>
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
  ResizeAnchor: typeof GridLayoutResizeAnchor
}

const GridLayout = Object.assign(
  function GridLayout(props: GridLayoutProps) {
    return <GridLayoutRoot {...props} />
  },
  {
    Static: GridLayoutStatic,
    Item: GridLayoutItem,
    DragHandle: GridLayoutDragHandle,
    ResizeAnchor: GridLayoutResizeAnchor,
  }
) as GridLayoutCompound

export {
  GridLayout,
  type GridResizeDirection,
  type GridLayoutItemDefinition,
  type GridLayoutProfile,
  type GridLayoutValue,
}
