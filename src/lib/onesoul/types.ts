// The One Soul at a Time shapes (cakeutils `/v2/onesoul*`, scope read:onesoul). Pure types, safe anywhere.
//
// Two sources, kept apart on purpose:
// - built today (cakeutils v2/oneSoul/FISHNET-HANDOFF.md, WEBSITE-BRIEF §3.1): status, souls, graves,
//   journals, registrations, events;
// - planned (API-EXPANSION.md, WEBSITE-BRIEF §3.5): live card, rounds, soul detail and run stats, trail,
//   pranks, waystones, map layers, the player route, round scopes. These are written from the contract and
//   feature-detected one by one (a 404 hides the widget). Fields the contract adds to built routes are
//   optional here, so an older proxy type-checks too.
//
// Every free-text field (names, causes, titles, pages, labels) is raw player text: render it as text.
// Unknown fields are ignored; unknown kinds and states fall through to a generic rendering.

export type OsState = "prep" | "idle" | "running" | "exhausted" | "grace" | "ended" | (string & {});
export type Outcome = "playing" | "died" | "skipped" | "round_ended" | "replaced" | (string & {});
export type Phase = "alive" | "second_chance" | (string & {});
/** A dimension class, never a position (API-EXPANSION §7.3). */
export type Realm = "overworld" | "nether" | "end" | "other" | (string & {});

export type Pos = { dim: string; x: number; y: number; z: number };
export type PlayerRef = { uuid: string; name: string };

/** The Borrowed Time clock: count `remaining_ms` down only while `paused` is not true. */
export type SecondChanceClock = {
  deadline: number;
  remaining_ms: number;
  paused?: boolean;
  offerings?: number;
  added_ms?: number;
};

// ---- GET /v2/onesoul (built)

export type StatusSoul = PlayerRef & { since: number; phase: Phase } & Partial<SecondChanceClock>;

export type StatusServer = {
  server: string;
  display_name: string;
  cycle: number;
  state: OsState;
  soul: StatusSoul | null;
  /** a count: the queue order is secret and never served */
  waiting: number;
  played: number;
  registered: number;
  spawn: Pos | null;
  grace_ends_at: number | null;
  prep_ends_at: number | null;
};

export type Status = { servers: StatusServer[] };

// ---- GET /v2/onesoul/live (planned)

export type Headline = { id: string; title: string; value: number; display: string };

export type LiveSoul = PlayerRef & {
  turn: number;
  since: number;
  alive_ms: number;
  phase: Phase;
  online?: boolean;
  realm?: Realm;
  second_chance?: SecondChanceClock | null;
  headline?: Headline[];
  waystones?: number;
};

export type Longest = PlayerRef & { turn: number; duration_ms: number };

export type LiveRound = {
  started_at: number | null;
  prep_ends_at: number | null;
  grace_ends_at: number | null;
  waiting: number;
  played: number;
  registered: number;
  graves?: { total: number; claimed: number };
  longest?: Longest | null;
  scope?: string;
};

export type LivePrevious = PlayerRef & {
  turn: number;
  duration_ms: number | null;
  cause: string | null;
  damage_type?: string | null;
  grave_id?: string | null;
  grave_claimed?: boolean;
  has_journal?: boolean;
};

export type Live = {
  server: string;
  display_name: string;
  cycle: number;
  state: OsState;
  updated_at: number;
  soul: LiveSoul | null;
  round: LiveRound;
  previous: LivePrevious | null;
  recent: OsEvent[];
};

// ---- souls (built; planned fields optional)

export type DeathInfo = Pos & { damage_type?: string | null; killer?: string | null; reason?: string | null };

export type SecondChanceResult = { outcome: string; offerings: number; added_ms: number; used_ms: number };

export type Soul = PlayerRef & {
  server: string;
  turn: number;
  cycle: number;
  started_at: number;
  ended_at: number | null;
  duration_ms: number | null;
  cause: string | null;
  death: DeathInfo | null;
  second_chance: string | null;
  outcome: Outcome;
  grave_id: string | null;
  has_journal: boolean;
  second_chance_result?: SecondChanceResult | null;
  /** registration to turn start; ended souls only */
  waited_ms?: number | null;
  stats_ready?: boolean;
};

export type SoulList = { total: number; souls: Soul[] };

