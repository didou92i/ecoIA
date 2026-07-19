import territoriaHeadDataUri from "./assets/territoria-head-48.webp";

export function createBrandMark(): HTMLImageElement {
  const image = document.createElement("img");
  image.src = territoriaHeadDataUri;
  image.alt = "";
  image.width = 48;
  image.height = 48;
  image.decoding = "async";
  image.setAttribute("aria-hidden", "true");
  image.setAttribute("data-brand-mark", "");
  return image;
}
