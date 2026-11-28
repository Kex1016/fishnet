// The One Soul guide snapshot as GET /v2/onesoul/guide serves it (cakeutils v2/oneSoul/CONTRACTS.md §11.3,
// openapi `OneSoulGuide`). Every optional wire field is served with its default, but a reader here still
// takes a missing one: an unknown or absent field is ignored, never a crash. All text is plain text.

export type GuideSection = { id: string; title: string };
export type GuideFact = { label: string; text: string };
export type GuideEntry = {
  id: string;
  section: string;
  title: string;
  /** paragraphs; may hold `{key}` placeholders */
  body: string[];
  facts: GuideFact[];
  /** the item id the entry is about */
  item: string | null;
  /** recipe ids shown with the entry */
  recipes: string[];
};
export type GuideItem = { id: string; name: string };
export type GuideSlot = { slot: number; item: string; count: number; name: string | null };
export type GuideRecipe = {
  id: string;
  /** crafting (slots 0-8 row by row), anvil (0 left, 1 right), smithing (0 template, 1 base, 2 addition); other types are shown as a list */
  type: string;
  shapeless: boolean;
  slots: GuideSlot[];
  result: { item: string; count: number; name: string | null };
  /** a line under the recipe; may hold placeholders */
  note: string | null;
};
export type GuideValue = { key: string; text: string; raw: string | null };

export type Guide = {
  server: string;
  received_at: number;
  schema: number;
  mod_version: string;
  sections: GuideSection[];
  entries: GuideEntry[];
  items: GuideItem[];
  recipes: GuideRecipe[];
  values: GuideValue[];
};
