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
  useImperativeHandle,
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
  type GridCompaction,
  type GridCompactionName,
  type GridConstraint,
  type GridGeometryItem,
  type GridItemConstraints,
  type GridPlacement,
  type GridResizeDirection,
  applyGridConstraints,
  compactGridLayout,
  getGridCollisions,
  gridConstraints,
  projectPlacement,
  resolveMove,
} from "./grid-layout/geometry"
import {
  getGridFlipTransform,
  parseGridPixelLength,
  useGridInteraction,
  type GridInteractionContext,
  type GridInteractionDetail,
  type GridInteractionReason,
  type GridPointerPreview,
} from "./grid-layout/interactions"
import {
  commitProfileLayout,
  replaceProfileLayout,
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
import {
  createGridLayoutEngine,
  useGridLayoutEngine,
  type GridLayoutEngineAction,
  type GridLayoutEngineOptions,
  type GridLayoutTransition,
} from "./grid-layout/engine"

export type GridLayoutChangeDetail = {
  itemId: string
  profile: string
  reason: GridInteractionReason | "replace"
}

export type GridLayoutController = {
  getLayout: () => GridLayoutValue
  replaceProfile: (
    profile: string,
    placements: Readonly<Record<string, GridPlacement>>
  ) => void
}

export type GridLayoutResize = "both" | "horizontal" | "vertical" | false
export type GridSpacing = number | { x: number; y: number }
export type GridLayoutViewport = {
  rowHeight?: number
  gap?: GridSpacing
  padding?: GridSpacing
  maxRows?: number
  height?: "content" | number
  scale?: "auto" | number | { x: number; y: number }
}
export type GridLayoutDragOptions = {
  threshold?: number
  handle?: string
  cancel?: string
}
export type GridLayoutDropItem<Data = unknown> = {
  id: string
  width?: number
  height?: number
  data?: Data
}
export type GridLayoutDropOptions<Data = unknown> = {
  accept?: string | readonly string[]
  item: (event: DragEvent) => GridLayoutDropItem<Data> | null
  onDrop: (detail: {
    item: GridLayoutDropItem<Data>
    placement: GridPlacement
    profile: string
    nativeEvent: DragEvent
  }) => void
}

type SharedGridLayoutProps = Omit<
  ComponentPropsWithRef<"div">,
  "defaultValue"
> & {
  children: ReactNode
  layout?: GridLayoutValue
  defaultLayout?: GridLayoutValue
  profiles?: readonly GridLayoutProfile[]
  rowHeight?: number
  gap?: GridSpacing
  viewport?: GridLayoutViewport
  profile?: string
  defaultProfile?: string
  onProfileChange?: (
    profile: GridLayoutProfile,
    detail: { width: number }
  ) => void
  onWidthChange?: (
    width: number,
    detail: { profile: GridLayoutProfile }
  ) => void
}

export type GridLayoutProps = SharedGridLayoutProps & {
  controllerRef?: Ref<GridLayoutController>
  collision?: GridCollision
  compaction?: GridCompaction
  constraints?: readonly GridConstraint[]
  drag?: GridLayoutDragOptions | false
  drop?: GridLayoutDropOptions
  onInteraction?: (detail: GridInteractionDetail) => void
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
    /** Prevents this item from being dragged, resized, or moved by compaction. */
    static?: boolean
    draggable?: boolean
    resize?: GridLayoutResize
    layer?: number
    constraints?: readonly GridConstraint[]
    dragThreshold?: number
    dragHandle?: string
    dragCancel?: string
    ref?: Ref<HTMLDivElement>
  }

export type GridLayoutEngineItem = GridGeometryItem

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
    static?: boolean
    draggable: boolean
    layer?: number
    constraints?: readonly GridConstraint[]
    dragThreshold?: number
    dragHandle?: string
    dragCancel?: string
    resize: GridLayoutResize
  }

type GridLayoutContextValue = GridInteractionContext & {
  editable: boolean
  dragEnabled: boolean
  dragHandle?: string
  dragCancel?: string
  motionNodes: Map<string, HTMLDivElement>
  nodes: Map<string, HTMLDivElement>
}

