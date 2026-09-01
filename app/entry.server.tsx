import { PassThrough } from "node:stream"

import { createReadableStreamFromReadable } from "@react-router/node"
import type { EntryContext, RouterContextProvider } from "react-router"
import { ServerRouter } from "react-router"
import type { RenderToPipeableStreamOptions } from "react-dom/server"
import { renderToPipeableStream } from "react-dom/server"
import { isbot } from "isbot"

// Generated component documentation is intentionally large. A cold Vite boot
// can spend longer than React Router's 5-second default compiling the page,
// leaving streamed HTML visible but unhydrated when the default entry aborts.
// Development renders therefore have no deadline; production keeps a generous
// guard against genuinely stuck renders.
export const streamTimeout = 60_000

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: RouterContextProvider
) {
  let statusCode = responseStatusCode

  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      headers: responseHeaders,
      status: statusCode,
    })
  }

  return new Promise<Response>((resolve, reject) => {
    let shellRendered = false
    const userAgent = request.headers.get("user-agent")
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode
        ? "onAllReady"
        : "onShellReady"
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const { abort, pipe } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        [readyOption]() {
          shellRendered = true
          const body = new PassThrough({
            final(callback) {
              clearTimeout(timeoutId)
              timeoutId = undefined
              callback()
            },
          })
          const stream = createReadableStreamFromReadable(body)

          responseHeaders.set("Content-Type", "text/html")
          pipe(body)
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: statusCode,
            })
          )
        },
        onError(error: unknown) {
          statusCode = 500
          if (shellRendered) console.error(error)
        },
        onShellError(error: unknown) {
          reject(error)
        },
      }
    )

    if (process.env.NODE_ENV !== "development") {
      timeoutId = setTimeout(() => abort(), streamTimeout + 1_000)
    }
  })
}
