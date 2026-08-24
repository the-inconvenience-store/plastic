import {
  compactLayout,
  constrainPlacement,
  projectPlacement,
  type GridGeometryItem,
  type GridItemConstraints,
  type GridPlacement,
} from "./geometry"

export type GridLayoutItemValue = GridPlacement & {
  overrides?: Record<string, Partial<GridPlacement>>
}

export type GridLayoutValue = {
  version: 1
  items: Record<string, GridLayoutItemValue>
}

export type GridLayoutItemDefinition = GridItemConstraints & {
  id: string
  initial?: Partial<GridPlacement>
  locked?: boolean
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
    constrainPlacement(
      { column: 0, row: 0, width: 1, height: 1 },
      CANONICAL_COLUMNS,
      definition
    )
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
  const occupied = definitions.flatMap((definition) => {
    const item = items[definition.id]
    if (!item) return []
    const normalized = {
      ...item,
      ...constrainPlacement(item, CANONICAL_COLUMNS, definition),
    }
    items[definition.id] = normalized
    return [normalized]
  })

  for (const definition of definitions) {
    if (items[definition.id]) continue

    const desired = {
      column: definition.initial?.column ?? 0,
      row: definition.initial?.row ?? 0,
      width: definition.initial?.width ?? DEFAULT_WIDTH,
      height: definition.initial?.height ?? DEFAULT_HEIGHT,
    }
    const constrained = constrainPlacement(
      desired,
      CANONICAL_COLUMNS,
      definition
    )
    const hasPosition =
      definition.initial?.column !== undefined &&
      definition.initial.row !== undefined
    const placement = hasPosition
      ? constrained
      : findFirstAvailable(occupied, constrained.width, constrained.height)

    items[definition.id] = placement
    occupied.push(placement)
  }

  const packed = compactLayout(
    definitions.map(({ id, locked }) => ({ id, ...items[id], locked })),
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

  const projected = definitions.map((definition) => {
    const { id } = definition
    const item = reconciled.items[id]
    const projected = projectPlacement(item, CANONICAL_COLUMNS, profile.columns)
    const override = item.overrides?.[profile.id]
    const constrained = constrainPlacement(
      { ...projected, ...override },
      profile.columns,
      definition
    )

    return {
      id,
      ...constrained,
      ...(definition.locked ? { locked: true } : {}),
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
