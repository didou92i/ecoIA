import type { SemanticAdapterConfiguration } from "../semantic-adapter";

const plausiblePerplexityModelLabel =
  /^(?:(?:openai\s+)?gpt[-\s]?\d[\p{L}\p{N} .+_-]{0,80}|(?:claude|gemini|llama|grok)\s+\d[\p{L}\p{N} .+_-]{0,80}|mistral\s+[\p{L}\p{N} .+_-]{1,80}|sonar(?:\s+(?:pro|reasoning|deep research))?|deepseek(?:[-\s]+(?:r1|v\d[\p{L}\p{N} .+_-]{0,40}))|o\d(?:[-.][\p{L}\p{N}_-]+)?(?:\s+pro)?|r1)$/iu;

export const perplexityModelLabelConfiguration = {
  normalizeModelLabel(label: string) {
    return label.replace(/^(?:Préparé avec|Prepared with)\s+/iu, "").trim();
  },
  modelLabelIsRecognized(label: string, rawLabel: string) {
    return (
      /^(?:Préparé avec|Prepared with)\s+/iu.test(rawLabel) &&
      plausiblePerplexityModelLabel.test(label)
    );
  },
  preferLatestModelLabel: true,
} satisfies Pick<
  SemanticAdapterConfiguration,
  "modelLabelIsRecognized" | "normalizeModelLabel" | "preferLatestModelLabel"
>;
