import type { GridLayoutProfile } from "./model"

export const DEFAULT_GRID_LAYOUT_PROFILES = [
  { id: "compact", minWidth: 0, columns: 1 },
  { id: "medium", minWidth: 640, columns: 6 },
  { id: "wide", minWidth: 1024, columns: 12 },
] as const satisfies readonly GridLayoutProfile[]

export function selectGridLayoutProfile(
  profiles: readonly GridLayoutProfile[],
  containerWidth: number
): GridLayoutProfile {
  if (profiles.length === 0)
    throw new Error("Grid Layout requires at least one profile")

  const ids = new Set<string>()
  for (const profile of profiles) {
    if (ids.has(profile.id)) {
      throw new Error(`Duplicate Grid Layout profile id: "${profile.id}"`)
    }
    if (!Number.isInteger(profile.columns) || profile.columns < 1) {
      throw new Error(
        `Grid Layout profile "${profile.id}" columns must be a positive integer`
      )
    }
    ids.add(profile.id)
  }

  const ordered = [...profiles].sort(
    (left, right) => left.minWidth - right.minWidth
  )
  let selected = ordered[0]
  for (const profile of ordered) {
    if (containerWidth >= profile.minWidth) selected = profile
  }
  return selected
}
