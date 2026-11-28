// Where the slots of the game's own screens are, in the pixels of the 256x256 sheets in static/mc/gui/
// (extracted from the client jar by scripts/mc-gui.py). A recipe is drawn on the top `top` rows of a sheet plus
// the sheet's bottom edge, at a whole-number scale (RecipeGui.svelte), and the items sit on those slots.
// Slot coordinates are the item's top-left (16x16), as the game's menus place them.
import type { GuideRecipe } from "./types.ts";

export type Pt = { x: number; y: number };
export type GuiLayout = {
  sheet: "crafting_table" | "anvil" | "smithing";
  /** rows of the sheet drawn from its top (the frame, the recipe's slots; not the player's inventory) */
  top: number;
  slots: Pt[];
  result: Pt;
  /** sprites the game lays over the sheet (a file of static/mc/gui/, its place and size) */
  overlays?: { file: string; x: number; y: number; w: number; h: number }[];
};

/** Width of every screen, and the rows of the sheet's bottom edge that close the frame under `top`. */
export const GUI_WIDTH = 176;
export const EDGE = { y: 162, h: 4 } as const;

const grid = (x0: number, y0: number): Pt[] => Array.from({ length: 9 }, (_, i) => ({ x: x0 + (i % 3) * 18, y: y0 + Math.floor(i / 3) * 18 }));

export const LAYOUTS: Record<string, GuiLayout> = {
  // the crafting table: 3x3 grid, row by row, result right of the arrow
  crafting: { sheet: "crafting_table", top: 76, slots: grid(30, 17), result: { x: 124, y: 35 } },
  // the anvil: left, right, result
  anvil: { sheet: "anvil", top: 76, slots: [{ x: 27, y: 47 }, { x: 76, y: 47 }], result: { x: 134, y: 47 }, overlays: [{ file: "anvil_text_field", x: 59, y: 20, w: 110, h: 16 }] },
  // the smithing table: template, base, addition, result
  smithing: { sheet: "smithing", top: 76, slots: [{ x: 8, y: 48 }, { x: 26, y: 48 }, { x: 44, y: 48 }], result: { x: 98, y: 48 } }
};

/** The layout a recipe can be drawn on: a known type whose every slot number fits it; else null (the page lists it in words). */
export function layoutFor(r: Pick<GuideRecipe, "type" | "slots">): GuiLayout | null {
  const l = LAYOUTS[r.type];
  if (!l) return null;
  return r.slots.every((s) => Number.isInteger(s.slot) && s.slot >= 0 && s.slot < l.slots.length) ? l : null;
}

/** The label of the screen, for the caption ("Crafting table", "Anvil", "Smithing table"). */
export const SCREEN_NAME: Record<string, string> = { crafting: "Crafting table", anvil: "Anvil", smithing: "Smithing table" };
