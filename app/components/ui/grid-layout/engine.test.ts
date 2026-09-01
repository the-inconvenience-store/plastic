import { describe, expect, it } from "vitest"

import { createGridLayoutEngine } from "./engine"

describe("Grid Layout headless engine", () => {
  it("runs moves, overlap, drops, removal, and custom compaction without mutation", () => {
    const source = [
      { id: "a", column: 0, row: 0, width: 2, height: 2, layer: 2 },
      { id: "b", column: 2, row: 0, width: 2, height: 2 },
    ] as const
    const engine = createGridLayoutEngine({
      columns: 4,
      collision: "overlap",
      compaction: "none",
    })

    const moved = engine.transition(source, {
      type: "move",
      itemId: "a",
      column: 2,
      row: 0,
    })
    expect(moved.active?.layer).toBe(2)
    expect(moved.collisions.map(({ id }) => id)).toStrictEqual(["b"])
    expect(source[0].column).toBe(0)

    const dropped = engine.transition(moved.items, {
      type: "drop",
      item: { id: "c", column: 0, row: 3, width: 1, height: 1 },
    })
    expect(dropped.items.map(({ id }) => id)).toStrictEqual(["a", "b", "c"])
    expect(
      engine.transition(dropped.items, { type: "remove", itemId: "c" }).items
    ).toHaveLength(2)
  })

  it("blocks a push that would exceed maxRows", () => {
    const items = [
      { id: "a", column: 0, row: 0, width: 2, height: 2 },
      { id: "b", column: 2, row: 0, width: 2, height: 2 },
    ]
    const result = createGridLayoutEngine({
      columns: 4,
      maxRows: 2,
    }).transition(items, {
      type: "move",
      itemId: "a",
      column: 2,
      row: 0,
    })
    expect(result.items).toStrictEqual(items)
    expect(result.changed).toBe(false)
  })
})
