import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Exercise the real React components in a browser with synthetic action responses.
// Database/RLS/RPC behavior is covered separately by address-verification.test.mjs.
await test("browser: warning selection, restoration, pagination, printing, and address status controls", async () => {
  const fixtures = `
    export const devotee = { id:'00000000-0000-4000-8000-000000000010', devoteeNo:'KDP-DEV-000010', fullName:'Synthetic Devotee', phone:null,
      addressLine1:'Synthetic test address', city:'Test City', state:'Test State', postalCode:'000000', poojaCount:3, primaryAddressPoojaCount:2,
      addressVerificationStatus:'verified', hasException:false, createdAt:'2026-11-21T00:00:00Z', modifiedAt:'2026-11-21T00:00:00Z' };
    export const pooja = { enrollmentId:'00000000-0000-4000-8000-000000000020',poojaNo:'KDP-SP-2111-0001',devoteeId:devotee.id,devoteeNo:devotee.devoteeNo,sponsorName:devotee.fullName,beneficiaryName:devotee.fullName,relation:'Self',phone:null,annualMonth:11,annualDay:21,leapDayPolicy:'feb_28',addressMode:'custom',addressLine:'Custom synthetic address',addressCity:'Test City',addressState:'Test State',postalCode:'000000',addressVerificationStatus:'verified',status:'active',feeMinor:100000,currency:'INR',enrollmentDate:'2026-11-21',createdAt:devotee.createdAt,modifiedAt:devotee.modifiedAt };
    export const recipients = Array.from({length:17},(_,i)=>({id:String(i),name:'Synthetic Recipient '+i,phone:null,addressLine:'ಪರೀಕ್ಷಾ ವಿಳಾಸ '.repeat(4),city:'Test City',state:'Test State',postalCode:'000000',addressVerificationStatus:i===1||i===15?'unverified':'verified'}));
  `;
  const bundle = await build({
    stdin: {
      contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {LabelGenerator} from './frontend/components/labels/LabelGenerator';
      import {DevoteeEditor} from './frontend/components/devotees/DevoteeDirectory';
      import {PoojaRegister} from './frontend/components/poojas/PoojaRegister';
      import {devotee, pooja, recipients} from 'test-fixtures';
      const component = location.pathname==='/devotee'
        ? <DevoteeEditor row={devotee} onClose={()=>{}} onSave={row=>{window.savedDevotee=row;}} />
        : location.pathname==='/poojas' ? <PoojaRegister initialPage={{items:[pooja],total:1}} initialCalendarCounts={{21:1}} devotees={[devotee]} beneficiaries={[]} initialDate="2026-11-21" />
        : <LabelGenerator initialRecipients={recipients} initialDate="2026-11-21" />;
      window.print=()=>{window.printCalled=true;};
      createRoot(document.getElementById('root')).render(component);
    `,
      loader: "jsx",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"' },
    tsconfig: "frontend/tsconfig.json",
    plugins: [
      {
        name: "synthetic-actions",
        setup(plugin) {
          plugin.onResolve({ filter: /^next\/link$/ }, () => ({
            path: "link",
            namespace: "test",
          }));
          plugin.onResolve({ filter: /^test-fixtures$/ }, () => ({
            path: "fixtures",
            namespace: "test",
          }));
          plugin.onResolve(
            { filter: /^@\/app\/(labels|devotees|poojas)\/actions$/ },
            (args) => ({ path: args.path, namespace: "test" }),
          );
          plugin.onLoad({ filter: /.*/, namespace: "test" }, (args) => ({
            contents:
              args.path === "fixtures"
                ? fixtures
                : args.path === "link"
                  ? `import React from 'react';export default function Link(props){return React.createElement('a',props,props.children);}`
                  : `
        import {devotee,pooja,recipients} from 'test-fixtures';
        export async function loadDevoteeProfile(){return devotee;}
        export async function loadPoojaRegister(){return {items:[pooja],total:1};}
        export async function loadPoojaCalendar(){return {21:1};}
        export async function loadBeneficiaries(){return [];}
        export async function searchDevotees(){return [devotee];}
        export async function archivePooja(){return {ok:true};}
        export async function savePooja(input){window.savedPoojaInput=input;return {ok:true,pooja:{...pooja,addressVerificationStatus:input.customAddressVerificationStatus,addressVerificationReason:input.customAddressVerificationReason}};}
        export async function getLabelsForDate(){await new Promise(r=>setTimeout(r,100));if(window.rejectLabels)throw new Error('Synthetic failure');return recipients;}
        export async function getInvitationLabels(){return recipients;}
        export async function loadDevoteeDirectory(){return {items:[devotee],total:1,allTotal:1,letterCounts:{S:1}};}
        export async function loadDevoteePoojaDates(){return [];}
        export async function saveDevotee(input){window.savedDevoteeInput=input;return {ok:true,devotee:{...devotee,...input}};}
      `,
            loader: "js",
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  const css = (
    await Promise.all(
      ["frontend/app/globals.css", "frontend/app/dashboard.css"].map((file) =>
        readFile(resolve(file), "utf8"),
      ),
    )
  )
    .join("\n")
    .replace('@import "tailwindcss";', "");
  const server = createServer((request, response) => {
    if (request.url === "/bundle.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(bundle.outputFiles[0].text);
    } else if (request.url === "/style.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(css);
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>',
      );
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url + "/labels");
    await page
      .getByRole("button", { name: "Print 17 Labels", exact: true })
      .waitFor();
    assert.equal(await page.locator(".courier-label.is-unverified").count(), 2);
    assert.equal(
      await page.locator(".label-verification-warning").first().isVisible(),
      true,
    );
    const border = await page
      .locator(".courier-label.is-unverified")
      .first()
      .evaluate((el) => getComputedStyle(el).borderColor);
    assert.equal(border, "rgb(150, 59, 36)");
    await page
      .getByRole("button", {
        name: "Remove label for Synthetic Recipient 1",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Print 16 Labels", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Exclude all unverified", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Print 15 Labels", exact: true })
      .waitFor();
    assert.equal(await page.locator(".courier-label.is-unverified").count(), 0);
    assert.equal(await page.locator(".a4-label-sheet").count(), 1);
    await page
      .getByRole("button", { name: "Restore removed", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Print 17 Labels", exact: true })
      .waitFor();
    assert.equal(await page.locator(".a4-label-sheet").count(), 2);
    await page
      .getByRole("button", { name: "Show label page 2", exact: true })
      .click();
    assert.equal(
      await page
        .locator(".a4-label-sheet.is-visible .label-verification-warning")
        .isVisible(),
      true,
    );
    await page.emulateMedia({ media: "print" });
    assert.equal(
      await page.locator(".label-verification-warning").first().isVisible(),
      false,
    );
    assert.equal(
      await page.locator(".a4-label-sheet").first().isVisible(),
      true,
    );
    await page.emulateMedia({ media: "screen" });
    await page
      .getByRole("button", { name: "Print 17 Labels", exact: true })
      .click();
    assert.equal(await page.evaluate(() => window.printCalled), true);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page
        .getByRole("button", { name: "Exclude all unverified", exact: true })
        .isVisible(),
      true,
    );
    await page.evaluate(() => {
      window.rejectLabels = true;
    });
    await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Print 17 Labels", exact: true })
        .isDisabled(),
      true,
    );

    await page.goto(url + "/devotee");
    await page.getByRole("button", { name: /Address$/ }).click();
    const select = page.getByLabel("Address verification", { exact: true });
    assert.equal(await select.inputValue(), "verified");
    await select.selectOption("unverified");
    await page
      .getByLabel("Verification reason (optional)", { exact: true })
      .fill("Courier returned");
    assert.ok(
      await page
        .getByText("used by 2 active poojas.", { exact: false })
        .count(),
    );
    await page.getByRole("button", { name: /Review$/ }).click();
    assert.equal(
      await page.getByText("Unverified", { exact: true }).isVisible(),
      true,
    );
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Save Profile", exact: true })
      .click();
    await page.waitForFunction(() => window.savedDevoteeInput);
    assert.equal(
      await page.evaluate(
        () => window.savedDevoteeInput.addressVerificationStatus,
      ),
      "unverified",
    );
    assert.equal(
      await page.evaluate(
        () => window.savedDevoteeInput.addressVerificationReason,
      ),
      "Courier returned",
    );
    await page.goto(url + "/poojas");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: /Address$/ }).click();
    await page
      .getByLabel("Address verification", { exact: true })
      .selectOption("unverified");
    await page
      .getByLabel("Verification reason (optional)", { exact: true })
      .fill("Custom courier returned");
    await page.getByRole("button", { name: /Review$/ }).click();
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Save Changes", exact: true })
      .click();
    await page.waitForFunction(() => window.savedPoojaInput);
    assert.equal(
      await page.evaluate(
        () => window.savedPoojaInput.customAddressVerificationStatus,
      ),
      "unverified",
    );
    assert.equal(
      await page.evaluate(
        () => window.savedPoojaInput.customAddressVerificationReason,
      ),
      "Custom courier returned",
    );
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
