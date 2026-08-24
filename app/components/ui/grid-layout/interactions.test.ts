import { describe, expect, it } from "vitest"

import {
  getGridFlipTransform,
  parseGridPixelLength,
  pixelsToGridDelta,
} from "./interactions"

describe("Grid Layout pointer math", () => {
  it("converts pointer travel using one measured cell geometry", () => {
    expect(
      pixelsToGridDelta(
        { x: 126, y: 121 },
        {
          columnWidth: 52,
          rowHeight: 48,
          gapX: 12,
          gapY: 12,
          scaleX: 1,
          scaleY: 1,
        }
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

  it("corrects pointer projection for independently scaled containers", () => {
    expect(
      pixelsToGridDelta(
        { x: 64, y: 120 },
        {
          columnWidth: 52,
          rowHeight: 48,
          gapX: 12,
          gapY: 12,
          scaleX: 0.5,
          scaleY: 2,
        }
      )
    ).toEqual({ columns: 2, rows: 1 })
  })

  it("describes a compositor-only FLIP transition between grid placements", () => {
    expect(
      getGridFlipTransform(
        { left: 16, top: 24, width: 100, height: 96 },
        { left: 128, top: 84, width: 212, height: 156 }
      )
    ).toEqual({
      x: -112,
      y: -60,
      scaleX: 100 / 212,
      scaleY: 96 / 156,
    })
  })
})
