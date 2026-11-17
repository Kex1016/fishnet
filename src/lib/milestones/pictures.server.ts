// The picture helpers of pictures.ts with the site's client as their catalogue reader: what the loads call.
import type { Result } from "#lib/api/result.ts";
import type { AdvancementRow, MilestoneFeedRow } from "#lib/api/types.ts";
import type { FirstsFeed } from "#lib/network/types.ts";
import { api } from "#lib/server/cakeutils/client.ts";
import * as pictures from "./pictures.ts";

/** Adds `icon` and `kind` to stat milestone rows from the catalogue. */
export const withIcons = <T extends { milestones: MilestoneFeedRow[] }>(r: Result<T>, max?: number): Promise<Result<T>> => pictures.withIcons(api(), r, max);
/** Adds `icon` to advancement rows: the item the game shows for each advancement. */
export const withAdvancementIcons = <T extends { milestones: AdvancementRow[] }>(r: Result<T>, max?: number): Promise<Result<T>> => pictures.withAdvancementIcons(api(), r, max);
/** One advancement's picture (the detail page's heading), or null. */
export const advancementIcon = (id: string): Promise<string | null> => pictures.advancementIcon(api(), id);
/** Adds `icon` and `iconKind` to the rows of the firsts feed. */
export const withFirstPictures = (r: Result<FirstsFeed>, max?: number): Promise<Result<FirstsFeed>> => pictures.withFirstPictures(api(), r, max);
