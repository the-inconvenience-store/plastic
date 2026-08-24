import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { GridLayout } from "./grid-layout"

describe("Grid Layout rendering", () => {
  it("renders a static item without move or resize controls", () => {
    const markup = renderToString(
      <GridLayout>
        <GridLayout.Item id="fixed" static>
          <div>Fixed</div>
        </GridLayout.Item>
        <GridLayout.Item id="moving">
          <div>Moving</div>
        </GridLayout.Item>
      </GridLayout>
    )

    expect(markup).toContain('data-grid-layout-id="fixed"')
    expect(markup).toContain('data-static=""')
    expect(markup).not.toContain('aria-label="Move fixed"')
    expect(markup).not.toContain('aria-label="Resize fixed')
    expect(markup).toContain('aria-label="Move moving"')
  })

  it("server-renders 250 items within the benchmark budget", () => {
    const startedAt = performance.now()
    const markup = renderToString(
      <GridLayout.Static>
        {Array.from({ length: 250 }, (_, index) => (
          <GridLayout.Item id={`item-${index}`} key={index}>
            <div>Item {index}</div>
          </GridLayout.Item>
        ))}
      </GridLayout.Static>
    )

    expect(markup.match(/data-slot="grid-layout-item"/g)).toHaveLength(250)
    expect(performance.now() - startedAt).toBeLessThan(2000)
  })

  it("disables dragging independently and renders viewport/layer configuration", () => {
    const markup = renderToString(
      <GridLayout viewport={{ gap: { x: 8, y: 16 }, padding: 20, height: 320 }}>
        <GridLayout.Item id="chart" draggable={false} layer={4}>
          <div>Chart</div>
        </GridLayout.Item>
      </GridLayout>
    )

    expect(markup).not.toContain('aria-label="Move chart"')
    expect(markup).toContain('aria-label="Resize chart')
    expect(markup).toContain("--grid-layout-gap-x:8px")
    expect(markup).toContain("--grid-layout-gap-y:16px")
    expect(markup).toContain("height:320px")
    expect(markup).toContain("z-index:4")
  })
})
