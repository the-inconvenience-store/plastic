import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { GridLayout } from "./grid-layout"

describe("Grid Layout rendering", () => {
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
})
