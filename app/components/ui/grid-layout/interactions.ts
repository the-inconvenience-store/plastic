export type GridPixelDelta = { x: number; y: number }

export type GridMeasurement = {
  columnWidth: number
  rowHeight: number
  gap: number
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
