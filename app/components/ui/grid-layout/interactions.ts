import {
  useCallback,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { describeGridCommit, describeGridPlacement } from "./accessibility"
import {
  resolveMove,
  resolveResize,
  type GridCollision,
  type GridGeometryItem,
  type GridItemConstraints,
} from "./geometry"
import type { GridLayoutProfile } from "./model"

export type GridPixelDelta = { x: number; y: number }

export type GridMeasurement = {
  columnWidth: number
  rowHeight: number
  gap: number
}

export type GridInteractionReason = "move" | "resize"

export type GridPointerPreview = {
  baseItem: GridGeometryItem
  gridDelta: { columns: number; rows: number }
  itemId: string
  measurement: GridMeasurement
  pixelDelta: GridPixelDelta
  reason: GridInteractionReason
}

export type GridResizeMode = "both" | "horizontal" | "vertical" | false

export type GridInteractionConfiguration = GridItemConstraints & {
  resize: GridResizeMode
}

export type GridInteractionContext = {
  collision: GridCollision
  commit: (
    layout: GridGeometryItem[],
    itemId: string,
    reason: GridInteractionReason
  ) => void
  configuration: ReadonlyMap<string, GridInteractionConfiguration>
  layout: GridGeometryItem[]
  measurement: () => GridMeasurement
  preview: (layout: GridGeometryItem[], pointer?: GridPointerPreview) => void
  profile: GridLayoutProfile
  resetPreview: () => void
  settlePreview: (layout: GridGeometryItem[], itemId: string) => void
  setAnnouncement: (message: string) => void
}

type InteractionSession = {
  base: GridGeometryItem[]
  draft: GridGeometryItem[]
  changed: boolean
}

const INTERACTION_COPY = {
  move: { active: "Moving", committed: "Moved" },
  resize: { active: "Resizing", committed: "Resized" },
} as const

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

export function getGridFlipTransform(
  before: Pick<DOMRect, "height" | "left" | "top" | "width">,
  after: Pick<DOMRect, "height" | "left" | "top" | "width">
) {
  return {
    scaleX: after.width === 0 ? 1 : before.width / after.width,
    scaleY: after.height === 0 ? 1 : before.height / after.height,
    x: before.left - after.left,
    y: before.top - after.top,
  }
}

function sameLayout(
  left: readonly GridGeometryItem[],
  right: readonly GridGeometryItem[]
) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function useGridInteraction(
  context: GridInteractionContext,
  id: string,
  reason: GridInteractionReason
) {
  const session = useRef<InteractionSession | null>(null)
  const frame = useRef<number | null>(null)
  const copy = INTERACTION_COPY[reason]

  const calculate = useCallback(
    (base: GridGeometryItem[], columns: number, rows: number) => {
      const active = base.find((item) => item.id === id)
      if (!active) throw new Error(`Unknown Grid Layout item: ${id}`)
      if (reason === "move") {
        return resolveMove(
          base,
          id,
          {
            column: Math.max(
              0,
              Math.min(
                context.profile.columns - active.width,
                active.column + columns
              )
            ),
            row: Math.max(0, active.row + rows),
          },
          context.profile.columns,
          context.collision
        )
      }

      const configuration = context.configuration.get(id)
      const resize = configuration?.resize ?? "both"
      return resolveResize(
        base,
        id,
        {
          width: active.width + (resize === "vertical" ? 0 : columns),
          height: active.height + (resize === "horizontal" ? 0 : rows),
        },
        context.profile.columns,
        context.collision,
        configuration
      )
    },
    [context, id, reason]
  )

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || session.current) return
      event.currentTarget.focus()
      event.preventDefault()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      const start = { x: event.clientX, y: event.clientY }
      const measurement = context.measurement()
      const base = context.layout.map((item) => ({ ...item }))
      const baseItem = base.find((item) => item.id === id)
      if (!baseItem) throw new Error(`Unknown Grid Layout item: ${id}`)
      session.current = { base, draft: base, changed: false }

      const onMove = (moveEvent: PointerEvent) => {
        const pixelDelta = {
          x: moveEvent.clientX - start.x,
          y: moveEvent.clientY - start.y,
        }
        const delta = pixelsToGridDelta(pixelDelta, measurement)
        const next = calculate(base, delta.columns, delta.rows)
        const current = session.current
        if (!current) return
        if (!sameLayout(current.draft, next)) {
          current.draft = next
          current.changed = !sameLayout(base, next)
        }
        if (frame.current !== null) cancelAnimationFrame(frame.current)
        frame.current = requestAnimationFrame(() =>
          context.preview(next, {
            baseItem,
            gridDelta: delta,
            itemId: id,
            measurement,
            pixelDelta,
            reason,
          })
        )
      }

      const cleanup = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", finish)
        window.removeEventListener("pointercancel", cancel)
        if (frame.current !== null) cancelAnimationFrame(frame.current)
      }
      const finish = () => {
        cleanup()
        const current = session.current
        session.current = null
        if (!current) return
        context.settlePreview(
          current.changed ? current.draft : current.base,
          id
        )
        if (current.changed) context.commit(current.draft, id, reason)
      }
      const cancel = () => {
        cleanup()
        const current = session.current
        session.current = null
        if (current) context.settlePreview(current.base, id)
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", finish)
      window.addEventListener("pointercancel", cancel)
    },
    [calculate, context, id, reason]
  )

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if ((event.key === "Enter" || event.key === " ") && !session.current) {
        event.preventDefault()
        const base = context.layout.map((item) => ({ ...item }))
        session.current = { base, draft: base, changed: false }
        const active = base.find((item) => item.id === id)
        if (active) {
          context.setAnnouncement(describeGridPlacement(copy.active, active))
        }
        return
      }
      if (!session.current) return
      if (event.key === "Escape") {
        event.preventDefault()
        session.current = null
        context.resetPreview()
        context.setAnnouncement(`Cancelled ${reason} for ${id}.`)
        return
      }
      if (event.key === "Enter") {
        event.preventDefault()
        const current = session.current
        session.current = null
        if (current.changed) context.commit(current.draft, id, reason)
        const active = current.draft.find((item) => item.id === id)
        if (active) {
          context.setAnnouncement(describeGridCommit(copy.committed, active))
        }
        return
      }
      const amount = event.shiftKey ? 5 : 1
      const delta =
        event.key === "ArrowLeft"
          ? [-amount, 0]
          : event.key === "ArrowRight"
            ? [amount, 0]
            : event.key === "ArrowUp"
              ? [0, -amount]
              : event.key === "ArrowDown"
                ? [0, amount]
                : null
      if (!delta) return
      event.preventDefault()
      const current = session.current
      const next = calculate(current.draft, delta[0], delta[1])
      current.draft = next
      current.changed = !sameLayout(current.base, next)
      context.preview(next)
      const active = next.find((item) => item.id === id)
      if (active) {
        context.setAnnouncement(describeGridPlacement(copy.active, active))
      }
    },
    [calculate, context, copy.active, copy.committed, id, reason]
  )

  return { onKeyDown, onPointerDown }
}
