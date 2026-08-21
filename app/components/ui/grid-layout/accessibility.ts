import type { GridGeometryItem } from "./geometry"

export function describeGridPlacement(
  action: "Moving" | "Resizing",
  item: GridGeometryItem
) {
  return `${action} ${item.id}. Column ${item.column + 1}, row ${item.row + 1}, width ${item.width}, height ${item.height}.`
}

export function describeGridCommit(
  action: "Moved" | "Resized",
  item: GridGeometryItem
) {
  return `${action} ${item.id}. Column ${item.column + 1}, row ${item.row + 1}, width ${item.width}, height ${item.height}.`
}
