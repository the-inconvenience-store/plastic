import { describe, expect, it } from "vitest"

import {
  commitProfileLayout,
  reconcileGridLayout,
  resolveProfileLayout,
} from "./model"

describe("Grid Layout persistence", () => {
  it("auto-places new items and preserves temporarily hidden items", () => {
    const saved = {
      version: 1 as const,
      items: {
        hidden: { column: 0, row: 8, width: 4, height: 3 },
      },
    }

    expect(
      reconcileGridLayout(saved, [
        { id: "revenue" },
        { id: "orders" },
        { id: "activity" },
      ])
    ).toEqual({
      version: 1,
      items: {
        hidden: { column: 0, row: 8, width: 4, height: 3 },
        revenue: { column: 0, row: 0, width: 4, height: 3 },
        orders: { column: 4, row: 0, width: 4, height: 3 },
        activity: { column: 8, row: 0, width: 4, height: 3 },
      },
    })
  })

  it("rejects duplicate identities and structurally invalid persisted geometry", () => {
    expect(() =>
      reconcileGridLayout(undefined, [{ id: "revenue" }, { id: "revenue" }])
    ).toThrow('Duplicate Grid Layout item id: "revenue"')

    expect(() =>
      reconcileGridLayout(
        {
          version: 1,
          items: {
            revenue: { column: 0.5, row: 0, width: 4, height: 3 },
          },
        },
        [{ id: "revenue" }]
      )
    ).toThrow("revenue.column must be a non-negative integer")

    expect(() =>
      reconcileGridLayout(
        {
          version: 1,
          items: {
            revenue: {
              column: 0,
              row: 0,
              width: 4,
              height: 3,
              overrides: { medium: { width: 2.5 } },
            },
          },
        },
        [{ id: "revenue" }]
      )
    ).toThrow("revenue.overrides.medium.width must be a positive integer")
  })

  it("clamps and packs valid canonical geometry that is outside the grid", () => {
    expect(
      reconcileGridLayout(
        {
          version: 1,
          items: {
            revenue: { column: 20, row: 0, width: 20, height: 3 },
            orders: { column: 0, row: 0, width: 4, height: 3 },
          },
        },
        [{ id: "revenue" }, { id: "orders" }]
      )
    ).toEqual({
      version: 1,
      items: {
        revenue: { column: 0, row: 0, width: 12, height: 3 },
        orders: { column: 0, row: 3, width: 4, height: 3 },
      },
    })
  })

  it("derives narrower profiles and applies only their sparse overrides", () => {
    const value = {
      version: 1 as const,
      items: {
        revenue: { column: 8, row: 0, width: 4, height: 3 },
        activity: {
          column: 0,
          row: 0,
          width: 4,
          height: 3,
          overrides: { medium: { column: 2 } },
        },
      },
    }

    expect(
      resolveProfileLayout(value, [{ id: "revenue" }, { id: "activity" }], {
        id: "medium",
        minWidth: 640,
        columns: 6,
      })
    ).toEqual([
      { id: "revenue", column: 4, row: 0, width: 2, height: 3 },
      { id: "activity", column: 2, row: 0, width: 2, height: 3 },
    ])
  })

  it("packs projected items so a compact profile never overlaps", () => {
    const compact = resolveProfileLayout(
      undefined,
      [{ id: "revenue" }, { id: "orders" }, { id: "activity" }],
      { id: "compact", minWidth: 0, columns: 1 }
    )

    expect(compact.map(({ id, row }) => ({ id, row }))).toEqual([
      { id: "revenue", row: 0 },
      { id: "orders", row: 3 },
      { id: "activity", row: 6 },
    ])
  })

  it("commits canonical geometry at wide widths and sparse overrides elsewhere", () => {
    const definitions = [{ id: "revenue" }]
    const original = reconcileGridLayout(undefined, definitions)

    const medium = commitProfileLayout(
      original,
      [{ id: "revenue", column: 1, row: 2, width: 2, height: 3 }],
      { id: "medium", minWidth: 640, columns: 6 }
    )
    expect(medium.items.revenue).toEqual({
      column: 0,
      row: 0,
      width: 4,
      height: 3,
      overrides: { medium: { column: 1, row: 2 } },
    })

    expect(
      commitProfileLayout(
        medium,
        [{ id: "revenue", column: 6, row: 1, width: 6, height: 4 }],
        { id: "wide", minWidth: 1024, columns: 12 }
      ).items.revenue
    ).toEqual({
      column: 6,
      row: 1,
      width: 6,
      height: 4,
      overrides: { medium: { column: 1, row: 2 } },
    })
  })

  it("keeps the 250-item benchmark within an interactive budget", () => {
    const definitions = Array.from({ length: 250 }, (_, index) => ({
      id: `item-${index}`,
    }))
    const startedAt = performance.now()
    const value = reconcileGridLayout(undefined, definitions)
    const layout = resolveProfileLayout(value, definitions, {
      id: "wide",
      minWidth: 1024,
      columns: 12,
    })

    expect(layout).toHaveLength(250)
    expect(performance.now() - startedAt).toBeLessThan(1000)
  })
})
