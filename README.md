# 📎🤸Clipoline

A Chrome extension that captures web pages in various formats and sends them to different destinations.

## Features

- Extracts content from the current tab and uploads it as text, Markdown, or PDF
- Supports Google Drive and NotebookLM as destinations

## Development Setup

### Prerequisites

- Node.js (v22 or later)
- pnpm (v10 or later)

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   pnpm install
   ```

### Development Workflow

- Build the extension for production:
  ```
  pnpm run build
  ```

- Type check without emitting files:
  ```
  pnpm run type-check
  ```

- Run all checks (formatting and linting):
  ```
  pnpm run check
  ```

- Fix all issues automatically:
  ```
  pnpm run check:fix
  ```
- Archive the Chrome extension:
  ```
  pnpm run dist
  ```

## License

MIT

## Author

moznion (<moznion@mail.moznion.net>)

