# FlowRef

A modern, professional citation generator for academic research. Generate accurate citations from DOIs with support for thousands of styles, batch processing, and PDF extraction.

## Features

**Modern Interface**
- Color-coded visual feedback for status and validation
- Real-time DOI and URL validation with professional messaging
- Searchable style picker with access to thousands of CSL styles

**Core Functionality**
- Automatic DOI detection from web pages and PDF documents
- Full CSL repository support (APA, MLA, Chicago, Harvard, IEEE, Vancouver, and thousands more)
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
- Dedicated settings page for customization
- Duplicate DOI detection in batch mode
- Retry failed entries functionality
- Support for books, articles, and other publication types

## Citation Styles

FlowRef supports the full CSL (Citation Style Language) repository, providing access to thousands of academic citation styles.

**Popular Styles (Pre-loaded)**
- APA 7th Edition
- MLA 9th Edition
- Chicago 17th Edition
- Harvard
- IEEE
- Vancouver
- More...

**Style Search**
- Search for specific journal styles (e.g., Nature, Science, PLOS ONE)
- Browse by category (Psychology, Medicine, Engineering, etc.)
- Your preferred style is saved automatically across all pages

**Output Formats**
- Full reference (formatted bibliography entry)
- In-text parenthetical: `(Smith, 2020)`
- In-text narrative: `Smith (2020)`
- BibTeX entry for LaTeX

## Browser Compatibility

- Firefox
- Chrome / Chromium
- Edge
- Other WebExtensions-compatible browsers

## Installation

### Firefox (Recommended)

Install directly from [Firefox Add-ons](https://addons.mozilla.org/en-GB/firefox/addon/flowref/)

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
2. DOI is auto-detected (indicated by green status bar) or enter manually
3. Select citation style from the searchable dropdown
4. Click "Format"
5. Citation is generated and automatically copied to clipboard

### Batch Mode

1. Click "Open Batch Mode" in the popup footer
2. Use the Text tab to paste multiple DOIs (one per line)
3. Use the PDF tab to drag and drop PDF files
4. Select citation style
5. Click "Process All"
6. Copy all citations or download as .bib file

### Context Menu

1. Select DOI text or link on any webpage
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
- Modular component system (StylePicker, StatusBar)
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
│   └── core/           # Shared components, formatters, and utilities
│       ├── stylePicker.ts   # Searchable style dropdown component
│       ├── cslRepository.ts # CSL style fetching and caching
│       └── formatters/      # CSL and BibTeX formatting
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
