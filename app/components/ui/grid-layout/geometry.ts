import {
  getAllCollisions,
  getLayoutItem,
  moveElement,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout/core"

export type GridPlacement = {
  column: number
  row: number
  width: number
  height: number
}

export type GridGeometryItem = GridPlacement & {
  id: string
  locked?: boolean
}

export type GridCollision = "push" | "block"

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
  const width = clamp(
    item.width + (east ? delta.columns : west ? -delta.columns : 0),
    minimumWidth,
    maximumWidth
  )
  const height = clamp(
    item.height + (south ? delta.rows : north ? -delta.rows : 0),
    minimumHeight,
    maximumHeight
  )

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
    static: item.locked,
  }))
}

function fromLayoutItem(item: LayoutItem): GridGeometryItem {
  return {
    id: item.i,
    column: item.x,
    row: item.y,
    width: item.w,
    height: item.h,
    ...(item.static ? { locked: true } : {}),
  }
}

export function compactLayout(
  items: readonly GridGeometryItem[],
  columns: number
): GridGeometryItem[] {
  return verticalCompactor.compact(toLayout(items), columns).map(fromLayoutItem)
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
  collision: GridCollision
): GridGeometryItem[] {
  const layout = toLayout(items)
  const item = getLayoutItem(layout, itemId)
  if (!item) throw new Error(`Unknown Grid Layout item: ${itemId}`)

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

  return verticalCompactor.compact(moved, columns).map(fromLayoutItem)
}

export function resolveResize(
  items: readonly GridGeometryItem[],
  itemId: string,
  placement: Pick<GridPlacement, "width" | "height"> &
    Partial<Pick<GridPlacement, "column" | "row">>,
  columns: number,
  collision: GridCollision,
  constraints: GridItemConstraints = {}
): GridGeometryItem[] {
  const layout = toLayout(items)
  const item = getLayoutItem(layout, itemId)
  if (!item) throw new Error(`Unknown Grid Layout item: ${itemId}`)

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
  const resized = layout.map((layoutItem) =>
    layoutItem.i === itemId
      ? {
          ...layoutItem,
          x: constrained.column,
          y: constrained.row,
          w: width,
          h: height,
          // Compaction is useful for the displaced items, but the pointer owns
          // the active item's exact origin for north and west resizing.
          static: true,
        }
      : layoutItem
  )
  const activeItem = getLayoutItem(resized, itemId)
  if (!activeItem) throw new Error(`Unknown Grid Layout item: ${itemId}`)

  if (
    collision === "block" &&
    getAllCollisions(resized, activeItem).length > 0
  ) {
    return items.map((current) => ({ ...current }))
  }

  return verticalCompactor
    .compact(resized, columns)
    .map(fromLayoutItem)
    .map((current) => {
      if (current.id !== itemId || item.static) return current
      const { locked: _locked, ...unlocked } = current
      return unlocked
    })
}
