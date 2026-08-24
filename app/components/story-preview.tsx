import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock"
import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

type StoryPreviewProps = {
  children: ReactNode
  filename: string
  source: string
}

export function StoryPreview({
  children,
  filename,
  source,
}: StoryPreviewProps) {
  const [open, setOpen] = useState(false)
  const code = source.trim()

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="not-prose my-6 overflow-hidden rounded-xl border bg-fd-card text-fd-card-foreground shadow-sm"
    >
      <div className="[&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
        {children}
      </div>

      {!open && (
        <div className="relative h-28 overflow-hidden border-t">
          <div aria-hidden="true" inert>
            <DynamicCodeBlock
              lang="tsx"
              code={code}
              codeblock={{
                allowCopy: false,
                className:
                  "m-0 rounded-none border-0 opacity-45 shadow-none select-none",
                viewportProps: { className: "pointer-events-none max-h-none" },
                "data-line-numbers": true,
              }}
            />
          </div>
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-fd-card/65 to-fd-card" />
          <CollapsibleTrigger
            render={<Button variant="outline" size="sm" />}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            View Code
          </CollapsibleTrigger>
        </div>
      )}

      <CollapsibleContent className="h-[var(--collapsible-panel-height)] overflow-hidden border-t transition-[height] duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none [&[hidden]:not([hidden='until-found'])]:hidden">
        <DynamicCodeBlock
          lang="tsx"
          code={code}
          codeblock={{
            title: filename,
            className: "m-0 rounded-none border-0 shadow-none",
            viewportProps: { className: "max-h-[32rem]" },
            "data-line-numbers": true,
          }}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}
