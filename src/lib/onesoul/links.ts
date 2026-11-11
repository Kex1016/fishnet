// Every One Soul URL in one place.
export const osHref = {
  home: "/one-soul",
  chronicle: (round?: number | null) => (round ? `/one-soul/chronicle?round=${round}` : "/one-soul/chronicle"),
  rounds: "/one-soul/rounds",
  round: (cycle: number) => `/one-soul/rounds/${cycle}`,
  soul: (cycle: number, turn: number) => `/one-soul/rounds/${cycle}/${turn}`,
  journal: (cycle: number, turn: number) => `/one-soul/rounds/${cycle}/${turn}/journal`,
  graveyard: "/one-soul/graveyard",
  timeline: "/one-soul/timeline",
  signups: "/one-soul/sign-ups",
  records: "/one-soul/records",
  player: (uuid: string) => `/one-soul/souls/${uuid}`
};

/** The round a URL asks for (`?round=2`), or null. */
export function roundParam(url: { searchParams: { get(k: string): string | null } }): number | null {
  const v = url.searchParams.get("round");
  if (!v || !/^[1-9][0-9]{0,8}$/.test(v)) return null;
  return Number(v);
}
