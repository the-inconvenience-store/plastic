import { defineStoryFactory } from "@fumadocs/story/vite/client"
import type { StoryOptions } from "@fumadocs/story/vite/client"

import { StoryPreview } from "@/components/story-preview"

const storyFactory = defineStoryFactory()
type StoryComponent = Parameters<
  typeof storyFactory.defineStory
>[0]["Component"]

type StoryWithSourceOptions<C extends StoryComponent> = StoryOptions<C> & {
  filename: string
  source: string
}

export function defineStory<C extends StoryComponent>({
  filename,
  source,
  ...options
}: StoryWithSourceOptions<C>) {
  const story = storyFactory.defineStory(options)

  return {
    ...story,
    WithPreview: () => {
      const WithControl = story.WithControl

      return (
        <StoryPreview filename={filename} source={source}>
          <WithControl />
        </StoryPreview>
      )
    },
  }
}
