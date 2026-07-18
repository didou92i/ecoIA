import type { PlatformAdapter } from "../adapters/adapter-contract";
import { createBrowserApi } from "../browser/browser-api";
import { type EcoIaWidgetElement, registerEcoWidget } from "../widget/eco-widget";
import { ContentController } from "./content-controller";

export async function startContentScript(adapter: PlatformAdapter): Promise<ContentController> {
  registerEcoWidget();
  const controller = new ContentController({
    document,
    adapter,
    api: createBrowserApi(),
    createWidget: () => document.createElement("eco-ia-widget") as EcoIaWidgetElement,
  });
  await controller.start();
  return controller;
}
