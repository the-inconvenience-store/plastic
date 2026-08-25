import { useState } from "react"
import {
  ArchiveIcon,
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  LinkIcon,
  MailIcon,
  MoreHorizontalIcon,
  PencilIcon,
  ShareIcon,
} from "lucide-react"

import { Bloom, type BloomAnchor, type BloomDirection } from "./bloom"
import { Button } from "./button"

export type BloomDemoProps = {
  anchor?: BloomAnchor
  bounce?: number
  controlled?: boolean
  direction?: BloomDirection
  disabledItem?: boolean
  selectionControls?: boolean
  showBackdrop?: boolean
  submenu?: boolean
  textTrigger?: boolean
  visualDuration?: number
}

export function BloomDemo({
  anchor = "start",
  bounce = 0.2,
  controlled = false,
  direction = "top",
  disabledItem = false,
  selectionControls = false,
  showBackdrop = false,
  submenu = false,
  textTrigger = false,
  visualDuration = 0.25,
}: BloomDemoProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState("No action selected")
  const [notifications, setNotifications] = useState(true)
  const [density, setDensity] = useState("comfortable")

  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-4">
      {controlled ? (
        <Button variant="secondary" onClick={() => setOpen((value) => !value)}>
          {open ? "Close from outside" : "Open from outside"}
        </Button>
      ) : null}

      <Bloom
        anchor={anchor}
        bounce={bounce}
        direction={direction}
        modal={!controlled}
        open={controlled ? open : undefined}
        onOpenChange={controlled ? setOpen : undefined}
        visualDuration={visualDuration}
      >
        {showBackdrop ? (
          <Bloom.Portal>
            <Bloom.Backdrop className="fixed inset-0 bg-foreground/10 backdrop-blur-[1px]" />
          </Bloom.Portal>
        ) : null}
        <Bloom.Container
          buttonSize={textTrigger ? { width: 88, height: 36 } : 36}
          menuWidth={192}
          menuRadius={12}
        >
          <Bloom.Trigger
            aria-label="Open Bloom menu"
            size={textTrigger ? "lg" : "icon-lg"}
            variant={textTrigger ? "secondary" : "outline"}
          >
            {textTrigger ? (
              "Actions"
            ) : (
              <MoreHorizontalIcon aria-hidden="true" />
            )}
          </Bloom.Trigger>

          <Bloom.Content>
            <Bloom.Group>
              <Bloom.Item onSelect={() => setSelected("Edit selected")}>
                <PencilIcon aria-hidden="true" />
                Edit
              </Bloom.Item>
              <Bloom.Item onSelect={() => setSelected("Copy selected")}>
                <CopyIcon aria-hidden="true" />
                Copy
              </Bloom.Item>
              {submenu ? (
                <Bloom.Sub id="share">
                  <Bloom.SubTrigger>
                    <ShareIcon aria-hidden="true" />
                    Share
                    <ChevronRightIcon className="ml-auto" aria-hidden="true" />
                  </Bloom.SubTrigger>
                  <Bloom.SubContent>
                    <Bloom.Group>
                      <Bloom.Item onSelect={() => setSelected("Link copied")}>
                        <LinkIcon aria-hidden="true" />
                        Copy link
                      </Bloom.Item>
                      <Bloom.Item
                        onSelect={() => setSelected("Email selected")}
                      >
                        <MailIcon aria-hidden="true" />
                        Email
                      </Bloom.Item>
                    </Bloom.Group>
                  </Bloom.SubContent>
                </Bloom.Sub>
              ) : null}
              <Bloom.Item
                disabled={disabledItem}
                onSelect={() => setSelected("Archive selected")}
              >
                <ArchiveIcon aria-hidden="true" />
                Archive
              </Bloom.Item>
            </Bloom.Group>

            {selectionControls ? (
              <>
                <Bloom.Separator />
                <Bloom.Group>
                  <Bloom.Label>Preferences</Bloom.Label>
                  <Bloom.Item
                    closeOnSelect={false}
                    onSelect={() => setNotifications((value) => !value)}
                  >
                    Notifications
                    {notifications ? <CheckIcon className="ml-auto" /> : null}
                  </Bloom.Item>
                </Bloom.Group>
                <Bloom.Separator />
                <Bloom.Group>
                  <Bloom.Label>Density</Bloom.Label>
                  <Bloom.Item
                    closeOnSelect={false}
                    onSelect={() => setDensity("compact")}
                  >
                    Compact
                    {density === "compact" ? (
                      <CheckIcon className="ml-auto" />
                    ) : null}
                  </Bloom.Item>
                  <Bloom.Item
                    closeOnSelect={false}
                    onSelect={() => setDensity("comfortable")}
                  >
                    Comfortable
                    {density === "comfortable" ? (
                      <CheckIcon className="ml-auto" />
                    ) : null}
                  </Bloom.Item>
                </Bloom.Group>
              </>
            ) : null}
          </Bloom.Content>
        </Bloom.Container>
      </Bloom>

      <output className="text-sm text-foreground" data-testid="result">
        {selected}
      </output>
      {controlled ? (
        <output className="text-sm text-foreground" data-testid="state">
          {open ? "Open" : "Closed"}
        </output>
      ) : null}
    </div>
  )
}
