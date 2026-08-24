import { useCallback, useState } from "react"

import {
  applyGridConstraints,
  compactGridLayout,
  getGridCollisions,
  resolveMove,
  resolveResize,
  type GridCollision,
  type GridCompaction,
  type GridConstraint,
  type GridGeometryItem,
  type GridPlacement,
  type GridResizeDirection,
} from "./geometry"

export type GridLayoutEngineOptions = {
  columns: number
  maxRows?: number
  visibleRows?: number
  collision?: GridCollision
  compaction?: GridCompaction
  constraints?: readonly GridConstraint[]
}

export type GridLayoutEngineAction =
  | { type: "move"; itemId: string; column: number; row: number }
  | {
      type: "resize"
      itemId: string
      placement: GridPlacement
      direction?: GridResizeDirection
    }
  | { type: "drop"; item: GridGeometryItem }
  | { type: "remove"; itemId: string }
  | { type: "compact" }

export type GridLayoutTransition = {
  items: GridGeometryItem[]
  active: GridGeometryItem | null
  collisions: GridGeometryItem[]
  changed: boolean
}

function sameItems(
  left: readonly GridGeometryItem[],
  right: readonly GridGeometryItem[]
) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function createGridLayoutEngine(options: GridLayoutEngineOptions) {
  const collision = options.collision ?? "push"
  const compaction = options.compaction ?? "vertical"
  const constraints = options.constraints ?? []
  const context = { columns: options.columns, maxRows: options.maxRows }

  function transition(
    input: readonly GridGeometryItem[],
    action: GridLayoutEngineAction
  ): GridLayoutTransition {
    const items = input.map((item) => ({ ...item }))
    let next: GridGeometryItem[]
    let activeId: string | null = null

    if (action.type === "remove") {
      next = compactGridLayout(
        items.filter(({ id }) => id !== action.itemId),
        compaction,
        context
      )
    } else if (action.type === "compact") {
      next = compactGridLayout(items, compaction, context)
    } else if (action.type === "drop") {
      if (items.some(({ id }) => id === action.item.id))
        throw new Error(`Duplicate Grid Layout item id: "${action.item.id}"`)
      const placement = applyGridConstraints(action.item, constraints, {
        ...context,
        item: action.item,
        previous: action.item,
        layout: items,
        operation: "drop",
        visibleRows: options.visibleRows,
      })
      const appended = [...items, { ...action.item, ...placement }]
      activeId = action.item.id
      next = resolveMove(
        appended,
        activeId,
        placement,
        options.columns,
        collision,
        compaction,
        options.maxRows
      )
    } else {
      activeId = action.itemId
      const active = items.find(({ id }) => id === action.itemId)
      if (!active) throw new Error(`Unknown Grid Layout item: ${action.itemId}`)
      const placement = applyGridConstraints(
        action.type === "move"
          ? { ...active, column: action.column, row: action.row }
          : action.placement,
        constraints,
        {
          ...context,
          item: active,
          previous: active,
          layout: items,
          operation: action.type,
          direction: action.type === "resize" ? action.direction : undefined,
          visibleRows: options.visibleRows,
        }
      )
      next =
        action.type === "move"
          ? resolveMove(
              items,
              activeId,
              placement,
              options.columns,
              collision,
              compaction,
              options.maxRows
            )
          : resolveResize(
              items,
              activeId,
              placement,
              options.columns,
              collision,
              {},
              compaction,
              options.maxRows
            )
    }

    const active = activeId
      ? (next.find(({ id }) => id === activeId) ?? null)
      : null
    return {
      items: next,
      active,
      collisions: active ? getGridCollisions(next, active) : [],
      changed: !sameItems(input, next),
    }
  }

  return {
    transition,
    compact: (items: readonly GridGeometryItem[]) =>
      compactGridLayout(items, compaction, context),
    collisions: getGridCollisions,
  }
}

export function useGridLayoutEngine(
  initialItems: readonly GridGeometryItem[],
  options: GridLayoutEngineOptions
) {
  const [items, setItems] = useState(() =>
    initialItems.map((item) => ({ ...item }))
  )
  const dispatch = useCallback(
    (action: GridLayoutEngineAction) => {
      let result: GridLayoutTransition | undefined
      setItems((current) => {
        result = createGridLayoutEngine(options).transition(current, action)
        return result.items
      })
      return result
    },
    [options]
  )
  return { items, dispatch }
}
