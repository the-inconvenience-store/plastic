import { useState } from "react"

import { Button } from "./button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card"
import {
  GridLayout,
  gridLayout,
  type GridCollision,
  type GridCompactionName,
  type GridLayoutChangeDetail,
  type GridLayoutDropOptions,
  type GridLayoutValue,
  type GridInteractionDetail,
} from "./grid-layout"
import { Input } from "./input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

export type GridLayoutDemoProps = {
  collision?: GridCollision
  compaction?: GridCompactionName
  constrained?: boolean
  draggableRevenue?: boolean
  editable?: boolean
  headless?: boolean
  lifecycle?: boolean
  overlap?: boolean
  palette?: boolean
  persisted?: boolean
  spacious?: boolean
  staticActivity?: boolean
}

const DEFAULT_LAYOUT: GridLayoutValue = {
  version: 1,
  items: {
    revenue: { column: 0, row: 0, width: 4, height: 3 },
    filters: { column: 4, row: 0, width: 4, height: 3 },
    activity: { column: 8, row: 0, width: 4, height: 4 },
  },
}

const OVERLAP_LAYOUT: GridLayoutValue = {
  version: 1,
  items: {
    revenue: { column: 0, row: 0, width: 6, height: 3 },
    filters: { column: 3, row: 1, width: 6, height: 3 },
    activity: { column: 6, row: 2, width: 6, height: 4 },
  },
}

