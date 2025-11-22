# FlowRef

Fast DOI-based citation generator for academic research. Open-source, privacy-friendly citation tool supporting multiple styles with batch processing and PDF support.

## Features

**Core Functionality**
- Automatic DOI detection from web pages and PDF files
- Five citation styles: APA 7th, MLA 9th, Chicago 17th, IEEE, Vancouver
- In-text citations (parenthetical and narrative formats)
- BibTeX export for LaTeX users
- Batch processing for multiple DOIs or PDF files
- HTML formatting preservation for Word/Google Docs
- Context menu integration for quick citations

**Privacy & Performance**
- No tracking or analytics
- Local processing only
- Configurable metadata caching
- Automatic retry logic for API reliability

**Advanced Features**
- Settings page for customization
- Duplicate DOI detection in batch mode
- Retry failed entries functionality
- Book and article support

## Citation Styles

**Full Reference Citations**
- APA 7th Edition (social sciences)
- MLA 9th Edition (humanities)
- Chicago 17th Edition (notes-bibliography)
- IEEE (engineering and technology)
- Vancouver (medical and life sciences)
- BibTeX (LaTeX bibliography)

**In-Text Citations**
- APA: `(Smith, 2020)` and `Smith (2020)`
- MLA: `(Smith)` and `Smith`
- Chicago: `[1]` and `Smith[1]`
- IEEE: `[1]` and `Smith [1]`
- Vancouver: `(1)` and `Smith (1)`

## Browser Compatibility

- Firefox (Manifest V3)
- Chrome / Chromium
- Edge
- Other WebExtensions-compatible browsers

## Installation

### From Source

**Prerequisites**: Node.js and npm installed

```bash
# Clone repository
git clone https://github.com/Metanome/flowref.git
cd FlowRef

# Install dependencies
npm install

# Build for Firefox
build-firefox.bat

# Build for Chrome
build-chrome.bat
```

**Load in Browser**

Firefox: Navigate to `about:debugging` > "This Firefox" > "Load Temporary Add-on" > Select `dist/manifest.json`

Chrome: Navigate to `chrome://extensions/` > Enable "Developer mode" > "Load unpacked" > Select `dist` folder

## Usage

### Single Citation

1. Visit a page with a DOI or open the extension popup
2. DOI will be auto-detected (if enabled in settings) or enter manually
3. Select citation style (APA, MLA, Chicago, IEEE, Vancouver)
4. Click "Generate Citation"
5. Citation automatically copied to clipboard

### Batch Mode

1. Click "Open Batch Mode" link in popup
2. Enter multiple DOIs (one per line) or upload PDF files
3. Select citation style
4. Click "Process All"
5. Copy all citations or download as .bib file
6. Use "Retry Failed" button to reprocess any errors

### Context Menu

1. Select DOI text on any webpage
2. Right-click and choose "Generate Citation from DOI"
3. Popup opens with citation ready to copy

### Settings

Access via "Settings" link in popup or batch mode. Configure:
- Default citation style
- Auto-detect behavior
- Cache settings
- API retry behavior

## Technical Details

**API Integration**
- Primary: CrossRef REST API
- Fallback: DataCite API
- Configurable retry logic

**Formatting**
- HTML formatting preserved when pasting into Word/Google Docs
- Proper punctuation following official style guidelines
- Correct formatting for books and articles

**Architecture**
- TypeScript codebase compiled with esbuild
- Manifest V3 for Firefox and Chrome
- Local storage for settings and metadata cache
- Content script for PDF DOI extraction
- Background service worker for context menu integration

**Privacy & Security**
- No tracking, analytics, or telemetry
- No data stored on external servers
- All processing performed locally in browser
- Network requests only to public citation APIs
- Open source

## Development

### Build Commands

```bash
# Install dependencies
npm install

# Build for specific browser
build-firefox.bat
build-chrome.bat

# Development workflow
npm run watch    # Auto-rebuild on changes
npm run clean    # Clean build directory
```

### Project Structure

```
FlowRef/
├── src/
│   ├── popup/          # Main popup interface
│   ├── options/        # Batch mode page
│   ├── settings/       # Settings page
│   ├── background/     # Context menu and lifecycle
│   ├── content/        # PDF DOI detection
│   └── core/           # Citation formatting and metadata
├── icons/              # Extension icons
├── manifest.*.json     # Browser-specific manifests
└── dist/               # Build output
```

## Contributing

Contributions welcome. Please:
- Follow existing code style
- Test in both Firefox and Chrome
- Update documentation as needed
- Submit pull requests to main branch

## Support

Report issues or request features on GitHub: https://github.com/Metanome/flowref
