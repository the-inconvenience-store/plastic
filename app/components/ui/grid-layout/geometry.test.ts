import { describe, expect, it } from "vitest"
import fc from "fast-check"

import {
  applyGridConstraints,
  compactGridLayout,
  gridConstraints,
  getGridCollisions,
  projectPlacement,
  resizePlacementFromDirection,
  resolveMove,
  resolveResize,
} from "./geometry"

describe("Grid Layout geometry", () => {
  it("supports every compaction policy through one headless operation", () => {
    const items = [
      { id: "a", column: 2, row: 2, width: 2, height: 1 },
      { id: "fixed", column: 0, row: 1, width: 2, height: 1, static: true },
    ]

    expect(compactGridLayout(items, "none", { columns: 4 })).toStrictEqual(
      items
    )
    expect(
      compactGridLayout(items, "vertical", { columns: 4 })[1]
    ).toStrictEqual(items[1])
    expect(
      compactGridLayout(items, "horizontal", { columns: 4 })[1]
    ).toStrictEqual(items[1])
    expect(compactGridLayout(items, "wrap", { columns: 4 })).toHaveLength(2)
  })

  it("composes custom constraints and reapplies hard bounds", () => {
    const item = { id: "chart", column: 0, row: 0, width: 2, height: 2 }
    const result = applyGridConstraints(
      { column: 3, row: 7, width: 3, height: 2 },
      [gridConstraints.snap({ columns: 2, rows: 3 })],
      {
        item,
        previous: item,
        layout: [item],
        columns: 4,
        maxRows: 6,
        operation: "move",
      }
    )
    expect(result).toStrictEqual({ column: 1, row: 4, width: 3, height: 2 })
  })

  it("reports overlap without mutating geometry", () => {
    const items = [
      { id: "a", column: 0, row: 0, width: 2, height: 2, layer: 2 },
      { id: "b", column: 1, row: 1, width: 2, height: 2 },
    ]
    expect(
      getGridCollisions(items, items[0]).map((item) => item.id)
    ).toStrictEqual(["b"])
    expect(items[0].layer).toBe(2)
  })

  it("supports visible bounds and pixel-aware aspect ratios", () => {
    const item = { id: "video", column: 0, row: 0, width: 4, height: 1 }
    expect(
      applyGridConstraints(
        { ...item, row: 8 },
        [gridConstraints.aspectRatio(2), gridConstraints.container()],
        {
          item,
          previous: item,
          layout: [item],
          columns: 12,
          visibleRows: 5,
          columnPixels: 100,
          rowPixels: 50,
          operation: "resize",
        }
      )
    ).toStrictEqual({ column: 0, row: 1, width: 4, height: 4 })
  })
  it("projects canonical placements into narrower container profiles", () => {
    const canonical = {
      column: 8,
      row: 2,
      width: 4,
      height: 3,
    }

    expect(projectPlacement(canonical, 12, 6)).toStrictEqual({
      column: 4,
      row: 2,
      width: 2,
      height: 3,
    })

    expect(projectPlacement(canonical, 12, 1)).toStrictEqual({
      column: 0,
      row: 2,
      width: 1,
      height: 3,
    })
  })

  it("always projects integral placements inside the target columns", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 24 }),
        fc.integer({ min: 1, max: 24 }),
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 1, max: 24 }),
        (sourceColumns, targetColumns, rawColumn, rawWidth) => {
          const width = Math.min(rawWidth, sourceColumns)
          const column = Math.min(rawColumn, sourceColumns - width)
          const result = projectPlacement(
            { column, row: 0, width, height: 1 },
            sourceColumns,
            targetColumns
          )

          expect(Number.isInteger(result.column)).toBe(true)
          expect(Number.isInteger(result.width)).toBe(true)
          expect(result.column).toBeGreaterThanOrEqual(0)
          expect(result.column + result.width).toBeLessThanOrEqual(
            targetColumns
          )
        }
      )
    )
  })

  it("pushes collisions or blocks the move without mutating the input", () => {
    const items = [
      { id: "revenue", column: 0, row: 0, width: 2, height: 2 },
      { id: "orders", column: 2, row: 0, width: 2, height: 2 },
    ] as const

    const pushed = resolveMove(
      items,
      "revenue",
      { column: 2, row: 0 },
      4,
      "push"
    )
    expect(pushed).toStrictEqual([
      { id: "revenue", column: 2, row: 0, width: 2, height: 2 },
      { id: "orders", column: 2, row: 2, width: 2, height: 2 },
    ])

    const blocked = resolveMove(
      items,
      "revenue",
      { column: 2, row: 0 },
      4,
      "block"
    )
    expect(blocked).toStrictEqual(items)
    expect(items[0]).toStrictEqual({
      id: "revenue",
      column: 0,
      row: 0,
      width: 2,
      height: 2,
    })
  })

  it("keeps static items fixed while dynamic items resolve around them", () => {
    const items = [
      { id: "moving", column: 0, row: 0, width: 2, height: 2 },
      {
        id: "fixed",
        column: 2,
        row: 0,
        width: 2,
        height: 2,
        static: true,
      },
    ] as const

    expect(
      resolveMove(items, "fixed", { column: 0, row: 2 }, 4, "push")
    ).toStrictEqual(items)
    expect(
      resolveMove(items, "moving", { column: 2, row: 0 }, 4, "push")
    ).toStrictEqual([
      { id: "moving", column: 2, row: 2, width: 2, height: 2 },
      {
        id: "fixed",
        column: 2,
        row: 0,
        width: 2,
        height: 2,
        static: true,
      },
    ])
    expect(
      resolveResize(items, "moving", { width: 4, height: 2 }, 4, "push")
    ).toStrictEqual([
      { id: "moving", column: 0, row: 2, width: 4, height: 2 },
      {
        id: "fixed",
        column: 2,
        row: 0,
        width: 2,
        height: 2,
        static: true,
      },
    ])
  })

  it("resizes within item constraints and pushes collisions", () => {
    const items = [
      { id: "revenue", column: 0, row: 0, width: 2, height: 2 },
      { id: "orders", column: 2, row: 0, width: 2, height: 2 },
    ] as const

    expect(
      resolveResize(items, "revenue", { width: 5, height: 1 }, 4, "push", {
        minHeight: 2,
      })
    ).toStrictEqual([
      { id: "revenue", column: 0, row: 0, width: 4, height: 2 },
      { id: "orders", column: 2, row: 2, width: 2, height: 2 },
    ])

    expect(
      resolveResize(items, "revenue", { width: 4, height: 2 }, 4, "block")
    ).toStrictEqual(items)
  })

  it("keeps the opposite edges fixed for directional resizing", () => {
    const placement = { column: 2, row: 3, width: 4, height: 3 }

    expect(
      resizePlacementFromDirection(
        placement,
        "nw",
        { columns: -2, rows: -1 },
        12
      )
    ).toStrictEqual({ column: 0, row: 2, width: 6, height: 4 })
    expect(
      resizePlacementFromDirection(placement, "se", { columns: 2, rows: 1 }, 12)
    ).toStrictEqual({ column: 2, row: 3, width: 6, height: 4 })
  })

  it("applies a west resize origin to the resolved layout", () => {
    expect(
      resolveResize(
        [{ id: "revenue", column: 2, row: 0, width: 2, height: 2 }],
        "revenue",
        { column: 1, row: 0, width: 3, height: 2 },
        6,
        "push"
      )
    ).toStrictEqual([{ id: "revenue", column: 1, row: 0, width: 3, height: 2 }])
  })

  it("does not compact away a north resize origin", () => {
    expect(
      resolveResize(
        [
          { id: "header", column: 0, row: 0, width: 2, height: 2 },
          { id: "revenue", column: 0, row: 3, width: 2, height: 3 },
        ],
        "revenue",
        { column: 0, row: 4, width: 2, height: 2 },
        6,
        "push"
      )
    ).toStrictEqual([
      { id: "header", column: 0, row: 0, width: 2, height: 2 },
      { id: "revenue", column: 0, row: 4, width: 2, height: 2 },
    ])
  })

  it("rejects impossible resize constraints", () => {
    expect(() =>
      resolveResize(
        [{ id: "revenue", column: 0, row: 0, width: 2, height: 2 }],
        "revenue",
        { width: 3, height: 2 },
        6,
        "push",
        { minWidth: 4, maxWidth: 2 }
      )
    ).toThrow("Grid Layout minWidth cannot exceed maxWidth")
  })
})
