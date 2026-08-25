import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "fumadocs-ui/components/tabs"
import { SquareTerminalIcon } from "lucide-react"

import { componentDocsConfig } from "../../component-docs.config"

const packageManagers = ["pnpm", "npm", "yarn", "bun"] as const

type PackageManager = (typeof packageManagers)[number]

type RegistryInstallCommandProps = {
  name: string
}

function getRegistryInstallCommand(name: string, manager: PackageManager) {
  const address = `${componentDocsConfig.registry.githubAddress}/${name}`
  const runners: Record<PackageManager, string> = {
    pnpm: "pnpm dlx",
    npm: "npx",
    yarn: "yarn dlx",
    bun: "bunx --bun",
  }

  return `${runners[manager]} shadcn@latest add ${address}`
}

export function RegistryInstallCommand({ name }: RegistryInstallCommandProps) {
  const commands = Object.fromEntries(
    packageManagers.map((item) => [item, getRegistryInstallCommand(name, item)])
  ) as Record<PackageManager, string>

  return (
    <Tabs
      data-slot="registry-install-command"
      defaultValue="pnpm"
      groupId="plastic-package-manager"
    >
      <TabsList className="items-center">
        <SquareTerminalIcon aria-hidden="true" className="size-3.5 shrink-0" />
        {packageManagers.map((item) => (
          <TabsTrigger key={item} value={item}>
            {item}
          </TabsTrigger>
        ))}
      </TabsList>

      {packageManagers.map((item) => (
        <TabsContent key={item} value={item}>
          <DynamicCodeBlock
            code={commands[item]}
            lang="bash"
            codeblock={{
              viewportProps: { className: "max-h-none" },
            }}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}

export {
  getRegistryInstallCommand,
  type PackageManager,
  type RegistryInstallCommandProps,
}
