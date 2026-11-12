// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Crumb } from "#lib/nav.ts";

declare global {
  namespace App {
    interface Locals {
      /** "dark" | "light" from the theme cookie, or "system" (no cookie). */
      theme: "dark" | "light" | "system";
      /** Mock scenario in use, or null against a real cakeutils. */
      mock: "fresh" | "busy" | null;
      /** The visitor's IANA time zone from the `tz` cookie, "UTC" until the browser has set it. */
      tz: string;
    }
    interface PageData {
      /** Breadcrumbs for the TopBar; every page's server load returns them (nav.ts). */
      crumbs?: Crumb[];
      /** Page title without the site name. */
      title?: string;
    }
    // interface Error {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
