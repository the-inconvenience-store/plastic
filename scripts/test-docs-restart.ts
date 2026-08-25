import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { connect } from "node:net"
import { chromium, webkit } from "playwright"

const port = 5187
const cacheDirectory = await mkdtemp(join(tmpdir(), "plastic-docs-vite-"))
const browserType = process.env.DOCS_BROWSER === "webkit" ? webkit : chromium

function startServer() {
  return Bun.spawn(["bunx", "react-router", "dev", "--port", String(port)], {
    cwd: import.meta.dir + "/..",
    env: { ...process.env, DOCS_CACHE_DIR: cacheDirectory },
    stderr: "inherit",
    stdout: "inherit",
  })
}

function canConnect() {
  return new Promise<boolean>((resolve) => {
    const socket = connect({ host: "localhost", port })
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("error", () => resolve(false))
  })
}

async function waitForServer(available = true) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if ((await canConnect()) === available) return
    await Bun.sleep(100)
  }
  throw new Error(
    `Docs dev server did not become ${available ? "available" : "unavailable"} within 30 seconds`
  )
}

let browser
let server = startServer()

try {
  await waitForServer()
  browser = await browserType.launch({ headless: true })
  const page = await browser.newPage()
  const browserErrors: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })
  page.on("pageerror", (error) => browserErrors.push(error.message))

  const gridResponse = await page.goto(
    `http://localhost:${port}/docs/components/grid-layout`,
    { waitUntil: "networkidle", timeout: 60_000 }
  )
  if (!gridResponse?.ok()) {
    throw new Error(`Grid Layout docs returned ${gridResponse?.status()}`)
  }

  const components = page.getByRole("button", { name: "Components" })
  await components.waitFor({ timeout: 10_000 })
  const sidebarBefore = await components.getAttribute("aria-expanded")
  await components.click()
  const sidebarAfter = await components.getAttribute("aria-expanded")
  if (sidebarBefore === sidebarAfter) {
    throw new Error("Sidebar accordion did not respond after a cold start")
  }

  const apiProperty = page
    .getByRole("button", { name: /^columns number/ })
    .first()
  const apiBefore = await apiProperty.getAttribute("aria-expanded")
  await apiProperty.click()
  const apiAfter = await apiProperty.getAttribute("aria-expanded")
  if (apiBefore === apiAfter) {
    throw new Error(
      "Generated API accordion did not respond after a cold start"
    )
  }

  const gridInstall = page.locator('[data-slot="registry-install-command"]')
  await gridInstall.getByRole("tab", { name: "bun" }).click()
  const gridCommand = gridInstall.locator('[role="tabpanel"]:visible')
  if (!(await gridCommand.innerText()).includes("bunx --bun")) {
    throw new Error("Install command did not switch to bun")
  }

  server.kill()
  await server.exited
  await waitForServer(false)
  server = startServer()
  await waitForServer()
  browserErrors.length = 0

  const restartResponse = await page.reload({
    waitUntil: "networkidle",
    timeout: 60_000,
  })
  if (restartResponse && !restartResponse.ok()) {
    throw new Error(
      `Restarted Grid Layout docs returned ${restartResponse?.status()}`
    )
  }

  const restartedComponents = page.getByRole("button", { name: "Components" })
  const restartedSidebarBefore =
    await restartedComponents.getAttribute("aria-expanded")
  await restartedComponents.click()
  const restartedSidebarAfter =
    await restartedComponents.getAttribute("aria-expanded")
  if (restartedSidebarBefore === restartedSidebarAfter) {
    throw new Error("Sidebar accordion did not respond after a server restart")
  }

  const restartedApiProperty = page
    .getByRole("button", { name: /^columns number/ })
    .first()
  const restartedApiBefore =
    await restartedApiProperty.getAttribute("aria-expanded")
  await restartedApiProperty.click()
  const restartedApiAfter =
    await restartedApiProperty.getAttribute("aria-expanded")
  if (restartedApiBefore === restartedApiAfter) {
    throw new Error(
      "Generated API accordion did not respond after a server restart"
    )
  }

  const bloomResponse = await page.goto(
    `http://localhost:${port}/docs/components/bloom`,
    { waitUntil: "networkidle", timeout: 60_000 }
  )
  if (!bloomResponse?.ok()) {
    throw new Error(`Bloom docs returned ${bloomResponse?.status()}`)
  }

  const bloomInstall = page.locator('[data-slot="registry-install-command"]')
  const rememberedManager = await bloomInstall
    .getByRole("tab", { name: "bun" })
    .getAttribute("data-active")
  if (rememberedManager === null) {
    throw new Error("Package manager choice did not persist between pages")
  }
  const bloomCommand = bloomInstall.locator('[role="tabpanel"]:visible')
  if (!(await bloomCommand.innerText()).includes("plastic/bloom")) {
    throw new Error("Install command did not update for the Bloom docs")
  }

  await page.getByRole("button", { name: "Open Bloom menu" }).first().click()
  await page.getByRole("menu").first().waitFor({ state: "visible" })

  if (browserErrors.length > 0) {
    throw new Error(`Browser errors:\n${browserErrors.join("\n")}`)
  }
} finally {
  await browser?.close()
  server.kill()
  await server.exited
  await rm(cacheDirectory, { force: true, recursive: true })
}
