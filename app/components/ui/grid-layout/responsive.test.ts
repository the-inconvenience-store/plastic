import { describe, expect, it } from "vitest"

import {
  DEFAULT_GRID_LAYOUT_PROFILES,
  selectGridLayoutProfile,
} from "./responsive"

describe("Grid Layout profiles", () => {
  it("selects the greatest profile that fits the container", () => {
    expect(selectGridLayoutProfile(DEFAULT_GRID_LAYOUT_PROFILES, 320).id).toBe(
      "compact"
    )
    expect(selectGridLayoutProfile(DEFAULT_GRID_LAYOUT_PROFILES, 640).id).toBe(
      "medium"
    )
    expect(selectGridLayoutProfile(DEFAULT_GRID_LAYOUT_PROFILES, 1600).id).toBe(
      "wide"
    )
  })

  it("rejects ambiguous profiles", () => {
    expect(() =>
      selectGridLayoutProfile(
        [
          { id: "same", minWidth: 0, columns: 1 },
          { id: "same", minWidth: 640, columns: 6 },
        ],
        800
      )
    ).toThrow('Duplicate Grid Layout profile id: "same"')
  })
})
