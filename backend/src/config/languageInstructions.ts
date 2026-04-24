// ============================================================
// Per-language instruction strings prepended to AI prompts
// (trainFacts, trainSpecs, rarity). Tells Claude/GPT-4o what
// language to respond in. Users never see these strings directly.
//
// To add a new language end-to-end:
//   1. Ensure the entry exists below.
//   2. Widen VALID_LANGUAGES in routes/identify.ts.
//   3. Ensure frontend locales/<lang>.json is in place.
// ============================================================

export const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "",
  de: "Respond in German (Deutsch). Use formal register.\n\n",
  pl: "Respond in Polish (Polski). Use formal register (Pan/Pani).\n\n",
  fr: "Respond in French (Français). Use formal register (vouvoiement).\n\n",
  nl: "Respond in Dutch (Nederlands). Use formal register (u-vorm).\n\n",
  fi: "Respond in Finnish (Suomi). Use standard written register.\n\n",
  cs: "Respond in Czech (Čeština). Use formal register (vykání).\n\n",
};

export function getLanguageInstruction(language: string = "en"): string {
  return LANGUAGE_INSTRUCTIONS[language] ?? "";
}
