# Clipoline

A Chrome extension that captures web pages in various formats and sends them to different destinations.

## Features

- Extract content from the current tab (HTML, text) and upload directly to Google Drive
- More destinations coming soon!

## Development Setup

### Prerequisites

- Node.js (v22 or later)
- pnpm (v10 or later)
- Google Cloud Platform account (for Google Drive integration)

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   pnpm install
   ```

### Google Drive Integration Setup

To enable Google Drive integration, you need to:

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Drive API
3. Create OAuth 2.0 credentials for a Chrome extension
4. Update the manifest.json file with your credentials:
   - Replace `${YOUR_CLIENT_ID}` with your actual client ID
   - Replace `${YOUR_EXTENSION_KEY}` with your extension key

For detailed instructions, see the [Chrome Extension OAuth Guide](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth).

### Development Workflow

- Build the extension for production:
  ```
  pnpm run build
  ```

- Start the development server:
  ```
  pnpm run dev
  ```

- Preview the production build:
  ```
  pnpm run preview
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

## Usage

1. Click on the extension icon in your browser toolbar
2. Click "Extract & Upload to Google Drive" to extract the content from the current tab and upload it directly to your Google Drive
3. The extension will request permission to access your Google Drive the first time you use this feature

## License

See the LICENSE file for details.