type GridLayoutItemContextValue = {
  id: string
  label: string
  static: boolean
  draggable: boolean
  resize: GridLayoutResize
}

const GridContext = createContext<GridLayoutContextValue | null>(null)
const GridItemContext = createContext<GridLayoutItemContextValue | null>(null)

function useGridContext() {
  const context = use(GridContext)
  if (!context)
    throw new Error("Grid Layout parts must be rendered inside GridLayout")
  return context
}

function useItemContext() {
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
        static: child.props.static,
        draggable: child.props.draggable ?? true,
        layer: child.props.layer,
        constraints: child.props.constraints,
        dragThreshold: child.props.dragThreshold,
        dragHandle: child.props.dragHandle,
        dragCancel: child.props.dragCancel,
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
    left: `calc(var(--grid-layout-padding-x) + var(--grid-layout-column) * ((100% - 2 * var(--grid-layout-padding-x) - ${gutters} * var(--grid-layout-gap-x)) / ${profile.columns} + var(--grid-layout-gap-x)))`,
    top: `calc(var(--grid-layout-padding-y) + var(--grid-layout-row) * (var(--grid-layout-row-height) + var(--grid-layout-gap-y)))`,
    width: `calc(var(--grid-layout-width) * ((100% - 2 * var(--grid-layout-padding-x) - ${gutters} * var(--grid-layout-gap-x)) / ${profile.columns}) + (var(--grid-layout-width) - 1) * var(--grid-layout-gap-x))`,
    height: `calc(var(--grid-layout-height) * var(--grid-layout-row-height) + (var(--grid-layout-height) - 1) * var(--grid-layout-gap-y))`,
  } as CSSProperties
}

function normalizeSpacing(value: GridSpacing | undefined, fallback: number) {
  if (typeof value === "number") return { x: value, y: value }
  return value ?? { x: fallback, y: fallback }
}

function validateGridLayoutConfiguration(
  profiles: readonly GridLayoutProfile[],
  viewport: GridLayoutViewport | undefined,
  rowHeight: number,
  gap: GridSpacing
) {
  if (profiles.length === 0)
    throw new Error("Grid Layout requires at least one profile")
  const ids = new Set<string>()
  for (const profile of profiles) {
    if (!profile.id || ids.has(profile.id))
      throw new Error(`Duplicate Grid Layout profile id: "${profile.id}"`)
    ids.add(profile.id)
    if (!Number.isInteger(profile.columns) || profile.columns < 1)
      throw new Error(
        `Grid Layout profile "${profile.id}" columns must be positive`
      )
    if (!Number.isFinite(profile.minWidth) || profile.minWidth < 0)
      throw new Error(
        `Grid Layout profile "${profile.id}" minWidth must be non-negative`
      )
  }
  const height = viewport?.rowHeight ?? rowHeight
  if (!Number.isFinite(height) || height <= 0)
    throw new Error("Grid Layout rowHeight must be positive")
  for (const [name, spacing] of [
    ["gap", viewport?.gap ?? gap],
    ["padding", viewport?.padding ?? 0],
  ] as const) {
    const value = normalizeSpacing(spacing, 0)
    if (![value.x, value.y].every((part) => Number.isFinite(part) && part >= 0))
      throw new Error(`Grid Layout ${name} must be non-negative`)
  }
  if (
    viewport?.maxRows !== undefined &&
    (!Number.isInteger(viewport.maxRows) || viewport.maxRows < 1)
  )
    throw new Error("Grid Layout maxRows must be a positive integer")
  const scale = viewport?.scale
  if (scale !== undefined && scale !== "auto") {
    const value = typeof scale === "number" ? { x: scale, y: scale } : scale
    if (![value.x, value.y].every((part) => Number.isFinite(part) && part > 0))
      throw new Error("Grid Layout scale must be positive")
  }
}

