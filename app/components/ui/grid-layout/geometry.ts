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

export type GridItemConstraints = {
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
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
  size: Pick<GridPlacement, "width" | "height">,
  columns: number,
  collision: GridCollision,
  constraints: GridItemConstraints = {}
): GridGeometryItem[] {
  for (const [name, value] of Object.entries(constraints)) {
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
  if ((constraints.minWidth ?? 1) > columns) {
    throw new Error(
      "Grid Layout minWidth cannot exceed the active profile columns"
    )
  }

  const layout = toLayout(items)
  const item = getLayoutItem(layout, itemId)
  if (!item) throw new Error(`Unknown Grid Layout item: ${itemId}`)

  const width = Math.min(
    constraints.maxWidth ?? columns,
    Math.max(constraints.minWidth ?? 1, size.width),
    columns - item.x
  )
  const height = Math.min(
    constraints.maxHeight ?? Number.POSITIVE_INFINITY,
    Math.max(constraints.minHeight ?? 1, size.height)
  )
  const resized = layout.map((layoutItem) =>
    layoutItem.i === itemId
      ? { ...layoutItem, w: width, h: height }
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

  return verticalCompactor.compact(resized, columns).map(fromLayoutItem)
}
