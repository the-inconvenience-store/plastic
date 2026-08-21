import { describe, expect, it } from "vitest"

import { parseGridPixelLength, pixelsToGridDelta } from "./interactions"

describe("Grid Layout pointer math", () => {
  it("converts pointer travel using one measured cell geometry", () => {
    expect(
      pixelsToGridDelta(
        { x: 126, y: 121 },
        { columnWidth: 52, rowHeight: 48, gap: 12 }
      )
    ).toEqual({ columns: 2, rows: 2 })
  })

  it("accepts pixel custom properties and rejects ambiguous CSS units", () => {
    expect(parseGridPixelLength("12px", "--grid-layout-gap")).toBe(12)
    expect(parseGridPixelLength("0", "--grid-layout-gap")).toBe(0)
    expect(() => parseGridPixelLength("0.75rem", "--grid-layout-gap")).toThrow(
      "--grid-layout-gap must be expressed in pixels"
    )
  })
})