function matchesScopedSelector(
  target: EventTarget | null,
  item: Element,
  selector?: string
) {
  if (!selector || !(target instanceof Element)) return false
  try {
    const match = target.closest(selector)
    return match !== null && item.contains(match)
  } catch {
    throw new Error(
      `Grid Layout configuration contains an invalid selector: ${selector}`
    )
  }
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
  compaction = "vertical",
  constraints = [],
  controllerRef,
  drag = {},
  defaultLayout,
  defaultProfile,
  drop,
  gap = 12,
  layout: controlledLayout,
  onInteraction,
  onLayoutChange,
  onProfileChange,
  onWidthChange,
  profile: controlledProfile,
  profiles = DEFAULT_GRID_LAYOUT_PROFILES,
  rowHeight = 48,
  viewport,
  style,
  ref,
  ...props
}: GridLayoutProps & { editable?: boolean }) {
  validateGridLayoutConfiguration(profiles, viewport, rowHeight, gap)
  const editable = props.editable ?? true
  const { editable: _editable, ...rootProps } = props
  const configurations = useMemo(
    () => collectItemConfigurations(children),
    [children]
  )
  const definitions = configurations.map(
    ({
      id,
      initial,
      static: staticItem,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight,
    }) => ({
      id,
      initial,
      static: staticItem,
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
  const initialProfile =
    orderedProfiles.find(({ id }) => id === defaultProfile) ??
    orderedProfiles[0]
  const [uncontrolledProfile, setUncontrolledProfile] =
    useState<GridLayoutProfile>(initialProfile)
  const profile = controlledProfile
    ? orderedProfiles.find(({ id }) => id === controlledProfile)
    : uncontrolledProfile
  if (!profile)
    throw new Error(`Unknown Grid Layout profile: ${controlledProfile}`)
  const activeCompaction = profile.compaction ?? compaction
  const activeGap = normalizeSpacing(profile.gap ?? viewport?.gap ?? gap, 12)
  const activePadding = normalizeSpacing(
    profile.padding ?? viewport?.padding,
    0
  )
  const activeRowHeight = profile.rowHeight ?? viewport?.rowHeight ?? rowHeight
  const activeMaxRows = profile.maxRows ?? viewport?.maxRows
  const activeVisibleRows =
    typeof viewport?.height === "number"
      ? Math.max(
          1,
          Math.floor(
            (viewport.height - activePadding.y * 2 + activeGap.y) /
              (activeRowHeight + activeGap.y)
          )
        )
      : undefined
  const resolved = resolveProfileLayout(
    value,
    definitions,
    profile,
    activeCompaction
  )
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [nodes] = useState(() => new Map<string, HTMLDivElement>())
  const [motionNodes] = useState(() => new Map<string, HTMLDivElement>())
  const [announcement, setAnnouncement] = useState("")
  const observedWidth = useRef<number | null>(null)
  const observedProfile = useRef(profile.id)
  const [dropPreview, setDropPreview] = useState<{
    item: GridLayoutDropItem
    placement: GridGeometryItem
    layout: GridGeometryItem[]
  } | null>(null)

  useImperativeHandle(
    controllerRef,
    () => ({
      getLayout: () => value,
      replaceProfile: (profileId, placements) => {
        const target = orderedProfiles.find(({ id }) => id === profileId)
        if (!target)
          throw new Error(`Unknown Grid Layout profile: ${profileId}`)
        const next = replaceProfileLayout(value, target, placements)
        if (controlledLayout === undefined) setUncontrolledLayout(next)
        onLayoutChange?.(next, {
          itemId: "*",
          profile: profileId,
          reason: "replace",
        })
      },
    }),
    [controlledLayout, onLayoutChange, orderedProfiles, value]
  )
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
      const width = entry.contentRect.width
      const selected = controlledProfile
        ? profile
        : selectGridLayoutProfile(orderedProfiles, width)
      if (observedWidth.current !== width) {
        observedWidth.current = width
        onWidthChange?.(width, { profile: selected })
      }
      if (selected.id !== observedProfile.current) {
        observedProfile.current = selected.id
        if (!controlledProfile) setUncontrolledProfile(selected)
        onProfileChange?.(selected, { width })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [
    controlledProfile,
    onProfileChange,
    onWidthChange,
    orderedProfiles,
    profile,
  ])

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
        if (viewport?.height === undefined || viewport.height === "content") {
          containerRef.current.style.height = `calc(2 * var(--grid-layout-padding-y) + ${bottom} * var(--grid-layout-row-height) + ${Math.max(0, bottom - 1)} * var(--grid-layout-gap-y))`
        }
      }
    },
    [nodes, profile, viewport]
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
        const stepX = pointer.measurement.columnWidth + pointer.measurement.gapX
        const stepY = pointer.measurement.rowHeight + pointer.measurement.gapY
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
            pointer.measurement.gapX
          )
          const baseHeight = gridSpanPixels(
            pointer.baseItem.height,
            pointer.measurement.rowHeight,
            pointer.measurement.gapX
          )
          const minimumWidth = gridSpanPixels(
            itemConfiguration?.minWidth ?? 1,
            pointer.measurement.columnWidth,
            pointer.measurement.gapX
          )
          const maximumWidth = gridSpanPixels(
            Math.min(
              itemConfiguration?.maxWidth ?? profile.columns,
              west
                ? pointer.baseItem.column + pointer.baseItem.width
                : profile.columns - pointer.baseItem.column
            ),
            pointer.measurement.columnWidth,
            pointer.measurement.gapX
          )
          const minimumHeight = gridSpanPixels(
            itemConfiguration?.minHeight ?? 1,
            pointer.measurement.rowHeight,
            pointer.measurement.gapY
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
                pointer.measurement.gapY
              )
            : Number.POSITIVE_INFINITY
          let liveWidthDelta = 0
          if (east) liveWidthDelta = pointer.pixelDelta.x
          else if (west) liveWidthDelta = -pointer.pixelDelta.x
          let liveHeightDelta = 0
          if (south) liveHeightDelta = pointer.pixelDelta.y
          else if (north) liveHeightDelta = -pointer.pixelDelta.y
          const liveWidth = clamp(
            baseWidth + liveWidthDelta,
            minimumWidth,
            maximumWidth
          )
          const liveHeight = clamp(
            baseHeight + liveHeightDelta,
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
      compaction: activeCompaction,
      constraints,
      maxRows: activeMaxRows,
      visibleRows: activeVisibleRows,
      dragThreshold:
        drag === false ? Number.POSITIVE_INFINITY : (drag.threshold ?? 3),
      onInteraction,
      commit,
      configuration,
      editable,
      dragEnabled: drag !== false,
      dragHandle: drag === false ? undefined : drag.handle,
      dragCancel: drag === false ? undefined : drag.cancel,
      layout: resolved,
      measurement: () => {
        const container = containerRef.current
        const width = Math.max(
          0,
          (container?.clientWidth ?? 0) - activePadding.x * 2
        )
        const computed = container ? getComputedStyle(container) : null
        const gapValue = computed?.getPropertyValue("--grid-layout-gap")
        const rowHeightValue = computed?.getPropertyValue(
          "--grid-layout-row-height"
        )
        const computedGapX = gapValue
          ? parseGridPixelLength(gapValue, "--grid-layout-gap")
          : activeGap.x
        const computedRowHeight = rowHeightValue
          ? parseGridPixelLength(rowHeightValue, "--grid-layout-row-height")
          : activeRowHeight
        const explicitScale = viewport?.scale
        const rect = container?.getBoundingClientRect()
        const automaticScale = {
          x:
            container?.offsetWidth && rect
              ? rect.width / container.offsetWidth
              : 1,
          y:
            container?.offsetHeight && rect
              ? rect.height / container.offsetHeight
              : 1,
        }
        let scale = automaticScale
        if (typeof explicitScale === "number") {
          scale = { x: explicitScale, y: explicitScale }
        } else if (explicitScale && explicitScale !== "auto") {
          scale = explicitScale
        }
        return {
          columnWidth:
            (width - computedGapX * (profile.columns - 1)) / profile.columns,
          rowHeight: computedRowHeight,
          gapX: computedGapX,
          gapY: activeGap.y,
          scaleX: scale.x || 1,
          scaleY: scale.y || 1,
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
      activeCompaction,
      activeGap,
      activeMaxRows,
      activePadding.x,
      activeRowHeight,
      activeVisibleRows,
      constraints,
      drag,
      motionNodes,
      nodes,
      profile,
      resolved,
      onInteraction,
      viewport?.scale,
      settlePreview,
    ]
  )
  const bottom = Math.max(0, ...resolved.map((item) => item.row + item.height))
  const contentHeight = `calc(2 * var(--grid-layout-padding-y) + ${bottom} * var(--grid-layout-row-height) + ${Math.max(0, bottom - 1)} * var(--grid-layout-gap-y))`
  const height =
    typeof viewport?.height === "number"
      ? `${viewport.height}px`
      : contentHeight

  const readDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!drop) return null
    const accepted =
      drop.accept === undefined
        ? true
        : (typeof drop.accept === "string" ? [drop.accept] : drop.accept).some(
            (type) => event.dataTransfer.types.includes(type)
          )
    const item = accepted ? drop.item(event.nativeEvent) : null
    if (item && resolved.some(({ id }) => id === item.id)) {
      throw new Error(`Duplicate Grid Layout item id: "${item.id}"`)
    }
    return item
  }

  const updateDropPreview = (event: React.DragEvent<HTMLDivElement>) => {
    const candidate = readDrop(event)
    if (!candidate) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const measurement = context.measurement()
    const proposed = applyGridConstraints(
      {
        column: Math.round(
          (event.clientX - rect.left - activePadding.x) /
            measurement.scaleX /
            (measurement.columnWidth + measurement.gapX)
        ),
        row: Math.round(
          (event.clientY - rect.top - activePadding.y) /
            measurement.scaleY /
            (measurement.rowHeight + measurement.gapY)
        ),
        width: candidate.width ?? 1,
        height: candidate.height ?? 1,
      },
      constraints,
      {
        item: {
          id: candidate.id,
          column: 0,
          row: 0,
          width: candidate.width ?? 1,
          height: candidate.height ?? 1,
        },
        previous: {
          column: 0,
          row: 0,
          width: candidate.width ?? 1,
          height: candidate.height ?? 1,
        },
        layout: resolved,
        columns: profile.columns,
        maxRows: activeMaxRows,
        operation: "drop",
        visibleRows: activeVisibleRows,
      }
    )
    const withCandidate = [...resolved, { id: candidate.id, ...proposed }]
    const next = resolveMove(
      withCandidate,
      candidate.id,
      proposed,
      profile.columns,
      collision,
      activeCompaction,
      activeMaxRows
    )
    const placement = next.find((item) => item.id === candidate.id)
    if (placement) {
      const phase = dropPreview ? "change" : "start"
      onInteraction?.({
        phase,
        reason: "drop",
        itemId: candidate.id,
        profile: profile.id,
        initial: dropPreview?.placement ?? placement,
        placement,
        layout: next,
        nativeEvent: event.nativeEvent,
      })
      setDropPreview({ item: candidate, placement, layout: next })
    }
  }

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
            "--grid-layout-row-height": `${activeRowHeight}px`,
            "--grid-layout-gap": `${activeGap.x}px`,
            "--grid-layout-gap-x": `${activeGap.x}px`,
            "--grid-layout-gap-y": `${activeGap.y}px`,
            "--grid-layout-padding-x": `${activePadding.x}px`,
            "--grid-layout-padding-y": `${activePadding.y}px`,
            ...style,
            height,
          } as CSSProperties
        }
        {...rootProps}
        onDragOver={(event) => {
          rootProps.onDragOver?.(event)
          if (!event.defaultPrevented) updateDropPreview(event)
        }}
        onDragLeave={(event) => {
          rootProps.onDragLeave?.(event)
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            if (dropPreview)
              onInteraction?.({
                phase: "cancel",
                reason: "drop",
                itemId: dropPreview.item.id,
                profile: profile.id,
                initial: dropPreview.placement,
                placement: dropPreview.placement,
                layout: dropPreview.layout,
                nativeEvent: event.nativeEvent,
              })
            setDropPreview(null)
          }
        }}
        onDrop={(event) => {
          rootProps.onDrop?.(event)
          if (!dropPreview || !drop) return
          event.preventDefault()
          drop.onDrop({
            item: dropPreview.item,
            placement: dropPreview.placement,
            profile: profile.id,
            nativeEvent: event.nativeEvent,
          })
          onInteraction?.({
            phase: "end",
            reason: "drop",
            itemId: dropPreview.item.id,
            profile: profile.id,
            initial: dropPreview.placement,
            placement: dropPreview.placement,
            layout: dropPreview.layout,
            nativeEvent: event.nativeEvent,
          })
          setDropPreview(null)
        }}
      >
        {children}
        {dropPreview ? (
          <div
            aria-hidden="true"
            data-slot="grid-layout-drop-placeholder"
            className="pointer-events-none absolute rounded-md border-2 border-dashed border-primary/50 bg-primary/10"
            style={placementStyle(dropPreview.placement, profile)}
          />
        ) : null}
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
  const grid = useGridContext()
  const { id, label, static: staticItem, draggable } = useItemContext()
  const interaction = useGridInteraction(grid, id, "move")

  return useRender({
    enabled: grid.editable && grid.dragEnabled && !staticItem && draggable,
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
  const grid = useGridContext()
  const { id, label, static: staticItem, resize } = useItemContext()
  const interaction = useGridInteraction(grid, id, "resize", direction)
  const meta = RESIZE_DIRECTION_META[direction]

  return useRender({
    enabled: grid.editable && !staticItem && resize !== false,
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
  static: staticProp = false,
  draggable = true,
  resize = "both",
  layer,
  constraints: _constraints,
  dragThreshold: _dragThreshold,
  dragHandle,
  dragCancel,
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
  const context = useGridContext()
  const placement = context.layout.find((item) => item.id === id)
  if (!placement) throw new Error(`Unknown Grid Layout item: ${id}`)
  const hasCustomDragHandle = containsDragHandle(children)
  const hasCustomResizeAnchor = containsResizeAnchor(children)
  const defaultDragInteraction = useGridInteraction(context, id, "move")
  const defaultDragEnabled =
    context.editable &&
    context.dragEnabled &&
    !staticProp &&
    draggable &&
    !hasCustomDragHandle
  const activeDragHandle = dragHandle ?? context.dragHandle
  const activeDragCancel = dragCancel ?? context.dragCancel

  return (
    <GridItemContext
      value={{ id, label, static: staticProp, draggable, resize }}
    >
      <div
        ref={(node) => {
          if (node) context.nodes.set(id, node)
          else context.nodes.delete(id)
        }}
        data-slot="grid-layout-positioner"
        data-grid-layout-positioner={id}
        className="absolute"
        style={{ ...placementStyle(placement, context.profile), zIndex: layer }}
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
          data-static={staticProp ? "" : undefined}
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
              isDefaultDragExcluded(event.target) ||
              matchesScopedSelector(
                event.target,
                event.currentTarget,
                activeDragCancel
              ) ||
              (activeDragHandle !== undefined &&
                !matchesScopedSelector(
                  event.target,
                  event.currentTarget,
                  activeDragHandle
                ))
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
          !staticProp &&
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

const gridLayout = {
  create: createGridLayoutEngine,
  compact: compactGridLayout,
  collisions: getGridCollisions,
  constrain: applyGridConstraints,
  project: projectPlacement,
  replaceProfile: replaceProfileLayout,
  constraints: gridConstraints,
}

export {
  GridLayout,
  gridLayout,
  useGridLayoutEngine,
  type GridResizeDirection,
  type GridLayoutItemDefinition,
  type GridLayoutProfile,
  type GridLayoutValue,
  type GridLayoutEngineAction,
  type GridLayoutEngineOptions,
  type GridLayoutTransition,
  type GridInteractionDetail,
  type GridCollision,
  type GridCompaction,
  type GridCompactionName,
  type GridConstraint,
  type GridPlacement,
}
