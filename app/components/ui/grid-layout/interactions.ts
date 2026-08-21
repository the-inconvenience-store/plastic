export type GridPixelDelta = { x: number; y: number }

export type GridMeasurement = {
  columnWidth: number
  rowHeight: number
  gap: number
}

export function parseGridPixelLength(value: string, property: string) {
  const normalized = value.trim()
  if (normalized === "0") return 0
  if (!/^-?(?:\d+|\d*\.\d+)px$/.test(normalized)) {
    throw new Error(`${property} must be expressed in pixels`)
  }
  return Number.parseFloat(normalized)
}

export function pixelsToGridDelta(
  delta: GridPixelDelta,
  measurement: GridMeasurement
) {
  return {
    columns: Math.round(delta.x / (measurement.columnWidth + measurement.gap)),
    rows: Math.round(delta.y / (measurement.rowHeight + measurement.gap)),
  }
}
