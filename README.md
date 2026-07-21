# HTTP Header Manager

Chrome extension for modifying HTTP headers on requests made by the browser. Useful for
intercepting calls during development — for example forcing `Accept: application/json`
so an API returns JSON instead of XML.

> **This extension was developed by AI.** The code, UI, icons and tests in this
> repository were written by Claude. It has automated end-to-end tests against a
> real Chrome instance, but review it yourself before trusting it with anything
> that matters — it modifies every HTTP request the browser makes.

## Features

- Multiple rules, each individually toggled on or off
- Operations: **Add**, **Replace**, **Remove**
- Header name field with autocomplete for common headers, free text for nonstandard ones
- Delete button per rule
- Changes apply immediately — no save button
- Can be enabled for incognito windows
- Light / system / dark theme switcher, remembered between sessions

## Installation

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the **`src`** folder (not the repository
   root — Chrome expects `manifest.json` at the top of the folder you load)
4. To use it in incognito windows, open the extension's **Details** and enable
   **Allow in Incognito**

## Usage

Click the toolbar icon to open the panel, then **Add rule**. Each rule has a toggle, an
operation, a header name and a value. Active rules are applied to every request the
browser makes. Clicking outside the panel closes it; rules are persisted.

For `Remove`, the value field is disabled since the header is dropped entirely.

## How it works

Header modification uses the Manifest V3
[`declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
API. All enabled rules are collapsed into a single dynamic rule with one
`modifyHeaders` action, matching every URL and resource type. That keeps the extension
far below the dynamic rule quota regardless of how many rules exist.

Both **Add** and **Replace** map to declarativeNetRequest's `set` operation. Chrome only
permits its `append` operation for a small allowlist of headers that support multiple
values, so appending an arbitrary custom header is rejected outright — "add this header"
is therefore implemented as "set this header".

The extension itself lives in `src/`; everything outside it is tooling and metadata that
is not shipped.

```
src/                     the extension — this is the folder you load into Chrome
  manifest.json          MV3 manifest (incognito: spanning)
  rules.js               storage access, and translation into declarativeNetRequest rules
  background.js          service worker keeping dynamic rules in sync with storage
  theme.js               theme switcher, applied before first paint
  popup.html/.css/.js    the panel UI
  icons/                 generated, see tools/generate-icons.py
tools/
  test-extension.mjs     Playwright end-to-end tests against the real extension
  generate-icons.py      regenerates src/icons/ (needs Python + Pillow)
```

## Testing

The tests load the unpacked extension into a real Chrome instance and drive the actual
popup, because `chrome.storage` and `chrome.declarativeNetRequest` do not exist outside
an extension context:

```bash
npm install
npx playwright install chromium
npm test
```

They cover the rule lifecycle, operation switching, autocomplete, theme persistence, and
one live request against `httpbin.org` asserting a header really is rewritten.

Not covered by the automated tests: behaviour in incognito windows, and hover/focus
states. Those need a manual pass.

## Packaging for the Chrome Web Store

```bash
npm run build
```

This validates the manifest — required fields, and that every file it references
actually exists — then writes `dist/<name>-<version>.zip`. The archive holds the
contents of `src/` at its root, which is what the Web Store expects; a ZIP with
`manifest.json` nested inside a folder is rejected on upload.

Bump `version` in **both** `src/manifest.json` and `package.json` before building. The
Web Store refuses a version number it has already seen, and the build warns if the two
files disagree.

Upload the ZIP at the
[Developer Dashboard](https://chrome.google.com/webstore/devconsole). A one-time
registration fee applies, and a listing needs an icon, screenshots and a privacy
justification for the `declarativeNetRequest` and `<all_urls>` permissions.

## Limitations

- Only request headers are modified. Response headers are out of scope.
- Some headers are controlled by the browser and cannot be overridden by extensions.
- **Add** and **Replace** behave identically; both set the header value.
- Rules apply to every request the browser makes. There is no per-site or per-URL filter.

## License

[0BSD](LICENSE) — do whatever you like with it, no attribution required.

Copyright (c) 2026 Lukas Nespor
