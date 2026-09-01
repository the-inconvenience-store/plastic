import {
  getAllCollisions,
  getLayoutItem,
  horizontalCompactor,
  moveElement,
  noCompactor,
  verticalCompactor,
  type Compactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout/core"
import { wrapCompactor } from "react-grid-layout/extras"

export type GridPlacement = {
  column: number
  row: number
  width: number
  height: number
}

export type GridGeometryItem = GridPlacement & {
  id: string
  static?: boolean
  layer?: number
}

export type GridCollision = "push" | "block" | "overlap"
export type GridCompactionName = "vertical" | "horizontal" | "wrap" | "none"
export type GridCompactionContext = { columns: number; maxRows?: number }
export type GridCompactor = (
  items: readonly GridGeometryItem[],
  context: GridCompactionContext
) => readonly GridGeometryItem[]
export type GridCompaction = GridCompactionName | GridCompactor

export type GridConstraintOperation =
  "place" | "move" | "resize" | "drop" | "profile"
export type GridConstraintContext = GridCompactionContext & {
  item: Readonly<GridGeometryItem>
  previous: Readonly<GridPlacement>
  layout: readonly Readonly<GridGeometryItem>[]
  operation: GridConstraintOperation
  direction?: GridResizeDirection
  columnPixels?: number
  rowPixels?: number
  visibleRows?: number
}
export type GridConstraint = (
  placement: Readonly<GridPlacement>,
  context: Readonly<GridConstraintContext>
) => GridPlacement

export type GridResizeDirection =
  "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw"

export type GridItemConstraints = {
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function resizePlacementFromDirection(
  item: GridPlacement,
  direction: GridResizeDirection,
  delta: { columns: number; rows: number },
  columns: number,
  constraints: GridItemConstraints = {}
): GridPlacement {
  validateGridItemConstraints(constraints)
  const west = direction.includes("w")
  const east = direction.includes("e")
  const north = direction.includes("n")
  const south = direction.includes("s")
  const minimumWidth = Math.min(columns, constraints.minWidth ?? 1)
  const maximumWidth = Math.min(
    constraints.maxWidth ?? columns,
    west ? item.column + item.width : columns - item.column
  )
  const minimumHeight = constraints.minHeight ?? 1
  const maximumHeight = north
    ? Math.min(
        constraints.maxHeight ?? item.row + item.height,
        item.row + item.height
      )
    : (constraints.maxHeight ?? Number.POSITIVE_INFINITY)
  let widthDelta = 0
  if (east) widthDelta = delta.columns
  else if (west) widthDelta = -delta.columns
  let heightDelta = 0
  if (south) heightDelta = delta.rows
  else if (north) heightDelta = -delta.rows
  const width = clamp(item.width + widthDelta, minimumWidth, maximumWidth)
  const height = clamp(item.height + heightDelta, minimumHeight, maximumHeight)

  return {
    column: west ? item.column + item.width - width : item.column,
    row: north ? item.row + item.height - height : item.row,
    width,
    height,
  }
}

export function validateGridItemConstraints(constraints: GridItemConstraints) {
  for (const [name, value] of [
    ["minWidth", constraints.minWidth],
    ["maxWidth", constraints.maxWidth],
    ["minHeight", constraints.minHeight],
    ["maxHeight", constraints.maxHeight],
  ] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
      throw new Error(`Grid Layout ${name} must be a positive integer`)
    }
  }
  if (
    constraints.minWidth !== undefined &&
    constraints.maxWidth !== undefined &&
    constraints.minWidth > constraints.maxWidth
  ) {
    throw new Error("Grid Layout minWidth cannot exceed maxWidth")
  }
  if (
    constraints.minHeight !== undefined &&
    constraints.maxHeight !== undefined &&
    constraints.minHeight > constraints.maxHeight
  ) {
    throw new Error("Grid Layout minHeight cannot exceed maxHeight")
  }
}

export function constrainPlacement(
  placement: GridPlacement,
  columns: number,
  constraints: GridItemConstraints = {}
): GridPlacement {
  validateGridItemConstraints(constraints)
  const minimumWidth = Math.min(columns, constraints.minWidth ?? 1)
  const maximumWidth = Math.min(columns, constraints.maxWidth ?? columns)
  const width = Math.min(maximumWidth, Math.max(minimumWidth, placement.width))
  const height = Math.min(
    constraints.maxHeight ?? Number.POSITIVE_INFINITY,
    Math.max(constraints.minHeight ?? 1, placement.height)
  )

  return {
    column: Math.min(columns - width, Math.max(0, placement.column)),
    row: Math.max(0, placement.row),
    width,
    height,
  }
}

function toLayout(items: readonly GridGeometryItem[]): Layout {
  return items.map((item) => ({
    i: item.id,
    x: item.column,
    y: item.row,
    w: item.width,
    h: item.height,
    static: item.static,
  }))
}

function fromLayoutItem(
  item: LayoutItem,
  source?: ReadonlyMap<string, GridGeometryItem>
): GridGeometryItem {
  const original = source?.get(item.i)
  return {
    id: item.i,
    column: item.x,
    row: item.y,
    width: item.w,
    height: item.h,
    ...(item.static ? { static: true } : {}),
    ...(original?.layer !== undefined ? { layer: original.layer } : {}),
  }
}

const RGL_COMPACTORS: Record<GridCompactionName, Compactor> = {
  vertical: verticalCompactor,
  horizontal: horizontalCompactor,
  wrap: wrapCompactor,
  none: noCompactor,
}

function validateGeometryItems(
  items: readonly GridGeometryItem[],
  context: GridCompactionContext,
  expected?: readonly GridGeometryItem[]
) {
  const ids = new Set<string>()
  for (const item of items) {
    if (ids.has(item.id))
      throw new Error(`Duplicate Grid Layout item id: "${item.id}"`)
    ids.add(item.id)
    for (const [key, minimum] of [
      ["column", 0],
      ["row", 0],
      ["width", 1],
      ["height", 1],
    ] as const) {
      if (!Number.isInteger(item[key]) || item[key] < minimum) {
        throw new Error(`Grid Layout ${item.id}.${key} is invalid`)
      }
    }
    if (item.column + item.width > context.columns) {
      throw new Error(`Grid Layout item "${item.id}" exceeds the column bound`)
    }
    if (
      context.maxRows !== undefined &&
      item.row + item.height > context.maxRows
    ) {
      throw new Error(`Grid Layout item "${item.id}" exceeds maxRows`)
    }
    const previous = expected?.find((candidate) => candidate.id === item.id)
    if (previous?.static && !sameGeometry(previous, item)) {
      throw new Error(`Grid Layout compactor moved static item "${item.id}"`)
    }
  }
  if (
    expected &&
    (items.length !== expected.length ||
      expected.some(({ id }) => !ids.has(id)))
  ) {
    throw new Error(
      "Grid Layout compactor must preserve every item exactly once"
    )
  }
}

function sameGeometry(left: GridPlacement, right: GridPlacement) {
  return (
    left.column === right.column &&
    left.row === right.row &&
    left.width === right.width &&
    left.height === right.height
  )
}

export function compactGridLayout(
  items: readonly GridGeometryItem[],
  compaction: GridCompaction = "vertical",
  context: GridCompactionContext
): GridGeometryItem[] {
  if (typeof compaction === "function") {
    const frozenInput = items.map((item) => Object.freeze({ ...item }))
    const result = compaction(frozenInput, context).map((item) => ({ ...item }))
    validateGeometryItems(result, context, items)
    return result
  }
  const source = new Map(items.map((item) => [item.id, item]))
  const result = RGL_COMPACTORS[compaction]
    .compact(toLayout(items), context.columns)
    .map((item) => fromLayoutItem(item, source))
  validateGeometryItems(result, context, items)
  return result
}

export function compactLayout(
  items: readonly GridGeometryItem[],
  columns: number
) {
  return compactGridLayout(items, "vertical", { columns })
}

export function getGridCollisions(
  items: readonly GridGeometryItem[],
  item: GridGeometryItem
) {
  const source = new Map(items.map((candidate) => [candidate.id, candidate]))
  return getAllCollisions(toLayout(items), toLayout([item])[0]).map(
    (candidate) => fromLayoutItem(candidate, source)
  )
}

export function applyGridConstraints(
  placement: GridPlacement,
  constraints: readonly GridConstraint[],
  context: GridConstraintContext
) {
  let result = { ...placement }
  constraints.forEach((constraint, index) => {
    result = constraint(Object.freeze({ ...result }), context)
    if (
      !result ||
      (["column", "row", "width", "height"] as const).some(
        (key) => !Number.isFinite(result[key])
      )
    ) {
      throw new Error(
        `Grid Layout constraint ${index} returned invalid geometry`
      )
    }
  })
  result = {
    column: Math.round(result.column),
    row: Math.round(result.row),
    width: Math.max(1, Math.round(result.width)),
    height: Math.max(1, Math.round(result.height)),
  }
  result.width = Math.min(context.columns, result.width)
  result.column = clamp(result.column, 0, context.columns - result.width)
  result.row = Math.max(0, result.row)
  if (context.maxRows !== undefined) {
    result.height = Math.min(result.height, context.maxRows)
    result.row = Math.min(result.row, context.maxRows - result.height)
  }
  return result
}

function positiveStep(value: number | undefined, name: string) {
  const result = value ?? 1
  if (!Number.isInteger(result) || result < 1)
    throw new Error(`Grid Layout ${name} must be a positive integer`)
  return result
}

export const gridConstraints = {
  bounds(): GridConstraint {
    return (placement) => ({ ...placement })
  },
  container(): GridConstraint {
    return (placement, context) => {
      if (context.visibleRows === undefined) return { ...placement }
      const height = Math.min(placement.height, context.visibleRows)
      return {
        ...placement,
        height,
        row: clamp(placement.row, 0, context.visibleRows - height),
      }
    }
  },
  axis(options: {
    columns?: readonly [number, number]
    rows?: readonly [number, number]
  }): GridConstraint {
    return (placement) => ({
      ...placement,
      column: options.columns
        ? clamp(placement.column, ...options.columns)
        : placement.column,
      row: options.rows ? clamp(placement.row, ...options.rows) : placement.row,
    })
  },
  aspectRatio(ratio: number): GridConstraint {
    if (!Number.isFinite(ratio) || ratio <= 0)
      throw new Error("Grid Layout aspect ratio must be positive")
    return (placement, context) => ({
      ...placement,
      height: Math.max(
        1,
        Math.round(
          (placement.width * (context.columnPixels ?? 1)) /
            ratio /
            (context.rowPixels ?? 1)
        )
      ),
    })
  },
  size(options: GridItemConstraints): GridConstraint {
    validateGridItemConstraints(options)
    return (placement, context) =>
      constrainPlacement(placement, context.columns, options)
  },
  snap(options: { columns?: number; rows?: number }): GridConstraint {
    const columns = positiveStep(options.columns, "column snap")
    const rows = positiveStep(options.rows, "row snap")
    return (placement) => ({
      ...placement,
      column: Math.round(placement.column / columns) * columns,
      row: Math.round(placement.row / rows) * rows,
    })
  },
}

export function projectPlacement(
  placement: GridPlacement,
  sourceColumns: number,
  targetColumns: number
): GridPlacement {
  const width = Math.max(
    1,
    Math.min(
      targetColumns,
      Math.round((placement.width / sourceColumns) * targetColumns)
    )
  )
  const column = Math.min(
    targetColumns - width,
    Math.max(0, Math.round((placement.column / sourceColumns) * targetColumns))
  )

  return {
    column,
    row: placement.row,
    width,
    height: placement.height,
  }
}

export function resolveMove(
  items: readonly GridGeometryItem[],
  itemId: string,
  position: Pick<GridPlacement, "column" | "row">,
  columns: number,
  collision: GridCollision,
  compaction: GridCompaction = "vertical",
  maxRows?: number
): GridGeometryItem[] {
  const layout = toLayout(items)
  const item = getLayoutItem(layout, itemId)
  if (!item) throw new Error(`Unknown Grid Layout item: ${itemId}`)
  if (item.static) return items.map((current) => ({ ...current }))

  if (collision === "overlap") {
    return items.map((current) =>
      current.id === itemId
        ? { ...current, column: position.column, row: position.row }
        : { ...current }
    )
  }

  const moved = moveElement(
    layout,
    item,
    position.column,
    position.row,
    true,
    collision === "block",
    "vertical",
    columns,
    false
  )

  const source = new Map(items.map((current) => [current.id, current]))
  try {
    return compactGridLayout(
      moved.map((current) => fromLayoutItem(current, source)),
      compaction,
      { columns, maxRows }
    )
  } catch (error) {
    if (
      maxRows !== undefined &&
      error instanceof Error &&
      error.message.includes("maxRows")
    ) {
      return items.map((current) => ({ ...current }))
    }
    throw error
  }
}

export function resolveResize(
  items: readonly GridGeometryItem[],
  itemId: string,
  placement: Pick<GridPlacement, "width" | "height"> &
    Partial<Pick<GridPlacement, "column" | "row">>,
  columns: number,
  collision: GridCollision,
  constraints: GridItemConstraints = {},
  compaction: GridCompaction = "vertical",
  maxRows?: number
): GridGeometryItem[] {
  const layout = toLayout(items)
  const item = getLayoutItem(layout, itemId)
  if (!item) throw new Error(`Unknown Grid Layout item: ${itemId}`)
  if (item.static) return items.map((current) => ({ ...current }))

  const constrained = constrainPlacement(
    {
      column: placement.column ?? item.x,
      row: placement.row ?? item.y,
      width: placement.width,
      height: placement.height,
    },
    columns,
    constraints
  )
  const width = Math.min(constrained.width, columns - constrained.column)
  const height = constrained.height
  const proposed = layout.map((layoutItem) =>
    layoutItem.i === itemId
      ? {
          ...layoutItem,
          x: constrained.column,
          y: constrained.row,
          w: width,
          h: height,
        }
      : layoutItem
  )
  const activeItem = getLayoutItem(proposed, itemId)
  if (!activeItem) throw new Error(`Unknown Grid Layout item: ${itemId}`)

  const collisions = getAllCollisions(proposed, activeItem)

  if (collision === "overlap") {
    const source = new Map(items.map((current) => [current.id, current]))
    return proposed.map((current) => fromLayoutItem(current, source))
  }

  if (collision === "block" && collisions.length > 0) {
    return items.map((current) => ({ ...current }))
  }

  const hitsStaticItem = collisions.some(
    (collisionItem) => collisionItem.static
  )
  const resized = hitsStaticItem
    ? proposed
    : proposed.map((layoutItem) =>
        layoutItem.i === itemId
          ? {
              ...layoutItem,
              // Compaction is useful for displaced dynamic items, but the
              // pointer owns the active item's exact north/west origin unless
              // a static obstacle must move the active item out of collision.
              static: true,
            }
          : layoutItem
      )

  const source = new Map(items.map((current) => [current.id, current]))
  let compacted: GridGeometryItem[]
  try {
    compacted = compactGridLayout(
      resized.map((current) => fromLayoutItem(current, source)),
      compaction,
      { columns, maxRows }
    )
  } catch (error) {
    if (
      maxRows !== undefined &&
      error instanceof Error &&
      error.message.includes("maxRows")
    ) {
      return items.map((current) => ({ ...current }))
    }
    throw error
  }
  return compacted.map((current) => {
    if (current.id !== itemId || item.static) return current
    const { static: _static, ...dynamicItem } = current
    return dynamicItem
  })
}
