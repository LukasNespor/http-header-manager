// End-to-end tests for the extension.
// Not part of the extension; run manually with Node + Playwright installed.
//
// Setup (once):
//   npm install -D playwright
//   npx playwright install chromium
//
// Run:
//   node tools/test-extension.mjs
//
// Loads the real unpacked extension via --load-extension and drives the actual
// popup page (chrome-extension://<id>/popup.html). It has to be the real
// extension page — chrome.storage and chrome.declarativeNetRequest do not exist
// on a file:// or localhost page, so the popup would not render at all.

import { chromium } from "playwright";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "..", "src");
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hhm-test-"));

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? `: ${detail}` : ""}`);
}

async function getExtensionId(context) {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 10000 });
  return sw.url().split("/")[2];
}

async function openPopup(context, extensionId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  return page;
}

async function main() {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const extensionId = await getExtensionId(context);
    console.log(`Extension loaded as ${extensionId}`);

    // 1. Rule lifecycle
    {
      let page = await openPopup(context, extensionId);
      await page.click("#add");
      await page.fill("[data-field='header']", "X-Test");
      await page.fill("[data-field='value']", "hello");
      await page.waitForTimeout(200); // let the input handler persist to storage
      await page.close();

      page = await openPopup(context, extensionId);
      const headerVal = await page.inputValue("[data-field='header']");
      const valueVal = await page.inputValue("[data-field='value']");
      record(
        "1a. rule persists across popup close/reopen",
        headerVal === "X-Test" && valueVal === "hello",
        `header=${headerVal} value=${valueVal}`
      );

      await page.click(".toggle__track"); // native checkbox is visually hidden under a styled label
      await page.waitForTimeout(200);
      await page.close();

      page = await openPopup(context, extensionId);
      const enabledAfterToggle = await page.isChecked("[data-field='enabled']");
      const rowDisabledClass = await page.getAttribute(".row", "class");
      record(
        "1b. toggle-off persists across popup close/reopen",
        enabledAfterToggle === false,
        `checked=${enabledAfterToggle} rowClass=${rowDisabledClass}`
      );

      await page.click("[data-action='delete']");
      await page.waitForTimeout(200);
      await page.close();

      page = await openPopup(context, extensionId);
      const emptyVisible = await page.isVisible("#empty");
      const rowCount = await page.locator(".row").count();
      record(
        "1c. delete persists across popup close/reopen",
        emptyVisible === true && rowCount === 0,
        `emptyVisible=${emptyVisible} rowCount=${rowCount}`
      );
      await page.close();
    }

    // 2. Operation switching
    {
      const page = await openPopup(context, extensionId);
      await page.click("#add");
      const valueField = page.locator("[data-field='value']");
      const disabledBefore = await valueField.isDisabled();
      const placeholderBefore = await valueField.getAttribute("placeholder");

      await page.selectOption("[data-field='operation']", "remove");
      const disabledAfterRemove = await valueField.isDisabled();
      const placeholderAfterRemove = await valueField.getAttribute("placeholder");

      await page.selectOption("[data-field='operation']", "add");
      const disabledAfterAdd = await valueField.isDisabled();
      const placeholderAfterAdd = await valueField.getAttribute("placeholder");

      record(
        "2. operation=remove disables value field and restores on switch back",
        disabledBefore === false &&
          disabledAfterRemove === true &&
          placeholderAfterRemove === "—" &&
          disabledAfterAdd === false &&
          placeholderAfterAdd === "application/json",
        `before(disabled=${disabledBefore},ph=${placeholderBefore}) remove(disabled=${disabledAfterRemove},ph=${placeholderAfterRemove}) add(disabled=${disabledAfterAdd},ph=${placeholderAfterAdd})`
      );

      await page.click("[data-action='delete']");
      await page.waitForTimeout(200);
      await page.close();
    }

    // 3. Rules actually apply, against a real request
    {
      const page = await openPopup(context, extensionId);
      await page.click("#add");
      await page.fill("[data-field='header']", "X-Test");
      await page.fill("[data-field='value']", "hello");
      await page.waitForTimeout(300);
      await page.close();

      const testPage = await context.newPage();
      await testPage.goto("https://httpbin.org/headers");
      const bodyOn = await testPage.textContent("body");
      const jsonOn = JSON.parse(bodyOn);
      const headerPresentOn = jsonOn.headers && jsonOn.headers["X-Test"] === "hello";
      record(
        "3a. enabled rule adds X-Test header to real request",
        headerPresentOn,
        `headers.X-Test=${jsonOn.headers && jsonOn.headers["X-Test"]}`
      );

      const popup2 = await openPopup(context, extensionId);
      await popup2.click(".toggle__track");
      await popup2.waitForTimeout(300);
      await popup2.close();

      await testPage.goto("https://httpbin.org/headers");
      const bodyOff = await testPage.textContent("body");
      const jsonOff = JSON.parse(bodyOff);
      const headerAbsentOff = !jsonOff.headers || jsonOff.headers["X-Test"] === undefined;
      record(
        "3b. disabling the rule removes X-Test from real request",
        headerAbsentOff,
        `headers.X-Test=${jsonOff.headers && jsonOff.headers["X-Test"]}`
      );

      await testPage.close();

      const cleanup = await openPopup(context, extensionId);
      await cleanup.click("[data-action='delete']");
      await cleanup.waitForTimeout(200);
      await cleanup.close();
    }

    // 6. Autocomplete
    {
      const page = await openPopup(context, extensionId);
      await page.click("#add");
      const header = page.locator("[data-field='header']");
      await header.fill("Acc");
      const options = await page.$$eval("#header-names option", (opts) =>
        opts.map((o) => o.value)
      );
      const matches = options.filter((o) => o.toLowerCase().startsWith("acc"));
      record(
        "6. datalist contains Acc*-prefixed suggestions",
        matches.length > 0,
        `matches=${JSON.stringify(matches)}`
      );
      await page.click("[data-action='delete']");
      await page.waitForTimeout(200);
      await page.close();
    }

    // 5. Theme persistence
    {
      let page = await openPopup(context, extensionId);
      await page.click("[data-theme-value='light']");
      await page.waitForTimeout(200);
      await page.close();

      page = await openPopup(context, extensionId);
      const theme = await page.getAttribute("html", "data-theme");
      const pressedLight = await page.getAttribute(
        "[data-theme-value='light']",
        "aria-pressed"
      );
      record(
        "5. theme selection (light) persists across popup reopen",
        theme === "light" && pressedLight === "true",
        `data-theme=${theme} light-pressed=${pressedLight}`
      );
      await page.close();
    }
  } catch (err) {
    console.error("Test run crashed:", err);
    record("run", false, String(err));
  } finally {
    await context.close();
  }

  console.log("\nSummary:");
  for (const r of results) console.log(`  ${r.pass ? "PASS" : "FAIL"} — ${r.name}`);
  const failed = results.filter((r) => !r.pass);
  process.exit(failed.length ? 1 : 0);
}

main();