/** GET /v2/onesoul/souls/{turn} (planned): one row + highlights. */
export type SoulDetail = Soul & {
  headline?: Headline[];
  grave?: Grave | null;
  waystones?: number;
  has_trail?: boolean;
};

/** GET /v2/onesoul/souls/{turn}/stats (planned): rows shaped like player stats. */
export type SoulStatRow = { type: string; subject: string; name: string | null; unit: string; value: number; display: string; icon: string | null };
export type SoulStats = { total: number; final: boolean; stats: SoulStatRow[] };

// ---- graves

export type GraveItem = { item: string; count: number };

export type Grave = {
  id: string;
  server: string;
  cycle: number;
  soul: PlayerRef & { turn: number };
  dim: string;
  x: number;
  y: number;
  z: number;
  items: number;
  created_at: number;
  claimed_by: PlayerRef | null;
  claimed_at: number | null;
  contents?: GraveItem[];
  marked?: number;
};

export type GraveList = { total: number; graves: Grave[] };

// ---- journals, registrations, events (built)

export type Journal = {
  server: string;
  soul: PlayerRef & { turn: number; cycle: number };
  title: string | null;
  pages: string[];
  published_at: number;
};

export type Registration = PlayerRef & { registered_at: number; played: boolean };
export type Registrations = { round: number; total: number; players: Registration[] };

export type OsEvent = {
  at: number;
  server?: string;
  cycle?: number;
  kind: string;
  uuid: string | null;
  name: string | null;
  data: Record<string, unknown>;
};

export type EventList = { total: number; events: OsEvent[] };

// ---- rounds (planned)

export type Round = {
  server: string;
  cycle: number;
  state: OsState;
  prep_started_at: number | null;
  started_at: number | null;
  ended_at: number | null;
  seed: string | number | null;
  archive: string | null;
  registered: number;
  souls: number;
  total_survival_ms: number;
  longest: Longest | null;
  graves: { total: number; claimed: number };
  deaths: number;
  scope: string;
};

export type RoundRecord = PlayerRef & { id: string; title: string; turn: number; value: number; display: string };
export type RoundDetail = Round & { records?: RoundRecord[] };
export type RoundList = { total: number; rounds: Round[] };

// ---- pranks, waystones (planned)

export type PrankGhost = PlayerRef & { total: number; kinds: Record<string, number> };
export type Pranks = { server: string; cycle: number; ghosts: PrankGhost[] };

export type Waystone = {
  id: string;
  label: string | null;
  origin: string | null;
  dim: string;
  x: number;
  y: number;
  z: number;
  first_by: (PlayerRef & { turn: number }) | null;
  first_at: number | null;
  visits: number;
  removed_at: number | null;
};
export type Waystones = { total: number; waystones: Waystone[] };

// ---- map (planned): GeoJSON in raw block coordinates, positions [x, z, y], dimension in properties.dim

export type Crs = { type: "minecraft"; axes: string[]; unit: string };
export type GeoPosition = [number, number, number?];
export type Geometry =
  | { type: "Point"; coordinates: GeoPosition }
  | { type: "LineString"; coordinates: GeoPosition[] }
  | { type: string; coordinates?: unknown };
export type Feature = { type: "Feature"; id?: string | number; geometry: Geometry | null; properties: { dim?: string; kind?: string } & Record<string, unknown> };
export type FeatureCollection = { type: "FeatureCollection"; crs?: Crs; features: Feature[] };

export type MapLayerInfo = { id: string; title: string; features: number; updated_at: number | null; href?: string };
export type MapIndex = { server: string; cycle: number; crs?: Crs; dims: string[]; layers: MapLayerInfo[] };

export type TrailSegment = { dim: string; started_at: number; ended_at: number; points: [number, number, number, number][] };
export type Trail = { server: string; cycle: number; soul: PlayerRef & { turn: number }; interval_ms: number; thinned?: boolean; segments: TrailSegment[] };

// ---- GET /v2/players/{ref}/onesoul (planned)

export type PlayerOneSoul = PlayerRef & {
  turns: Soul[];
  graves_claimed: number;
  graves_left_open: number;
  journals: number;
  registrations: { round: number; registered_at: number; played: boolean }[];
  pranks: { total: number; by_round?: Record<string, number> };
  best: { duration_ms: number; cycle: number; turn: number } | null;
};
