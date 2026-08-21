import { describe, expect, it } from "vitest"

import { pixelsToGridDelta } from "./interactions"

describe("Grid Layout pointer math", () => {
  it("converts pointer travel using one measured cell geometry", () => {
    expect(
      pixelsToGridDelta(
        { x: 126, y: 121 },
        { columnWidth: 52, rowHeight: 48, gap: 12 }
      )
    ).toEqual({ columns: 2, rows: 2 })
  })
})
