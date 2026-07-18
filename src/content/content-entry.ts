import type { PlatformAdapter } from "../adapters/adapter-contract";
import { createBrowserApi } from "../browser/browser-api";
import { createEcoWidget } from "../widget/eco-widget";
import { ContentController } from "./content-controller";

export async function startContentScript(adapter: PlatformAdapter): Promise<ContentController> {
  const controller = new ContentController({
    document,
    adapter,
    api: createBrowserApi(),
    createWidget: () => createEcoWidget(document),
  });
  await controller.start();
  return controller;
}
