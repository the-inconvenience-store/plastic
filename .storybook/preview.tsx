import type { Preview } from "@storybook/react-vite"
import { mswLoader } from "msw-storybook-addon/csf3"

import "../app/app.css"

const preview: Preview = {
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
  loaders: [mswLoader],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "error",
    },
  },
}

export default preview
