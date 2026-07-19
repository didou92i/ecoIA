import { expect, test } from "./extension.fixture";

test("limite les rendus en flux et observe uniquement la conversation", async ({
  extensionPage,
}) => {
  test.info().annotations.push({
    type: "unit-coverage",
    description:
      "La lecture unique du contexte par tour est instrumentée dans tests/unit/content-controller.test.ts.",
  });
  await extensionPage.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) throw new Error("MISSING_CONVERSATION_ROOT");
    const stop = document.createElement("button");
    stop.type = "button";
    stop.dataset.testid = "stop-button";
    stop.textContent = "Arrêter";
    main.append(stop);
  });
  await extensionPage.waitForTimeout(600);
  await extensionPage.evaluate(() => {
    const output = document
      .querySelector("eco-ia-widget")
      ?.shadowRoot?.querySelector("[data-output-tokens]");
    if (!output) throw new Error("MISSING_OUTPUT_METRIC");
    (window as typeof window & { __ecoiaRenderTimes?: number[] }).__ecoiaRenderTimes = [];
    new MutationObserver(() => {
      (window as typeof window & { __ecoiaRenderTimes: number[] }).__ecoiaRenderTimes.push(
        performance.now(),
      );
    }).observe(output, { characterData: true, childList: true, subtree: true });
  });

  await extensionPage.evaluate(() => {
    const outside = document.querySelector("#outside-conversation");
    if (!outside) throw new Error("MISSING_OUTSIDE_AREA");
    for (let index = 0; index < 100; index += 1) outside.textContent = `Bruit externe ${index}`;
  });
  await extensionPage.waitForTimeout(600);
  const rendersAfterOutsideNoise = await extensionPage.evaluate(
    () => (window as typeof window & { __ecoiaRenderTimes?: number[] }).__ecoiaRenderTimes?.length,
  );
  expect(rendersAfterOutsideNoise).toBe(0);

  await extensionPage.evaluate(async () => {
    const answer = document.querySelector<HTMLElement>("[data-answer]");
    if (!answer) throw new Error("MISSING_SYNTHETIC_ANSWER");
    for (let index = 0; index < 24; index += 1) {
      answer.textContent += ` segment synthétique ${index} avec plusieurs mots`;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  });
  await extensionPage.waitForTimeout(700);
  const renderTimes = await extensionPage.evaluate(
    () => (window as typeof window & { __ecoiaRenderTimes?: number[] }).__ecoiaRenderTimes ?? [],
  );
  expect(renderTimes.length).toBeGreaterThan(0);
  const maximumRendersInOneSecond = renderTimes.reduce((maximum, startTime) => {
    const renders = renderTimes.filter((time) => time >= startTime && time < startTime + 1_000);
    return Math.max(maximum, renders.length);
  }, 0);
  expect(maximumRendersInOneSecond).toBeLessThanOrEqual(2);
});
