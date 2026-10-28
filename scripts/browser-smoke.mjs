// Optional developer check. Playwright and Chromium are tooling, never shipped to players.
import assert from "node:assert/strict";
import { checkGeometry } from "./ui-geometry.mjs";
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
  await checkGeometry(page, "injected gameplay fixture");
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
  // Selecting an occupied figure swaps it without losing names or focus.
  await page
    .getByRole("button", { name: "Auto, Person 1", exact: true })
    .click();
  assert.equal(
    await page
      .locator('[data-person="0"][data-figure="car"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await page
      .locator('[data-person="1"][data-figure="dog"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.getByLabel("Name Person 1").inputValue(), "Anna");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.ok(
      await page.locator(".figure-choice").evaluateAll((buttons) =>
        buttons.every((b) => {
          const r = b.getBoundingClientRect();
          return r.width >= 44 && r.height >= 44 && b.querySelector("svg");
        }),
      ),
    );
  }
  await page.getByRole("button", { name: /Spielabend beginnen/ }).click();
  assert.deepEqual(
    (await saved()).players.map((p) => p.avatar),
    ["car", "dog", "hat", "ship"],
  );
  assert.equal((await saved()).players.length, 4);
  assert.equal(await page.locator(".square").count(), 40);
  await page.getByRole("button", { name: "Spielregeln", exact: true }).click();
  assert.equal(await page.locator("#rules").evaluate((e) => e.open), true);
  await page.keyboard.press("Escape");
  // Legacy saves must remain byte-for-byte intact on load; rendering is display-only.
  for (const position of [0, 1]) {
    await fixture({
      count: 4,
      players: Object.fromEntries(
        [0, 1, 2, 3].map((i) => [i, { pos: position }]),
      ),
    });
    const beforeLegacy = await page.evaluate(() =>
      localStorage.getItem("stadtvermoegen-v1"),
    );
    await page.reload();
    assert.equal(
      await page.evaluate(() => localStorage.getItem("stadtvermoegen-v1")),
      beforeLegacy,
    );
    for (const width of [1440, 1024, 1000, 820, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const figures = page.locator(`.square[data-square="${position}"] .token`);
      assert.equal(await figures.count(), 4);
      assert.deepEqual(
        await figures
          .locator("svg")
          .evaluateAll((es) => es.map((e) => e.dataset.avatar)),
        ["dog", "car", "hat", "ship"],
      );
      assert.ok(
        await figures.evaluateAll((es) => {
          const rs = es.map((e) => e.getBoundingClientRect());
          return (
            new Set(es.map((e) => getComputedStyle(e).borderColor)).size ===
              4 &&
            rs.every(
              (r, i) =>
                r.width >= 12 &&
                r.height >= 12 &&
                rs.every(
                  (q, j) =>
                    i === j ||
                    r.right <= q.left ||
                    q.right <= r.left ||
                    r.bottom <= q.top ||
                    q.bottom <= r.top,
                ),
            )
          );
        }),
      );
      assert.ok(await figures.evaluateAll(es=>es.every(e=>{
        const r=e.getBoundingClientRect(), cell=e.closest('.square').getBoundingClientRect();
        return r.left>=cell.left && r.right<=cell.right && r.top>=cell.top && r.bottom<=cell.bottom;
      })), `crowded figures must stay inside their field at ${width}px`);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      if (
        process.env.SCREENSHOT_DIR &&
        position === 1 &&
        [1440, 320].includes(width)
      )
        await page.screenshot({
          path: `${process.env.SCREENSHOT_DIR}/figures-crowded-${width}.png`,
          fullPage: true,
        });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
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
  // Declining leaves the deed in the bank for all table sizes.
  for (const count of [2,3,4]) {
    await fixture({ count }); await click("roll");
    await page.waitForSelector('[data-action="decline"]'); await click("decline");
    assert.equal((await saved()).estates[3].owner,null);
    assert.equal((await saved()).players[0].cash,1500);
    assert.equal((await saved()).phase,"end");
    assert.doesNotMatch(await page.locator("body").innerText(), /versteig|auktion|gebäudewettbewerb/i);
  }
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
  // Fundraising during an accepted mortgage trade must preserve the transfer choice.
  for (const decision of ["transferKeep", "transferRedeem"]) {
    for (const recipientCash of [1500, 0]) {
      const debt = {
        type: "pay",
        from: 0,
        to: 2,
        amount: 100,
        reason: "Miete",
      };
      await fixture({
        state: { phase: "debt", debt, queue: [debt, { type: "finish" }] },
        players: { 0: { cash: 0 }, 1: { cash: recipientCash } },
        estates: {
          1: { owner: 0, mortgage: true },
          39: { owner: 0 },
          37: { owner: 1 },
        },
      });
      await click("openTrade");
      await page.locator('input[name="property0"][value="1"]').check();
      await page.locator('#tradeForm button[type="submit"]').click();
      await click("acceptTrade");
      assert.equal((await saved()).phase, "transfer");
      await page.locator('.square[data-square="39"]').click();
      await page.locator('[data-manage="mortgage"]').click();
      let s = await saved();
      assert.equal(s.phase, "transfer");
      assert.equal(s.transfer.player, 1);
      assert.deepEqual(s.debt, debt);
      assert.equal(s.players[2].cash, 1500);
      await page.keyboard.press("Escape");
      // Save/reload must keep the same unresolved decision.
      await page.reload();
      await click(decision);
      if (recipientCash === 0) {
        s = await saved();
        assert.equal(s.phase, "debt");
        assert.equal(s.debt.from, 1);
        assert.equal(s.transfer, null);
        await page.locator('.square[data-square="37"]').click();
        await page.locator('[data-manage="mortgage"]').click();
        await page.keyboard.press("Escape");
      }
      s = await saved();
      assert.equal(s.phase, "end");
      assert.equal(s.transfer, null);
      assert.equal(s.debt, null);
      assert.equal(s.players[0].cash, 100);
      assert.equal(
        s.players[1].cash,
        (recipientCash || 175) - (decision === "transferKeep" ? 3 : 33),
      );
      assert.equal(s.players[2].cash, 1600);
      assert.equal(s.estates[1].mortgage, decision === "transferKeep");
      assert.deepEqual(s.queue, []);
    }
  }
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
  assert.equal((await saved()).players[0].cash, 1900);
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
  // Actual saves generated by bbcba7d engine actions, before bid award.
  for (const name of ["deed","building","bankruptcy"]) {
    const old = await (await page.request.get(url + `tests/fixtures/legacy-${name}.json`)).json();
    await page.evaluate(s=>localStorage.setItem("stadtvermoegen-v1",JSON.stringify(s)),old);
    await page.reload();const migrated=await saved();
    assert.equal(migrated.auction,null);assert.equal(migrated.phase,name==="building"?"roll":"end");
    for(const key of ["players","estates","decks","houses","hotels","dice","current","extra"])assert.deepEqual(migrated[key],old[key]);
    assert.doesNotMatch(await page.locator("body").innerText(),/versteig|auktion|gebäudewettbewerb/i);
    await page.reload();assert.deepEqual(await saved(),migrated);
  }
  // Real dice interaction lands directly on LOS, on desktop and mobile.
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});await fixture({players:{0:{pos:37}}});await click("roll");await page.waitForSelector('[data-action="end"]');
    assert.equal((await saved()).players[0].pos,0);assert.equal((await saved()).players[0].cash,1900);
    const direct=await saved();await page.reload();assert.deepEqual(await saved(),direct);await click("end");assert.equal((await saved()).players[0].cash,1900);
  }
  // Also exercise actual animation and interruption: the result is saved before the shake.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await fixture();
  await click("roll");
  assert.equal((await saved()).players[0].pos, 3);
  assert.equal(await page.locator(".die.rolling").count(), 2);
  await page.waitForFunction(
    () => !document.querySelector('[data-action="buy"]').disabled,
  );
  assert.equal(
    await page.locator('.square[data-square="3"] .token').count(),
    1,
  );
  await fixture();
  await click("roll");
  const duringShake = await saved();
  await page.reload();
  assert.deepEqual((await saved()).dice, duringShake.dice);
  assert.equal((await saved()).phase, "buy");
  assert.equal(
    (await saved()).log.filter((l) => l.includes("würfelt")).length,
    1,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: pictorial setup and swaps, 44px targets, unchanged legacy saves, four crowded figures contained in their field at 7 widths, setup 4 players, keyboard dice, buy/rent, decline, legacy migration, direct LOS, buildings, mortgage, consent trade/cards, transfer interest and debt precedence (4 variants with reload), jail debt, card movement, bankruptcy/win, save/reload during animation, desktop/390/320 layouts. No console, page or HTTP errors.",
  );
} finally {
  await browser.close();
}
