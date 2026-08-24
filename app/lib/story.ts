import { defineStoryFactory } from "@fumadocs/story/vite/client"
import type { StoryOptions } from "@fumadocs/story/vite/client"
import { createElement, type FC } from "react"

import { StoryPreview } from "@/components/story-preview"

const storyFactory = defineStoryFactory()

type StoryWithSourceOptions<C extends FC<any>> = StoryOptions<C> & {
  filename: string
  source: string
}

export function defineStory<C extends FC<any>>({
  filename,
  source,
  ...options
}: StoryWithSourceOptions<C>) {
  const story = storyFactory.defineStory(options)

  return {
    ...story,
    WithPreview: () =>
      createElement(StoryPreview, {
        children: createElement(story.WithControl),
        filename,
        source,
      }),
  }
}
