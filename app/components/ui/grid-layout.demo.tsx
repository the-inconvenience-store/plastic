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
import { GridLayout, type GridLayoutChangeDetail } from "./grid-layout"
import { Input } from "./input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

export type GridLayoutDemoProps = {
  collision?: "push" | "block"
  editable?: boolean
}

export function GridLayoutDemo({
  collision = "push",
  editable = true,
}: GridLayoutDemoProps) {
  const [lastChange, setLastChange] = useState<GridLayoutChangeDetail | null>(
    null
  )
  const [changeCount, setChangeCount] = useState(0)
  const Root = editable ? GridLayout : GridLayout.Static
  const rootProps = editable
    ? {
        collision,
        onLayoutChange: (_layout: unknown, detail: GridLayoutChangeDetail) => {
          setLastChange(detail)
          setChangeCount((count) => count + 1)
        },
      }
    : {}

  return (
    <div className="space-y-3">
      <Root {...rootProps} aria-label="Dashboard layout">
        <GridLayout.Item
          id="revenue"
          label="Revenue"
          initial={{ width: 4, height: 3 }}
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
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Recent customer events</CardDescription>
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
      </Root>
      <output className="text-sm text-foreground" data-testid="last-change">
        {lastChange
          ? `${lastChange.reason}:${lastChange.itemId}:${changeCount}`
          : "No layout changes"}
      </output>
    </div>
  )
}
