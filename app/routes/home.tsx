import { HomeLayout } from "fumadocs-ui/layouts/home"
import { Link } from "react-router"
import { baseOptions } from "@/lib/layout.shared"

export function meta() {
  return [
    { title: "Plastic component registry" },
    {
      name: "description",
      content: "Documentation and installable components from Plastic.",
    },
  ]
}

export default function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <p className="mb-2 font-mono text-sm text-fd-muted-foreground">
          plastic / component registry
        </p>
        <h1 className="mb-3 text-4xl font-bold tracking-tight">
          Build in Storybook. Ship with shadcn.
        </h1>
        <p className="mb-6 max-w-xl text-fd-muted-foreground">
          Browse component documentation, usage examples, and installable
          registry items.
        </p>
        <Link
          className="rounded-full bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground"
          to="/docs"
        >
          Browse documentation
        </Link>
      </div>
    </HomeLayout>
  )
}
