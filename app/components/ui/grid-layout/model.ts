import {
  compactLayout,
  projectPlacement,
  type GridGeometryItem,
  type GridPlacement,
} from "./geometry"

export type GridLayoutItemValue = GridPlacement & {
  overrides?: Record<string, Partial<GridPlacement>>
}

export type GridLayoutValue = {
  version: 1
  items: Record<string, GridLayoutItemValue>
}

export type GridLayoutItemDefinition = {
  id: string
  initial?: Partial<GridPlacement>
}

export type GridLayoutProfile = {
  id: string
  minWidth: number
  columns: number
}

const CANONICAL_COLUMNS = 12
const DEFAULT_WIDTH = 4
const DEFAULT_HEIGHT = 3

function assertInteger(value: number, location: string, minimum: number) {
  if (!Number.isInteger(value) || value < minimum) {
    const qualifier = minimum === 0 ? "non-negative" : "positive"
    throw new Error(`${location} must be a ${qualifier} integer`)
  }
}

function validatePlacement(placement: GridPlacement, location: string) {
  assertInteger(placement.column, `${location}.column`, 0)
  assertInteger(placement.row, `${location}.row`, 0)
  assertInteger(placement.width, `${location}.width`, 1)
  assertInteger(placement.height, `${location}.height`, 1)
}

function validateInput(
  value: GridLayoutValue | undefined,
  definitions: readonly GridLayoutItemDefinition[]
) {
  const ids = new Set<string>()
  for (const definition of definitions) {
    if (ids.has(definition.id)) {
      throw new Error(`Duplicate Grid Layout item id: "${definition.id}"`)
    }
    ids.add(definition.id)
    for (const [key, minimum] of [
      ["column", 0],
      ["row", 0],
      ["width", 1],
      ["height", 1],
    ] as const) {
      const initial = definition.initial?.[key]
      if (initial !== undefined) {
        assertInteger(initial, `${definition.id}.initial.${key}`, minimum)
      }
    }
  }

  if (!value) return
  if (value.version !== 1) {
    throw new Error(
      `Unsupported Grid Layout snapshot version: ${value.version}`
    )
  }
  for (const [id, placement] of Object.entries(value.items)) {
    validatePlacement(placement, id)
    for (const [profileId, override] of Object.entries(
      placement.overrides ?? {}
    )) {
      for (const [key, minimum] of [
        ["column", 0],
        ["row", 0],
        ["width", 1],
        ["height", 1],
      ] as const) {
        const coordinate = override[key]
        if (coordinate !== undefined) {
          assertInteger(
            coordinate,
            `${id}.overrides.${profileId}.${key}`,
            minimum
          )
        }
      }
    }
  }
}

function overlaps(left: GridPlacement, right: GridPlacement) {
  return !(
    left.column + left.width <= right.column ||
    right.column + right.width <= left.column ||
    left.row + left.height <= right.row ||
    right.row + right.height <= left.row
  )
}

function findFirstAvailable(
  occupied: readonly GridPlacement[],
  width: number,
  height: number
): GridPlacement {
  for (let row = 0; ; row += 1) {
    for (let column = 0; column <= CANONICAL_COLUMNS - width; column += 1) {
      const candidate = { column, row, width, height }
      if (!occupied.some((placement) => overlaps(candidate, placement))) {
        return candidate
      }
    }
  }
}

export function reconcileGridLayout(
  value: GridLayoutValue | undefined,
  definitions: readonly GridLayoutItemDefinition[]
): GridLayoutValue {
  validateInput(value, definitions)
  const items = { ...(value?.items ?? {}) }
  const occupied = definitions.flatMap(({ id }) => {
    const item = items[id]
    if (!item) return []
    const width = Math.min(CANONICAL_COLUMNS, item.width)
    const normalized = {
      ...item,
      width,
      column: Math.min(CANONICAL_COLUMNS - width, item.column),
    }
    items[id] = normalized
    return [normalized]
  })

  for (const definition of definitions) {
    if (items[definition.id]) continue

    const width = Math.min(
      CANONICAL_COLUMNS,
      Math.max(1, definition.initial?.width ?? DEFAULT_WIDTH)
    )
    const height = Math.max(1, definition.initial?.height ?? DEFAULT_HEIGHT)
    const hasPosition =
      definition.initial?.column !== undefined &&
      definition.initial.row !== undefined
    const placement = hasPosition
      ? {
          column: definition.initial?.column ?? 0,
          row: definition.initial?.row ?? 0,
          width,
          height,
        }
      : findFirstAvailable(occupied, width, height)

    items[definition.id] = placement
    occupied.push(placement)
  }

  const packed = compactLayout(
    definitions.map(({ id }) => ({ id, ...items[id] })),
    CANONICAL_COLUMNS
  )
  for (const placement of packed) {
    items[placement.id] = {
      ...items[placement.id],
      column: placement.column,
      row: placement.row,
      width: placement.width,
      height: placement.height,
    }
  }

  return { version: 1, items }
}

export function resolveProfileLayout(
  value: GridLayoutValue | undefined,
  definitions: readonly GridLayoutItemDefinition[],
  profile: GridLayoutProfile
): GridGeometryItem[] {
  const reconciled = reconcileGridLayout(value, definitions)

  const projected = definitions.map(({ id }) => {
    const item = reconciled.items[id]
    const projected = projectPlacement(item, CANONICAL_COLUMNS, profile.columns)
    const override = item.overrides?.[profile.id]
    const width = Math.min(
      profile.columns,
      Math.max(1, override?.width ?? projected.width)
    )
    const height = Math.max(1, override?.height ?? projected.height)
    const column = Math.min(
      profile.columns - width,
      Math.max(0, override?.column ?? projected.column)
    )

    return {
      id,
      column,
      row: Math.max(0, override?.row ?? projected.row),
      width,
      height,
    }
  })

  return compactLayout(projected, profile.columns)
}

export function commitProfileLayout(
  value: GridLayoutValue,
  layout: readonly GridGeometryItem[],
  profile: GridLayoutProfile
): GridLayoutValue {
  validateInput(value, [])
  const items = { ...value.items }

  for (const placement of layout) {
    const current = items[placement.id]
    if (!current) throw new Error(`Unknown Grid Layout item: ${placement.id}`)
    validatePlacement(placement, placement.id)

    if (profile.columns === CANONICAL_COLUMNS) {
      items[placement.id] = {
        column: placement.column,
        row: placement.row,
        width: placement.width,
        height: placement.height,
        ...(current.overrides ? { overrides: current.overrides } : {}),
      }
      continue
    }

    const projected = projectPlacement(
      current,
      CANONICAL_COLUMNS,
      profile.columns
    )
    const override = Object.fromEntries(
      (Object.keys(projected) as (keyof GridPlacement)[])
        .filter((key) => placement[key] !== projected[key])
        .map((key) => [key, placement[key]])
    ) as Partial<GridPlacement>
    const overrides = { ...current.overrides }

    if (Object.keys(override).length > 0) overrides[profile.id] = override
    else delete overrides[profile.id]

    items[placement.id] = {
      ...current,
      ...(Object.keys(overrides).length > 0
        ? { overrides }
        : { overrides: undefined }),
    }
  }

  return { version: 1, items }
}
