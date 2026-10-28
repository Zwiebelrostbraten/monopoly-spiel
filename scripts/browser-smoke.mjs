// Optional developer check. Playwright and Chromium are tooling, never shipped to players.
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
const url = process.env.GAME_URL || "http://127.0.0.1:8080/";
const click = (a) => page.locator(`[data-action="${a}"]:visible`).click();
const saved = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("stadtvermoegen-v1")));
async function fixture(config = {}) {
  await page.evaluate(async (config) => {
    const { createGame } = await import("./engine.js");
    const s = createGame(
      Array.from({ length: config.count || 3 }, (_, i) => ({
        name: ["Anna", "Ben", "Cleo", "David"][i],
        avatar: ["◆", "●", "▲", "★"][i],
      })),
      () => 0.4,
    );
    for (const [k, v] of Object.entries(config.state || {})) s[k] = v;
    for (const [i, values] of Object.entries(config.players || {}))
      Object.assign(s.players[i], values);
    for (const [i, values] of Object.entries(config.estates || {}))
      Object.assign(s.estates[i], values);
    localStorage.setItem("stadtvermoegen-v1", JSON.stringify(s));
  }, config);
  await page.reload();
  await page.evaluate(() => {
    let i = 0;
    Math.random = () => [0, 0.25][i++ % 2];
  });
}
try {
  await page.goto(url);
  await page.getByLabel("Personen am Spielbrett").selectOption("4");
  for (let i = 1; i <= 4; i++)
    await page
      .getByLabel("Name Person " + i)
      .fill(["Anna", "Ben", "Cleo", "David"][i - 1]);
  await page.getByRole("button", { name: /Spielabend beginnen/ }).click();
  assert.equal((await saved()).players.length, 4);
  assert.equal(await page.locator(".square").count(), 40);
  await page.getByRole("button", { name: "Spielregeln", exact: true }).click();
  assert.equal(await page.locator("#rules").evaluate((e) => e.open), true);
  await page.keyboard.press("Escape");
  // Real keyboard roll, purchase, explicit handover and rent.
  await fixture();
  await page.locator('[data-action="roll"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-action="buy"]');
  await click("buy");
  assert.equal((await saved()).estates[3].owner, 0);
  await click("end");
  await click("roll");
  await page.waitForSelector('[data-action="end"]');
  assert.equal((await saved()).players[0].cash, 1444);
  // Four-person round-robin auction including the person declining purchase.
  await fixture({ count: 4 });
  await click("roll");
  await page.waitForSelector('[data-action="decline"]');
  await click("decline");
  await page.locator("#bidAmount").fill("10");
  await page.locator("#bidForm button").click();
  await page.locator("#bidAmount").fill("20");
  await page.locator("#bidForm button").click();
  await click("pass");
  await click("pass");
  await click("pass");
  assert.equal((await saved()).estates[3].owner, 1);
  assert.equal((await saved()).players[1].cash, 1480);
  // Building, invalid uneven build, sales, mortgage and redemption.
  await fixture({ estates: { 1: { owner: 0 }, 3: { owner: 0 } } });
  await page.locator('.square[data-square="1"]').click();
  await page.locator('[data-manage="build"]').click();
  assert.equal((await saved()).estates[1].level, 1);
  await page.locator('[data-manage="build"]').click();
  assert.match(await page.locator("#toast").innerText(), /Gleichmäßig/);
  await page.locator('[data-manage="sellGroup"]').click();
  await page.locator('[data-manage="mortgage"]').click();
  assert.equal((await saved()).estates[1].mortgage, true);
  await page.locator('[data-manage="unmortgage"]').click();
  assert.equal((await saved()).estates[1].mortgage, false);
  await page.keyboard.press("Escape");
  // Trade UI checks consent, cash, properties and a held get-out card.
  await fixture({
    estates: { 1: { owner: 0 } },
    players: { 0: { cards: ["chance"] } },
  });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("stadtvermoegen-v1"));
    s.decks.chance = s.decks.chance.filter((i) => i !== 8);
    localStorage.setItem("stadtvermoegen-v1", JSON.stringify(s));
  });
  await page.reload();
  await click("openTrade");
  await page.locator('input[name="property0"][value="1"]').check();
  await page.locator('input[name="free0"]').check();
  await page.locator("#tradeCash1").fill("90");
  await page.locator('#tradeForm button[type="submit"]').click();
  assert.equal((await saved()).estates[1].owner, 0);
  await click("acceptTrade");
  assert.equal((await saved()).estates[1].owner, 1);
  assert.equal((await saved()).players[0].cash, 1590);
  assert.deepEqual((await saved()).players[1].cards, ["chance"]);
  // Immediate mortgage redemption choice after consent.
  await fixture({ estates: { 1: { owner: 0, mortgage: true } } });
  await click("openTrade");
  await page.locator('input[name="property0"][value="1"]').check();
  await page.locator('#tradeForm button[type="submit"]').click();
  await click("acceptTrade");
  await click("transferRedeem");
  assert.equal((await saved()).players[1].cash, 1467);
  assert.equal((await saved()).estates[1].mortgage, false);
  // A third jail miss pauses on the fine, then resumes exactly once after mortgaging.
  await fixture({
    players: { 0: { cash: 0, pos: 10, jail: 2 } },
    estates: { 39: { owner: 0 } },
  });
  await click("roll");
  await page.waitForSelector('[data-action="showDebtor"]');
  assert.equal((await saved()).players[0].pos, 10);
  await page.locator('.square[data-square="39"]').click();
  await page.locator('[data-manage="mortgage"]').click();
  assert.equal((await saved()).players[0].pos, 13);
  assert.equal((await saved()).phase, "buy");
  await page.keyboard.press("Escape");
  // Cards execute on confirmation, survive a reload and move to GO with salary.
  await fixture({
    state: {
      phase: "card",
      card: {
        deck: "chance",
        index: 0,
        text: "Auf nach LOS. Die Bank zahlt 200.",
      },
      queue: [
        { type: "applyCard", deck: "chance", index: 0, player: 0 },
        { type: "finish" },
      ],
    },
    players: { 0: { pos: 7 } },
  });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("stadtvermoegen-v1"));
    s.decks.chance = s.decks.chance.filter((i) => i !== 0);
    localStorage.setItem("stadtvermoegen-v1", JSON.stringify(s));
  });
  await page.reload();
  await click("ackCard");
  assert.equal((await saved()).players[0].cash, 1700);
  assert.equal((await saved()).players[0].pos, 0);
  // Final bankruptcy presents a real winner.
  await fixture({
    count: 2,
    state: {
      phase: "debt",
      debt: { type: "pay", from: 0, to: 1, amount: 2000, reason: "Miete" },
      queue: [
        { type: "pay", from: 0, to: 1, amount: 2000, reason: "Miete" },
        { type: "finish" },
      ],
    },
    players: { 0: { cash: 0 } },
  });
  await click("confirmBankrupt");
  await page.locator('#detail [data-action="bankrupt"]').click();
  assert.equal((await saved()).phase, "won");
  assert.match(await page.locator(".won").innerText(), /Ben/);
  // Responsive overview remains fully usable at 390 px and 320 px.
  await fixture({
    count: 4,
    estates: { 1: { owner: 0 }, 3: { owner: 0 }, 39: { owner: 1 } },
  });
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({
      path: process.env.SCREENSHOT_DIR + "/monopoly-desktop.png",
      fullPage: true,
    });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await click("explore");
    assert.equal(await page.locator(".field-list button").count(), 40);
    await page.locator('[data-field="39"]').click();
    assert.match(await page.locator("#detail").innerText(), /Schlossallee/);
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({
      path: process.env.SCREENSHOT_DIR + "/monopoly-mobile.png",
      fullPage: true,
    });
  // Persist an unfinished auction and return to exactly the same bidder.
  await fixture();
  await click("roll");
  await page.waitForSelector('[data-action="decline"]');
  await click("decline");
  await page.locator("#bidAmount").fill("10");
  await page.locator("#bidForm button").click();
  const before = await saved();
  await page.reload();
  assert.deepEqual((await saved()).auction, before.auction);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: setup 4 players, keyboard dice, buy/rent, auction, buildings, mortgage, consent trade/cards, transfer interest, jail debt, card movement, bankruptcy/win, save/reload, desktop/390/320 layouts. No console, page or HTTP errors.",
  );
} finally {
  await browser.close();
}
