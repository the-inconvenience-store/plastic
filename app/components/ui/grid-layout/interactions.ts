import {
  useCallback,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { describeGridCommit, describeGridPlacement } from "./accessibility"
import {
  applyGridConstraints,
  resizePlacementFromDirection,
  resolveMove,
  resolveResize,
  type GridCollision,
  type GridCompaction,
  type GridConstraint,
  type GridGeometryItem,
  type GridItemConstraints,
  type GridResizeDirection,
} from "./geometry"
import type { GridLayoutProfile } from "./model"

export type GridPixelDelta = { x: number; y: number }

export type GridMeasurement = {
  columnWidth: number
  rowHeight: number
  gapX: number
  gapY: number
  scaleX: number
  scaleY: number
}

export type GridInteractionReason = "move" | "resize"

export type GridPointerPreview = {
  baseItem: GridGeometryItem
  gridDelta: { columns: number; rows: number }
  itemId: string
  measurement: GridMeasurement
  pixelDelta: GridPixelDelta
  reason: GridInteractionReason
  resizeDirection?: GridResizeDirection
}

export type GridResizeMode = "both" | "horizontal" | "vertical" | false

export type GridInteractionConfiguration = GridItemConstraints & {
  resize: GridResizeMode
  constraints?: readonly GridConstraint[]
  dragThreshold?: number
}

export type GridInteractionPhase = "start" | "change" | "end" | "cancel"
export type GridInteractionDetail = {
  phase: GridInteractionPhase
  reason: GridInteractionReason | "drop"
  itemId: string
  profile: string
  initial: Readonly<GridGeometryItem>
  placement: Readonly<GridGeometryItem>
  layout: readonly Readonly<GridGeometryItem>[]
  nativeEvent: Event
}

export type GridInteractionContext = {
  collision: GridCollision
  compaction: GridCompaction
  constraints: readonly GridConstraint[]
  maxRows?: number
  visibleRows?: number
  dragThreshold: number
  onInteraction?: (detail: GridInteractionDetail) => void
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
    columns: Math.round(
      delta.x /
        measurement.scaleX /
        (measurement.columnWidth + measurement.gapX)
    ),
    rows: Math.round(
      delta.y / measurement.scaleY / (measurement.rowHeight + measurement.gapY)
    ),
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
  reason: GridInteractionReason,
  resizeDirection: GridResizeDirection = "se"
) {
  const session = useRef<InteractionSession | null>(null)
  const frame = useRef<number | null>(null)
  const copy = INTERACTION_COPY[reason]

  const calculate = useCallback(
    (base: GridGeometryItem[], columns: number, rows: number) => {
      const active = base.find((item) => item.id === id)
      if (!active) throw new Error(`Unknown Grid Layout item: ${id}`)
      if (reason === "move") {
        const proposed = applyGridConstraints(
          {
            column: active.column + columns,
            row: active.row + rows,
            width: active.width,
            height: active.height,
          },
          [
            ...context.constraints,
            ...(context.configuration.get(id)?.constraints ?? []),
          ],
          {
            item: active,
            previous: active,
            layout: base,
            columns: context.profile.columns,
            maxRows: context.maxRows,
            operation: "move",
            visibleRows: context.visibleRows,
          }
        )
        return resolveMove(
          base,
          id,
          {
            column: proposed.column,
            row: proposed.row,
          },
          context.profile.columns,
          context.collision,
          context.compaction,
          context.maxRows
        )
      }

      const configuration = context.configuration.get(id)
      const measurement = context.measurement()
      const resize = configuration?.resize ?? "both"
      const rawPlacement = resizePlacementFromDirection(
        active,
        resizeDirection,
        {
          columns: resize === "vertical" ? 0 : columns,
          rows: resize === "horizontal" ? 0 : rows,
        },
        context.profile.columns,
        configuration
      )
      const placement = applyGridConstraints(
        rawPlacement,
        [...context.constraints, ...(configuration?.constraints ?? [])],
        {
          item: active,
          previous: active,
          layout: base,
          columns: context.profile.columns,
          maxRows: context.maxRows,
          operation: "resize",
          direction: resizeDirection,
          columnPixels: measurement.columnWidth + measurement.gapX,
          rowPixels: measurement.rowHeight + measurement.gapY,
          visibleRows: context.visibleRows,
        }
      )
      return resolveResize(
        base,
        id,
        placement,
        context.profile.columns,
        context.collision,
        configuration,
        context.compaction,
        context.maxRows
      )
    },
    [context, id, reason, resizeDirection]
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
      let activated = false
      const threshold =
        context.configuration.get(id)?.dragThreshold ?? context.dragThreshold

      const emit = (
        phase: GridInteractionPhase,
        layout: GridGeometryItem[],
        nativeEvent: Event
      ) => {
        const placement = layout.find((item) => item.id === id)
        if (!placement) return
        context.onInteraction?.({
          phase,
          reason,
          itemId: id,
          profile: context.profile.id,
          initial: baseItem,
          placement,
          layout,
          nativeEvent,
        })
      }

      const onMove = (moveEvent: PointerEvent) => {
        const pixelDelta = {
          x: moveEvent.clientX - start.x,
          y: moveEvent.clientY - start.y,
        }
        if (!activated && Math.hypot(pixelDelta.x, pixelDelta.y) < threshold)
          return
        if (!activated) {
          activated = true
          emit("start", base, moveEvent)
        }
        const delta = pixelsToGridDelta(pixelDelta, measurement)
        const next = calculate(base, delta.columns, delta.rows)
        const current = session.current
        if (!current) return
        if (!sameLayout(current.draft, next)) {
          current.draft = next
          current.changed = !sameLayout(base, next)
          emit("change", next, moveEvent)
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
            resizeDirection: reason === "resize" ? resizeDirection : undefined,
          })
        )
      }

      const cleanup = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", finish)
        window.removeEventListener("pointercancel", cancel)
        if (frame.current !== null) cancelAnimationFrame(frame.current)
      }
      const finish = (finishEvent: PointerEvent) => {
        cleanup()
        const current = session.current
        session.current = null
        if (!current) return
        context.settlePreview(
          current.changed ? current.draft : current.base,
          id
        )
        if (current.changed) context.commit(current.draft, id, reason)
        if (activated)
          emit(
            "end",
            current.changed ? current.draft : current.base,
            finishEvent
          )
      }
      const cancel = (cancelEvent: PointerEvent) => {
        cleanup()
        const current = session.current
        session.current = null
        if (current) context.settlePreview(current.base, id)
        if (activated) emit("cancel", base, cancelEvent)
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", finish)
      window.addEventListener("pointercancel", cancel)
    },
    [calculate, context, id, reason, resizeDirection]
  )

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if ((event.key === "Enter" || event.key === " ") && !session.current) {
        event.preventDefault()
        const base = context.layout.map((item) => ({ ...item }))
        session.current = { base, draft: base, changed: false }
        const active = base.find((item) => item.id === id)
        if (active) {
          context.onInteraction?.({
            phase: "start",
            reason,
            itemId: id,
            profile: context.profile.id,
            initial: active,
            placement: active,
            layout: base,
            nativeEvent: event.nativeEvent,
          })
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
        const active = context.layout.find((item) => item.id === id)
        if (active)
          context.onInteraction?.({
            phase: "cancel",
            reason,
            itemId: id,
            profile: context.profile.id,
            initial: active,
            placement: active,
            layout: context.layout,
            nativeEvent: event.nativeEvent,
          })
        return
      }
      if (event.key === "Enter") {
        event.preventDefault()
        const current = session.current
        session.current = null
        if (current.changed) context.commit(current.draft, id, reason)
        const active = current.draft.find((item) => item.id === id)
        if (active) {
          context.onInteraction?.({
            phase: "end",
            reason,
            itemId: id,
            profile: context.profile.id,
            initial: current.base.find((item) => item.id === id) ?? active,
            placement: active,
            layout: current.draft,
            nativeEvent: event.nativeEvent,
          })
          context.setAnnouncement(describeGridCommit(copy.committed, active))
        }
        return
      }
      const amount = event.shiftKey ? 5 : 1
      let delta: [number, number] | null = null
      if (event.key === "ArrowLeft") delta = [-amount, 0]
      else if (event.key === "ArrowRight") delta = [amount, 0]
      else if (event.key === "ArrowUp") delta = [0, -amount]
      else if (event.key === "ArrowDown") delta = [0, amount]
      if (!delta) return
      event.preventDefault()
      const current = session.current
      const next = calculate(current.draft, delta[0], delta[1])
      if (sameLayout(current.draft, next)) return
      current.draft = next
      current.changed = !sameLayout(current.base, next)
      context.preview(next)
      const active = next.find((item) => item.id === id)
      if (active) {
        context.onInteraction?.({
          phase: "change",
          reason,
          itemId: id,
          profile: context.profile.id,
          initial: current.base.find((item) => item.id === id) ?? active,
          placement: active,
          layout: next,
          nativeEvent: event.nativeEvent,
        })
        context.setAnnouncement(describeGridPlacement(copy.active, active))
      }
    },
    [calculate, context, copy.active, copy.committed, id, reason]
  )

  return { onKeyDown, onPointerDown }
}
