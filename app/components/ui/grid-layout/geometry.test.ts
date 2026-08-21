import { describe, expect, it } from "vitest"
import fc from "fast-check"

import { projectPlacement, resolveMove, resolveResize } from "./geometry"

describe("Grid Layout geometry", () => {
  it("projects canonical placements into narrower container profiles", () => {
    const canonical = {
      column: 8,
      row: 2,
      width: 4,
      height: 3,
    }

    expect(projectPlacement(canonical, 12, 6)).toEqual({
      column: 4,
      row: 2,
      width: 2,
      height: 3,
    })

    expect(projectPlacement(canonical, 12, 1)).toEqual({
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
    expect(pushed).toEqual([
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
    expect(blocked).toEqual(items)
    expect(items[0]).toEqual({
      id: "revenue",
      column: 0,
      row: 0,
      width: 2,
      height: 2,
    })
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
    ).toEqual([
      { id: "revenue", column: 0, row: 0, width: 4, height: 2 },
      { id: "orders", column: 2, row: 2, width: 2, height: 2 },
    ])

    expect(
      resolveResize(items, "revenue", { width: 4, height: 2 }, 4, "block")
    ).toEqual(items)
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