export function GridLayoutDemo({
  collision = "push",
  compaction = "vertical",
  constrained = false,
  draggableRevenue = true,
  editable = true,
  headless = false,
  lifecycle = false,
  overlap = false,
  palette = false,
  persisted = false,
  spacious = false,
  staticActivity = false,
}: GridLayoutDemoProps) {
  const [lastChange, setLastChange] = useState<GridLayoutChangeDetail | null>(
    null
  )
  const [changeCount, setChangeCount] = useState(0)
  const [savedLayout, setSavedLayout] = useState<GridLayoutValue>(
    overlap ? OVERLAP_LAYOUT : DEFAULT_LAYOUT
  )
  const [dropped, setDropped] = useState<{
    id: string
    column: number
    row: number
    width: number
    height: number
  } | null>(null)
  const [lastInteraction, setLastInteraction] =
    useState<GridInteractionDetail | null>(null)

  if (headless) {
    const result = gridLayout
      .create({
        columns: 12,
        collision: "push",
        compaction: "horizontal",
      })
      .transition(
        [
          { id: "revenue", column: 0, row: 0, width: 4, height: 2 },
          { id: "orders", column: 4, row: 0, width: 4, height: 2 },
        ],
        { type: "move", itemId: "orders", column: 8, row: 0 }
      )

    return (
      <Card>
        <CardHeader>
          <CardTitle>Headless layout result</CardTitle>
          <CardDescription>
            The same engine can calculate layouts without rendering the grid.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto text-sm">
            {JSON.stringify(result.items, null, 2)}
          </pre>
        </CardContent>
      </Card>
    )
  }

  const Root = editable ? GridLayout : GridLayout.Static
  const initialLayout = overlap ? OVERLAP_LAYOUT : DEFAULT_LAYOUT
  const dropOptions: GridLayoutDropOptions | undefined = palette
    ? {
        accept: "application/x-grid-layout-demo",
        item: (event) =>
          event.dataTransfer?.getData("application/x-grid-layout-demo")
            ? { id: "new-widget", width: 4, height: 2 }
            : null,
        onDrop: ({ item, placement }) => {
          setDropped({ id: item.id, ...placement })
        },
      }
    : undefined
  const rootProps = editable
    ? {
        collision: overlap ? ("overlap" as const) : collision,
        compaction: overlap ? ("none" as const) : compaction,
        constraints: constrained
          ? [gridLayout.constraints.snap({ columns: 2 })]
          : undefined,
        defaultLayout: persisted ? undefined : initialLayout,
        layout: persisted ? savedLayout : undefined,
        viewport: spacious
          ? { gap: { x: 24, y: 16 }, padding: { x: 20, y: 12 } }
          : undefined,
        drop: dropOptions,
        onInteraction: lifecycle
          ? (detail: GridInteractionDetail) => setLastInteraction(detail)
          : undefined,
        onLayoutChange: (
          layout: GridLayoutValue,
          detail: GridLayoutChangeDetail
        ) => {
          if (persisted) setSavedLayout(layout)
          setLastChange(detail)
          setChangeCount((count) => count + 1)
        },
      }
    : {}

  return (
    <div className="flex flex-col gap-3">
      {palette ? (
        <Card>
          <CardHeader>
            <CardTitle>Widget palette</CardTitle>
            <CardDescription>Drag the widget into the grid.</CardDescription>
            <CardAction>
              <Button
                variant="outline"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    "application/x-grid-layout-demo",
                    "new-widget"
                  )
                }}
              >
                New widget
              </Button>
            </CardAction>
          </CardHeader>
        </Card>
      ) : null}
      <Root {...rootProps} aria-label="Dashboard layout">
        <GridLayout.Item
          id="revenue"
          label="Revenue"
          initial={{ width: 4, height: 3 }}
          draggable={draggableRevenue}
          layer={overlap ? 3 : undefined}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Revenue</CardTitle>
              <CardDescription>Last 30 days</CardDescription>
              <CardAction>
                <GridLayout.DragHandle
                  render={<Button variant="ghost" size="icon-sm" />}
                >
                  <span aria-hidden="true">⋮⋮</span>
                </GridLayout.DragHandle>
              </CardAction>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              $48,290
            </CardContent>
          </Card>
        </GridLayout.Item>

        <GridLayout.Item
          id="filters"
          label="Filters"
          initial={{ width: 4, height: 3 }}
          resize="horizontal"
          layer={overlap ? 2 : undefined}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Refine the dashboard</CardDescription>
              <CardAction>
                <GridLayout.ResizeAnchor
                  direction="e"
                  render={<Button variant="ghost" size="icon-sm" />}
                >
                  <span aria-hidden="true">↔</span>
                </GridLayout.ResizeAnchor>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Input aria-label="Search orders" placeholder="Search orders" />
            </CardContent>
          </Card>
        </GridLayout.Item>

        <GridLayout.Item
          id="activity"
          label="Activity"
          initial={{ width: 4, height: 4 }}
          static={staticActivity}
          layer={overlap ? 1 : undefined}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>
                {staticActivity ? "Pinned in place" : "Recent customer events"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="orders">
                <TabsList>
                  <TabsTrigger value="orders">Orders</TabsTrigger>
                  <TabsTrigger value="signups">Signups</TabsTrigger>
                </TabsList>
                <TabsContent value="orders">12 orders today</TabsContent>
                <TabsContent value="signups">8 signups today</TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </GridLayout.Item>
        {dropped ? (
          <GridLayout.Item id={dropped.id} initial={dropped} label="New widget">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>New widget</CardTitle>
                <CardDescription>Dropped from the palette</CardDescription>
              </CardHeader>
            </Card>
          </GridLayout.Item>
        ) : null}
      </Root>
      <output className="text-sm text-foreground" data-testid="last-change">
        {lastChange
          ? `${lastChange.reason}:${lastChange.itemId}:${changeCount}`
          : "No layout changes"}
      </output>
      {lifecycle ? (
        <output
          className="text-sm text-foreground"
          data-testid="interaction-phase"
        >
          {lastInteraction
            ? `${lastInteraction.reason}:${lastInteraction.phase}:${lastInteraction.itemId}`
            : "No interaction yet"}
        </output>
      ) : null}
      {persisted ? (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => setSavedLayout(initialLayout)}
        >
          Reset saved layout
        </Button>
      ) : null}
    </div>
  )
}
