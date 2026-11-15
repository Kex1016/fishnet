// Generated from openapi.json by scripts/gen-types.ts. Do not edit by hand: bun run types
// Synced from cakeutils v2/openapi.yaml with bun run openapi (milestones D-109, advancement milestones D-111 included).

export interface paths {
    "/v2/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Liveness check. The only route without a token.
         * @description No token.
         */
        get: operations["health"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/network": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Servers (id, display_name, online player count, players waiting for it, mc_version, platform, standalone, game) and the total online. A standalone server's stats and playtime never count toward the network scope; game is "onesoul" for a One Soul server, else null.
         * @description Scopes: one of read, read:players.
         */
        get: operations["getNetwork"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/players": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Known players by name; filter by online state and name substring.
         * @description Scopes: one of read, read:players.
         */
        get: operations["listPlayers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/players/{ref}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Identity, online state, server, first/last seen, skin, prefix/suffix segments, playtime summary.
         * @description Scopes: one of read, read:players, read:stats.
         */
        get: operations["getPlayer"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/players/{ref}/playtime": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Live playtime in ms: total for the scope, per server and per mini-server. Private mini-servers are left out of by_mini; their time stays in total_ms and by_server.
         * @description Scopes: one of read, read:players, read:stats.
         */
        get: operations["getPlayerPlaytime"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/players:batch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Up to 100 players in one call, with optional playtime and stat values (include: "playtime", "stats:<type>:<subject>").
         * @description Scopes: one of read, read:players, read:stats.
         */
        post: operations["batchPlayers"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/players/{ref}/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * A player's stat values in a scope: {type, subject, name, unit, value, display, icon}.
         * @description Scopes: one of read, read:players, read:stats.
         */
        get: operations["listPlayerStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/players/{ref}/stats/{type}/{subject}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One stat value (0 when the player has none). 404 when nobody has ever recorded this stat.
         * @description Scopes: one of read, read:players, read:stats.
         */
        get: operations["getPlayerStat"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/players/{ref}/relations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Friends (uuid, name, online) and the player's party {leader, members} or null.
         * @description Scopes: one of read, read:relations.
         */
        get: operations["getPlayerRelations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/stats/types": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Stat types with English names and the kind they count.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["listStatTypes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/stats/subjects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Subject catalogue: key, kind, name, unit, icon url. One row per (subject, kind) name; a subject without a name yet has kind and name null.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["listStatSubjects"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/stats/subjects/{subject}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One subject, its names per kind, and the stat types that have data for it.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["getStatSubject"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/icons/{sha256}.png": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * An icon PNG by its SHA-256. Immutable.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["getIcon"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/leaderboards/stats/{type}/{subject}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Top players for a stat; subject "*" = whole-type total (unit count). Ties by first-seen player. 404 when nobody has ever recorded the stat or type. 400 mixed_units for "*" on a type of kind custom (custom:*): its stats have different units, so ask for one subject.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["statLeaderboard"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/leaderboards/playtime": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Top players by playtime (milliseconds, open sessions included). Ties by first-seen player.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["playtimeLeaderboard"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/milestones/stats/{type}/{subject}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * First player to reach each milestone of a stat (1, 100, 1000, ... for counts; 1 km, 10 km, ... for distances); subject "*" = the type total. tracked is false for time and damage stats, which have none. 404 when nobody has ever recorded the stat or type; 400 mixed_units for custom:*; 400 for a mini: scope.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["statMilestones"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/milestones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Milestones reached in a scope, newest first; ones reached before tracking began (backfilled) come last. 400 for a mini: scope.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["listMilestones"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/players/{ref}/milestones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Milestones this player was the first to reach in a scope, newest first. 400 for a mini: scope.
         * @description Scopes: one of read, read:players, read:stats.
         */
        get: operations["listPlayerMilestones"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/milestones/advancements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The first player to complete each advancement in a scope, newest first. In the network scope: the earliest completion on any server (server says where). imported = the time came from cakectl advancements import. 400 for a mini: scope.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["listAdvancementMilestones"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/milestones/advancement": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One advancement's first earner in the network and on each server where someone has completed it. 404 when no backend ever reported it.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["advancementMilestone"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/players/{ref}/advancement-milestones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Advancements this player was the first to complete in a scope, newest first. 400 for a mini: scope.
         * @description Scopes: one of read, read:players, read:stats.
         */
        get: operations["listPlayerAdvancementMilestones"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/leaderboards/history/{type}/{subject}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The top players of a stat (subject "*" = type total) on each stored day, oldest first. tracked is false for a board the daily snapshot does not cover (days is then empty). 404 when nobody has ever recorded the stat or type; 400 mixed_units for custom:*; 400 for a mini: or round: scope.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["statLeaderboardHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/leaderboards/history/playtime": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The top players by playtime (ms) on each stored day, oldest first. 400 for a mini: or round: scope.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["playtimeLeaderboardHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/firsts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Everything somebody was first to do in a scope, newest first (undated last): stat and type total milestones, advancements, advancement criteria, playtime milestones, first dimension / biome / structure entries and first pickup or craft of the rare items in stats.rare-items. backfilled = reached before tracking began; imported = the time came from an import. 400 for an unknown kind or a mini: scope.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["listFirsts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/activity/playtime": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Time played per bucket (bucket day|week|month, default day): ms and distinct players, every bucket in the range present (0 when nobody played). From the session log, which starts when tracking began. Sessions are split exactly at bucket edges and clipped to since/until. Weeks start on Monday. 400 for a mini: scope or more than 1100 buckets.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["getActivityPlaytime"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/activity/heatmap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Time played per weekday and hour of the local day: 168 cells [weekday, hour, ms], weekday 0 = Monday .. 6 = Sunday, hour 0..23. Default range: the last 90 days.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["getActivityHeatmap"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/activity/online": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Players online, sampled every 5 minutes: average and maximum per bucket (bucket 5m|hour|day, default hour), and the peak sample. A bucket without a sample is absent (the proxy was not running). Counts players who are playing: not in the waiting room, and not on a standalone server in the network scope. 400 for a mini: or round scope, or more than 1100 buckets.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["getActivityOnline"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/players/{ref}/activity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * A player's activity in a scope: first session, number of sessions, days played, the longest session, play streaks and playtime milestones. Aggregates only; no session list. In the network scope a session is an unbroken stretch of play: moving to a standalone server or the waiting room ends it. Streaks count local days (tz_offset_min); current_days is the streak that includes today or yesterday, else 0. 400 for a mini: scope.
         * @description Scopes: one of read, read:players, read:stats.
         */
        get: operations["getPlayerActivity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/milestones/playtime": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The first player to reach 1 h, 10 h, 100 h, 1000 h and 10000 h of playtime in a scope, newest first. A milestone reached before tracking began has no reached_at (backfilled) and comes last; uuid and name are null when several players were past it and nobody can be named. 400 for a mini: scope.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["listPlaytimeMilestones"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/deaths": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The dated death log, newest first. scope is network (default) or server:<id>; a mini: scope is a 400. pos is null unless the proxy runs with api.death-positions: true. imported = the row came from a log backfill (no position). One Soul servers never appear.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["listDeaths"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/milestones/criteria": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The first player to earn each advancement criterion in a scope, newest first. In the network scope: the earliest on any regular server (server says where). imported = the time came from an import. 400 for a mini: scope.
         * @description Scopes: one of read, read:stats.
         */
        get: operations["listCriterionMilestones"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/players/{ref}/advancement-criteria": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The advancement criteria this player earned in a scope, newest first; first = nobody earned it earlier in that scope. 400 for a mini: scope.
         * @description Scopes: one of read, read:players, read:stats.
         */
        get: operations["listPlayerAdvancementCriteria"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One entry per One Soul server: round, state (prep, idle, running, exhausted, grace, ended), the current soul, how many souls wait (a count; the order is secret), how many souls have played, how many players are signed up for the round sign-ups are for, the next spawn, and the end of grace or prep.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["getOneSoul"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The live card: everything a landing page needs in one call. State, the current soul (turn, time alive, phase, online, realm, second-chance clock, headline run figures, waystone count), round counters, the previous soul and the last five timeline rows. Never a position of the living soul, never the queue order. Poll every 5 s at most. headline ids: blocks_mined, mobs_killed, distance (centimetres), biomes, dimensions, advancements; an entry with no source data is left out. realm: overworld, nether, end or other. server may be left out with one One Soul server (400 with several).
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["getOneSoulLive"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/rounds": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Rounds, newest first. seed is null until the round is over. scope is the string to pass as scope= to the stat, leaderboard and milestone routes.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["listOneSoulRounds"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/rounds/{cycle}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One round with records: the best soul in blocks mined, mobs killed, distance, biomes, dimensions, advancements and the longest life, computed from the run statistics of souls that are over. server may be left out with one One Soul server.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["getOneSoulRound"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/souls": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Souls that have played or are playing. Never the queue. Names and causes are raw text: escape them. death (position, damage_type, killer, reason), second_chance_result, waited_ms (sign-up to turn start) and stats_ready exist for souls that are over; reason is deadline (the clock ran out) or absence. sort: turn (server, round, turn), duration (souls still playing last) or started.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["listOneSoulSouls"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/souls/{turn}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One soul with headline run figures, its grave, how many waystones it used and whether a trail exists (has_trail is false while the soul plays). Unknown turn: 404. server may be left out with one One Soul server; cycle defaults to the latest round with souls.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["getOneSoulSoul"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/souls/{turn}/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The statistics a soul collected during its turn, shaped like a player's stats. final is false while the soul plays (live difference to its baseline). Zero rows are left out.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["listOneSoulSoulStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/graves": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Graves, newest first, with who claimed them and when. contents (at most 16 lines, most first) and marked are absent for graves made before they were reported.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["listOneSoulGraves"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/journals/{soul_turn}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The journal of a soul that is over: it died, or its round was ended by force while it lived (outcome round_ended). Pages are raw text: escape them. 404 while the soul is playing, when nothing was published (journal.publish-after-death off) and for an unknown turn. server may be left out when there is one One Soul server; cycle defaults to the server's latest round with souls.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["getOneSoulJournal"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/registrations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Players signed up for a round, by sign-up time (not the queue order, which is secret). round defaults to the one sign-ups are for now.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["listOneSoulRegistrations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Timeline, newest first: prep, round, soul, grave, offering, second-chance and waystone events. Pranks are folded to one row per ghost, round and UTC day (data.count only, at = the day's start). A death that is not final has no position until its soul is over; round_started has no seed until the round is over.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["listOneSoulEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/pranks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Prank counts per ghost and prank kind for a round that is over; 404 before that. Never a moment. cycle defaults to the server's latest finished round.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["getOneSoulPranks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/players/{ref}/onesoul": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * A player's One Soul page in one call: turns, graves claimed and left open, published journals, sign-ups, prank totals of finished rounds and their longest life.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["getPlayerOneSoul"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/souls/{turn}/trail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Where a soul went, in raw block coordinates, as stays (a new one on every dimension change and after a gap of more than 10 minutes). format=points (default) is the compact native form; format=geojson is the trails layer for this one soul. The trail of a soul that still plays is never served (404, the same body as an unknown turn and a soul without points), unless the operator opened onesoul.api.live-trail.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["getOneSoulTrail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/waystones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Waystones activated in a round, first activation first, with who found them and how many souls have used them. label is player text: escape it. format=geojson is the waystones layer.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["listOneSoulWaystones"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/map": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Index of the map layers of a round: how many features each has, when it last changed, the dimensions that have features, and the coordinate system. A map UI reads this, then the layers.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["getOneSoulMap"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/map/{layer}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One layer (spawn, deaths, graves, waystones, trails) as a GeoJSON FeatureCollection of raw block coordinates [x, z, y] with properties.dim on every feature. The deaths and graves layers hold souls that are over; the trails layer never holds a soul that still plays.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["getOneSoulMapLayer"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/mini-servers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Occupied mini-servers: id, display_name, public, server, players, player_count. Mini-servers with public:false are listed only for tokens holding read; a read:players token sees public ones only.
         * @description Scopes: one of read, read:players.
         */
        get: operations["listMiniServers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/map": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Servers that have a web map: their worlds, whether live positions and a tile change log are served, and whether the backend can be reached now. A server whose backend went away stays listed as online: false for ten minutes. Standalone (One Soul) servers and the worlds of private mini-servers are never listed.
         * @description Scopes: one of read, read:map.
         */
        get: operations["listMaps"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/map/{server}/worlds/{world}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One world's map settings: tile size, zoom range, spawn and how often positions change. Tile z = zoom.max is one pixel per block; a tile covers 512 * 2^(zoom.max - z) blocks.
         * @description Scopes: one of read, read:map.
         */
        get: operations["getMapWorld"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/map/{server}/worlds/{world}/changes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The world's tile change log: every tile rendered since epoch with the sequence number of its last render, oldest first. A new epoch, or dropped at or past the last seq a client saw, means reload everything. 404 not_supported when squaremap there writes no change log.
         * @description Scopes: one of read, read:map.
         */
        get: operations["getMapChanges"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/map/{server}/tiles/{world}/{z}/{x}_{y}.png": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One 512 px tile as PNG, with the backend's ETag. Send If-None-Match to revalidate (304). 404 means not rendered, which is normal at the edge of the explored world.
         * @description Scopes: one of read, read:map.
         */
        get: operations["getMapTile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/map/{server}/players": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Where the players on that server are, in whole blocks. Players squaremap hides (spectators, invisible) and players in a world that is not listed are left out. name is raw text. 404 off when the operator turned live positions off.
         * @description Scopes: one of read, read:map.
         */
        get: operations["getMapPlayers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/rounds/{cycle}/map/worlds/{world}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Map settings of one world of a finished round: tile size, zoom range and spawn, for drawing its archived tiles under the round's map layers. 404 while the round is still played and for a round without archived tiles.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["getOneSoulRoundMapWorld"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/onesoul/rounds/{cycle}/map/tiles/{world}/{z}/{x}_{y}.png": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One 512 px tile of a finished round as PNG. It never changes. 404 while the round is still played, for a round without archived tiles and for a tile that was never rendered.
         * @description Scopes: one of read, read:onesoul.
         */
        get: operations["getOneSoulRoundMapTile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/map/{server}/worlds/{world}/markers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The markers players placed in one map world, ordered by id: points, rectangular areas and block-grid polygons with title, subtitle and colour. Polygons are in block corners, counter-clockwise, every edge axis-aligned. Send If-None-Match with the ETag ("m<rev>") to revalidate (304). An empty world is 200 with no markers; 404 not_found for a world that is not on the map, of a mini-server that is not public, or of a standalone server.
         * @description Scopes: one of read, read:map.
         */
        get: operations["getMapMarkers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/admin/announce": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sends a one-off announcement (MiniMessage) to everyone or to one server.
         * @description Scopes: one of admin:announce.
         */
        post: operations["announce"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v2/openapi.json": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * This OpenAPI 3.1 document. Any valid token.
         * @description Any valid token.
         */
        get: operations["openapi"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Problem: {
            type: string;
            title: string;
            status: number;
            detail: string;
        };
        Health: {
            /** @constant */
            status: "ok";
        };
        OpenApiDocument: Record<string, never>;
        Network: {
            servers: {
                id: string;
                display_name: string;
                /** @description players on this server now */
                online: number;
                /** @description players waiting for this server to come up (cakelimbo); 0 without it. Counts only */
                waiting: number;
                mc_version: string | null;
                platform: string | null;
                standalone: boolean;
                game: string | null;
            }[];
            total_online: number;
        };
        PlayerSummary: {
            uuid: string;
            name: string;
            online: boolean;
            server: string | null;
        };
        PlayerList: {
            total: number;
            players: components["schemas"]["PlayerSummary"][];
        };
        Segment: {
            text: string;
            color?: string;
            bold?: boolean;
            italic?: boolean;
            underlined?: boolean;
            strikethrough?: boolean;
            obfuscated?: boolean;
        };
        Playtime: {
            scope: string;
            /** @description servers left out of the network figures in this answer (the request's exclude); empty when nothing was excluded or the scope is not the network */
            excluded?: string[];
            total_ms: number;
            by_server: {
                [key: string]: number;
            };
            by_mini: {
                [key: string]: number;
            };
        };
        PlayerProfile: {
            uuid: string;
            name: string;
            online: boolean;
            server: string | null;
            first_seen: number;
            last_seen: number;
            /** @description skin texture URL (online players) */
            skin: string | null;
            prefix: components["schemas"]["Segment"][];
            suffix: components["schemas"]["Segment"][];
            playtime: components["schemas"]["Playtime"];
        };
        StatValue: {
            type: string;
            subject: string;
            name: string | null;
            /** @enum {string} */
            unit: "count" | "distance_cm" | "ticks" | "damage_tenths";
            value: number;
            display: string;
            icon: string | null;
        };
        StatRow: {
            uuid: string;
            scope: string;
            type: string;
            subject: string;
            name: string | null;
            /** @enum {string} */
            unit: "count" | "distance_cm" | "ticks" | "damage_tenths";
            value: number;
            display: string;
            icon: string | null;
            /** @description servers left out of the network figures in this answer (the request's exclude); empty when nothing was excluded or the scope is not the network */
            excluded?: string[];
        };
        StatList: {
            uuid: string;
            scope: string;
            /** @description servers left out of the network figures in this answer (the request's exclude); empty when nothing was excluded or the scope is not the network */
            excluded?: string[];
            total: number;
            stats: components["schemas"]["StatValue"][];
        };
        Relations: {
            uuid: string;
            friends: components["schemas"]["Member"][];
            party: {
                leader: components["schemas"]["Member"];
                members: components["schemas"]["Member"][];
            } | null;
        };
        Member: {
            uuid: string;
            name: string | null;
            online: boolean;
        };
        BatchRequest: {
            refs: string[];
            include?: string[];
        };
        BatchResponse: {
            scope: string;
            /** @description servers left out of the network figures in this answer (the request's exclude); empty when nothing was excluded or the scope is not the network */
            excluded?: string[];
            players: {
                ref: string;
                uuid: string;
                name: string;
                online: boolean;
                server: string | null;
                playtime?: components["schemas"]["Playtime"];
                stats?: {
                    [key: string]: components["schemas"]["StatValue"];
                };
            }[];
            not_found: string[];
        };
        StatTypes: {
            types: {
                key: string;
                name: string | null;
                kind: string | null;
            }[];
        };
        Subject: {
            key: string;
            kind: string | null;
            name: string | null;
            unit: string;
            icon: string | null;
        };
        SubjectList: {
            total: number;
            subjects: components["schemas"]["Subject"][];
        };
        SubjectDetail: {
            key: string;
            names: components["schemas"]["Subject"][];
            types: string[];
        };
        Leaderboard: {
            metric: string;
            scope: string;
            /** @description servers left out of the network figures in this answer (the request's exclude); empty when nothing was excluded or the scope is not the network */
            excluded?: string[];
            unit: string;
            total: number;
            entries: {
                rank: number;
                uuid: string;
                name: string;
                value: number;
                unit: string;
                display: string;
            }[];
        };
        StatMilestones: {
            metric: string;
            scope: string;
            unit: string;
            /** @description false for stats that keep no milestones (time, damage) */
            tracked: boolean;
            milestones: {
                threshold: number;
                display: string;
                uuid: string | null;
                name: string | null;
                reached_at: number | null;
                backfilled: boolean;
            }[];
        };
        MilestoneList: {
            scope: string;
            total: number;
            milestones: {
                metric: string;
                type: string;
                /** @description "*" for a type total */
                subject: string;
                stat_name: string | null;
                threshold: number;
                unit: string;
                display: string;
                /** @description epoch ms; null when reached before tracking began (backfilled) */
                reached_at: number | null;
                backfilled: boolean;
                /** @description null when backfilled and several players were already past it */
                uuid: string | null;
                name: string | null;
            }[];
        };
        PlayerMilestoneList: {
            uuid: string;
            name: string;
            scope: string;
            total: number;
            milestones: {
                metric: string;
                type: string;
                /** @description "*" for a type total */
                subject: string;
                stat_name: string | null;
                threshold: number;
                unit: string;
                display: string;
                /** @description epoch ms; null when reached before tracking began (backfilled) */
                reached_at: number | null;
                backfilled: boolean;
            }[];
        };
        AdvancementMilestoneList: {
            scope: string;
            /** @description servers left out of the network figures in this answer (the request's exclude); empty when nothing was excluded or the scope is not the network */
            excluded?: string[];
            total: number;
            milestones: {
                /** @description namespaced advancement id */
                advancement: string;
                /** @description English title as the backend last reported it */
                title: string;
                uuid: string;
                name: string;
                /** @description where it was completed (network scope: where the first earner completed it) */
                server: string;
                /** @description epoch ms, the backend's completion time */
                earned_at: number;
                /** @description true when the time came from cakectl advancements import (completed before live tracking) */
                imported: boolean;
                /** @description players who have completed it in the scope */
                earners: number;
            }[];
        };
        PlayerAdvancementMilestoneList: {
            uuid: string;
            name: string;
            scope: string;
            /** @description servers left out of the network figures in this answer (the request's exclude); empty when nothing was excluded or the scope is not the network */
            excluded?: string[];
            total: number;
            milestones: {
                /** @description namespaced advancement id */
                advancement: string;
                /** @description English title as the backend last reported it */
                title: string;
                /** @description where it was completed (network scope: where the first earner completed it) */
                server: string;
                /** @description epoch ms, the backend's completion time */
                earned_at: number;
                /** @description true when the time came from cakectl advancements import (completed before live tracking) */
                imported: boolean;
                /** @description players who have completed it in the scope */
                earners: number;
            }[];
        };
        AdvancementMilestone: {
            advancement: string;
            title: string | null;
            /** @description servers left out of the network figures in this answer (the request's exclude); empty when nothing was excluded or the scope is not the network */
            excluded?: string[];
            network: {
                uuid: string;
                name: string;
                /** @description where it was completed (network scope: where the first earner completed it) */
                server: string;
                /** @description epoch ms, the backend's completion time */
                earned_at: number;
                /** @description true when the time came from cakectl advancements import (completed before live tracking) */
                imported: boolean;
                /** @description players who have completed it in the scope */
                earners: number;
            } | null;
            servers: {
                uuid: string;
                name: string;
                /** @description where it was completed (network scope: where the first earner completed it) */
                server: string;
                /** @description epoch ms, the backend's completion time */
                earned_at: number;
                /** @description true when the time came from cakectl advancements import (completed before live tracking) */
                imported: boolean;
                /** @description players who have completed it in the scope */
                earners: number;
            }[];
        };
        MiniServers: {
            mini_servers: {
                id: string;
                display_name: string;
                public: boolean;
                server: string;
                players: {
                    uuid: string;
                    name: string;
                }[];
                player_count: number;
            }[];
        };
        DeathList: {
            scope: string;
            total: number;
            deaths: {
                at: number;
                uuid: string;
                name: string;
                server: string;
                cause: string;
                damage_type: string | null;
                killer: string | null;
                killer_player: {
                    uuid?: string;
                    name?: string;
                } | null;
                dim: string | null;
                /** @description null unless the proxy runs with api.death-positions: true */
                pos: {
                    x?: number;
                    y?: number;
                    z?: number;
                } | null;
                imported: boolean;
            }[];
        };
        OneSoulStatus: {
            servers: {
                server: string;
                display_name: string;
                cycle: number;
                /** @enum {string} */
                state: "prep" | "idle" | "running" | "exhausted" | "grace" | "ended";
                soul: {
                    uuid: string;
                    /** @description Player name at selection. Raw player text: clients must escape it. */
                    name: string;
                    since: number;
                    /** @enum {string} */
                    phase: "alive" | "second_chance";
                    /** @description epoch ms the second chance ends if its clock keeps running (it only runs while the soul is online, and offerings move it); only in phase second_chance */
                    deadline?: number;
                    /** @description ms left on the second chance's clock now; only in phase second_chance */
                    remaining_ms?: number;
                    /** @description the clock stands because the soul is offline; only in phase second_chance, absent when the backend does not report it */
                    paused?: boolean;
                    /** @description sacrifices made at soul campfires during this second chance; only in phase second_chance, absent when the backend does not report it */
                    offerings?: number;
                    /** @description time those offerings bought in total; only in phase second_chance, absent when the backend does not report it */
                    added_ms?: number;
                } | null;
                /** @description Souls waiting for their turn: a count. The order is secret and never served. */
                waiting: number;
                played: number;
                /** @description Players signed up for the round sign-ups are for (the next round during grace and ended). */
                registered: number;
                spawn: {
                    dim: string;
                    x: number;
                    y: number;
                    z: number;
                } | null;
                /** @description epoch ms; set only in state grace */
                grace_ends_at: number | null;
                /** @description epoch ms; set only in state prep. It moves when prep is extended. */
                prep_ends_at: number | null;
            }[];
        };
        OneSoulSoulList: {
            total: number;
            souls: {
                server: string;
                turn: number;
                cycle: number;
                uuid: string;
                /** @description Player name. Raw player text: clients must escape it. */
                name: string;
                started_at: number;
                /** @description epoch ms; null while the soul plays */
                ended_at: number | null;
                /** @description how long the soul lived; null while it plays (use started_at) */
                duration_ms: number | null;
                /** @description death message as plain text. Raw player text: clients must escape it. */
                cause: string | null;
                death: {
                    dim: string | null;
                    x: number | null;
                    y: number | null;
                    z: number | null;
                    /** @description damage type id, e.g. minecraft:explosion */
                    damage_type: string | null;
                    /** @description entity type id of the killer */
                    killer: string | null;
                    /** @description deadline (the second-chance clock ran out) or absence; null for a plain death */
                    reason: string | null;
                } | null;
                /** @description variant id when a second chance was used */
                second_chance: string | null;
                second_chance_result: {
                    /** @description expired, died, redeemed or round_ended */
                    outcome: string;
                    offerings: number | null;
                    added_ms: number | null;
                    used_ms: number | null;
                } | null;
                /** @enum {string} */
                outcome: "playing" | "died" | "skipped" | "round_ended" | "replaced";
                /** @description id of this soul's grave */
                grave_id: string | null;
                /** @description true only for a soul that is over (outcome died or round_ended) and whose journal was published */
                has_journal: boolean;
                /** @description ms from sign-up to the start of the turn; only for a soul that is over */
                waited_ms: number | null;
                /** @description the soul's run statistics are final (soul over, figures sealed) */
                stats_ready: boolean;
            }[];
        };
        OneSoulGraveList: {
            total: number;
            graves: {
                id: string;
                server: string;
                cycle: number;
                soul: {
                    uuid: string;
                    /** @description Player name. Raw player text: clients must escape it. */
                    name: string;
                    turn: number;
                };
                dim: string;
                x: number;
                y: number;
                z: number;
                items: number;
                created_at: number;
                claimed_by: {
                    uuid: string;
                    /** @description Player name. Raw player text: clients must escape it. */
                    name: string;
                } | null;
                claimed_at: number | null;
                contents?: {
                    /** @description Item id. */
                    item: string;
                    count: number;
                }[];
                marked?: number;
            }[];
        };
        OneSoulJournal: {
            server: string;
            soul: {
                uuid: string;
                /** @description Player name. Raw player text: clients must escape it. */
                name: string;
                turn: number;
                cycle: number;
            };
            /** @description the book's title if the owner named it. Raw player text: clients must escape it. */
            title: string | null;
            pages: string[];
            published_at: number;
        };
        OneSoulRegistrationList: {
            round: number;
            total: number;
            players: {
                uuid: string;
                /** @description Player name. Raw player text: clients must escape it. */
                name: string;
                registered_at: number;
                /** @description has had a turn in that round */
                played: boolean;
            }[];
        };
        OneSoulEventList: {
            total: number;
            events: {
                at: number;
                server: string;
                cycle: number;
                /** @description soul_chosen, death, second_chance, absence_warning, absence_skip, grave_created, grave_claimed, spawn_moved, exhausted, grace_started, grace_ended, round_ended, prep_started, prep_extended, prep_ended, round_started, prank, offering, second_chance_ended, waystone_activated or waystone_removed. Clients ignore kinds they do not know */
                kind: string;
                /** @description the player the event is about (for prank: the ghost) */
                uuid: string | null;
                /** @description that player's name. Raw player text: clients must escape it. */
                name: string | null;
                /** @description Flat object with the fields the kind defines (snake_case, e.g. cause, x, y, z, dim, duration_ms, final, grave_id, by, by_name, ends_at, reason, outcome, souls, archive, seed, damage_type, killer, item, added_ms, used_ms, offerings, waystone, label, origin). A death that is not final has no x, y, z or dim until its soul is over; round_started has no seed until the round is over. Free text in it is raw player text. A prank row has only count. */
                data: {
                    [key: string]: unknown;
                };
            }[];
        };
        OneSoulLive: {
            server: string;
            display_name: string;
            cycle: number;
            /** @enum {string} */
            state: "prep" | "idle" | "running" | "exhausted" | "grace" | "ended";
            updated_at: number;
            soul: {
                uuid: string;
                /** @description Player name. Raw player text: clients must escape it. */
                name: string;
                turn: number | null;
                since: number;
                alive_ms: number;
                /** @enum {string} */
                phase: "alive" | "second_chance";
                /** @description false = the soul is disconnected; null = the backend does not report it */
                online: boolean | null;
                /** @description overworld, nether, end or other: a dimension class, never a position */
                realm: string | null;
                second_chance: {
                    deadline: number;
                    remaining_ms: number;
                    paused: boolean;
                    offerings: number | null;
                    added_ms: number | null;
                } | null;
                headline: {
                    /** @enum {string} */
                    id: "blocks_mined" | "mobs_killed" | "distance" | "biomes" | "dimensions" | "advancements";
                    title: string;
                    /** @description distance in centimetres */
                    value: number;
                    display: string;
                }[];
                waystones: number;
            } | null;
            round: {
                started_at: number | null;
                prep_ends_at: number | null;
                grace_ends_at: number | null;
                /** @description a count; the order is secret */
                waiting: number;
                played: number;
                registered: number;
                graves: {
                    total: number;
                    claimed: number;
                };
                longest: {
                    uuid: string;
                    /** @description Player name. Raw player text: clients must escape it. */
                    name: string;
                    turn: number;
                    duration_ms: number;
                } | null;
                /** @description round:<server>/<cycle> */
                scope: string | null;
            };
            previous: {
                uuid: string;
                /** @description Player name. Raw player text: clients must escape it. */
                name: string;
                turn: number;
                duration_ms: number | null;
                /** @description Raw player text: clients must escape it. */
                cause: string | null;
                damage_type: string | null;
                outcome: string;
                grave_id: string | null;
                grave_claimed: boolean;
                has_journal: boolean;
            } | null;
            recent: {
                at: number;
                server: string;
                cycle: number;
                kind: string;
                uuid: string | null;
                /** @description Raw player text: clients must escape it. */
                name: string | null;
                data: {
                    [key: string]: unknown;
                };
            }[];
        };
        OneSoulRoundList: {
            total: number;
            rounds: {
                server: string;
                cycle: number;
                /** @enum {string} */
                state: "prep" | "running" | "ended" | "unknown";
                prep_started_at: number | null;
                started_at: number | null;
                ended_at: number | null;
                /** @description null until the round is over (a seed maps the live world) */
                seed: number | null;
                archive: string | null;
                registered: number;
                souls: number;
                /** @description sum of the lives of souls that are over */
                total_survival_ms: number;
                longest: {
                    uuid: string;
                    /** @description Player name. Raw player text: clients must escape it. */
                    name: string;
                    turn: number;
                    duration_ms: number;
                } | null;
                graves: {
                    total: number;
                    claimed: number;
                };
                deaths: number;
                /** @description pass as scope= to the stat, leaderboard and milestone routes (round:<server>/<cycle>) */
                scope: string;
            }[];
        };
        OneSoulRoundDetail: {
            server: string;
            cycle: number;
            /** @enum {string} */
            state: "prep" | "running" | "ended" | "unknown";
            prep_started_at: number | null;
            started_at: number | null;
            ended_at: number | null;
            /** @description null until the round is over (a seed maps the live world) */
            seed: number | null;
            archive: string | null;
            registered: number;
            souls: number;
            /** @description sum of the lives of souls that are over */
            total_survival_ms: number;
            longest: {
                uuid: string;
                /** @description Player name. Raw player text: clients must escape it. */
                name: string;
                turn: number;
                duration_ms: number;
            } | null;
            graves: {
                total: number;
                claimed: number;
            };
            deaths: number;
            /** @description pass as scope= to the stat, leaderboard and milestone routes (round:<server>/<cycle>) */
            scope: string;
            records: {
                id: string;
                title: string;
                uuid: string;
                /** @description Player name. Raw player text: clients must escape it. */
                name: string;
                turn: number;
                value: number;
                display: string;
            }[];
        };
        OneSoulSoulDetail: {
            server: string;
            turn: number;
            cycle: number;
            uuid: string;
            /** @description Player name. Raw player text: clients must escape it. */
            name: string;
            started_at: number;
            /** @description epoch ms; null while the soul plays */
            ended_at: number | null;
            /** @description how long the soul lived; null while it plays (use started_at) */
            duration_ms: number | null;
            /** @description death message as plain text. Raw player text: clients must escape it. */
            cause: string | null;
            death: {
                dim: string | null;
                x: number | null;
                y: number | null;
                z: number | null;
                /** @description damage type id, e.g. minecraft:explosion */
                damage_type: string | null;
                /** @description entity type id of the killer */
                killer: string | null;
                /** @description deadline (the second-chance clock ran out) or absence; null for a plain death */
                reason: string | null;
            } | null;
            /** @description variant id when a second chance was used */
            second_chance: string | null;
            second_chance_result: {
                /** @description expired, died, redeemed or round_ended */
                outcome: string;
                offerings: number | null;
                added_ms: number | null;
                used_ms: number | null;
            } | null;
            /** @enum {string} */
            outcome: "playing" | "died" | "skipped" | "round_ended" | "replaced";
            /** @description id of this soul's grave */
            grave_id: string | null;
            /** @description true only for a soul that is over (outcome died or round_ended) and whose journal was published */
            has_journal: boolean;
            /** @description ms from sign-up to the start of the turn; only for a soul that is over */
            waited_ms: number | null;
            /** @description the soul's run statistics are final (soul over, figures sealed) */
            stats_ready: boolean;
            headline: {
                /** @enum {string} */
                id: "blocks_mined" | "mobs_killed" | "distance" | "biomes" | "dimensions" | "advancements";
                title: string;
                /** @description distance in centimetres */
                value: number;
                display: string;
            }[];
            grave: {
                id: string;
                server: string;
                cycle: number;
                soul: {
                    uuid: string;
                    name: string;
                    turn: number;
                };
                dim: string;
                x: number;
                y: number;
                z: number;
                items: number;
                created_at: number;
                claimed_by: {
                    uuid: string;
                    name: string;
                } | null;
                claimed_at: number | null;
                contents?: {
                    item: string;
                    count: number;
                }[];
                marked?: number;
            } | null;
            /** @description waystones this soul activated or used */
            waystones: number;
            /** @description false while the soul plays */
            has_trail: boolean;
        };
        OneSoulSoulStats: {
            server: string;
            cycle: number;
            turn: number;
            soul: {
                uuid: string;
                /** @description Player name. Raw player text: clients must escape it. */
                name: string;
            };
            /** @description false while the soul plays or its figures are not sealed yet */
            final: boolean;
            total: number;
            stats: {
                type: string;
                subject: string;
                name: string | null;
                /** @enum {string} */
                unit: "count" | "distance_cm" | "ticks" | "damage_tenths";
                value: number;
                display: string;
                icon: string | null;
            }[];
        };
        OneSoulPranks: {
            server: string;
            cycle: number;
            ghosts: {
                uuid: string;
                /** @description Player name. Raw player text: clients must escape it. */
                name: string;
                total: number;
                /** @description prank id to count */
                kinds: {
                    [key: string]: number;
                };
            }[];
        };
        OneSoulPlayer: {
            uuid: string;
            /** @description Player name. Raw player text: clients must escape it. */
            name: string;
            turns: {
                server: string;
                turn: number;
                cycle: number;
                uuid: string;
                /** @description Player name. Raw player text: clients must escape it. */
                name: string;
                started_at: number;
                /** @description epoch ms; null while the soul plays */
                ended_at: number | null;
                /** @description how long the soul lived; null while it plays (use started_at) */
                duration_ms: number | null;
                /** @description death message as plain text. Raw player text: clients must escape it. */
                cause: string | null;
                death: {
                    dim: string | null;
                    x: number | null;
                    y: number | null;
                    z: number | null;
                    /** @description damage type id, e.g. minecraft:explosion */
                    damage_type: string | null;
                    /** @description entity type id of the killer */
                    killer: string | null;
                    /** @description deadline (the second-chance clock ran out) or absence; null for a plain death */
                    reason: string | null;
                } | null;
                /** @description variant id when a second chance was used */
                second_chance: string | null;
                second_chance_result: {
                    /** @description expired, died, redeemed or round_ended */
                    outcome: string;
                    offerings: number | null;
                    added_ms: number | null;
                    used_ms: number | null;
                } | null;
                /** @enum {string} */
                outcome: "playing" | "died" | "skipped" | "round_ended" | "replaced";
                /** @description id of this soul's grave */
                grave_id: string | null;
                /** @description true only for a soul that is over (outcome died or round_ended) and whose journal was published */
                has_journal: boolean;
                /** @description ms from sign-up to the start of the turn; only for a soul that is over */
                waited_ms: number | null;
                /** @description the soul's run statistics are final (soul over, figures sealed) */
                stats_ready: boolean;
            }[];
            graves_claimed: number;
            /** @description graves of this player's souls nobody has claimed */
            graves_left_open: number;
            /** @description published journals of souls that are over */
            journals: number;
            registrations: {
                round: number;
                registered_at: number;
                played: boolean;
            }[];
            pranks: {
                /** @description finished rounds only */
                total: number;
                by_round: {
                    server: string;
                    cycle: number;
                    count: number;
                }[];
            };
            best: {
                duration_ms: number;
                server: string;
                cycle: number;
                turn: number;
            } | null;
        };
        LeaderboardHistory: {
            metric: string;
            scope: string;
            unit: string;
            /** @description false = the daily snapshot does not cover this board */
            tracked: boolean;
            days: {
                /** @description UTC calendar day, YYYY-MM-DD */
                day: string;
                entries: {
                    rank: number;
                    uuid: string;
                    /** @description Player name now. Raw player text: clients must escape it. */
                    name: string;
                    value: number;
                    display: string;
                }[];
            }[];
        };
        FirstsList: {
            scope: string;
            total: number;
            firsts: {
                /** @enum {string} */
                kind: "stat" | "advancement" | "criterion" | "playtime" | "dimension" | "biome" | "structure" | "item";
                /** @description epoch ms; null when the time is unknown (backfilled) */
                at: number | null;
                /** @description null when no single holder is known */
                uuid: string | null;
                /** @description Player name now. Raw player text: clients must escape it. */
                name: string | null;
                /** @description where it happened; null when not recorded */
                server: string | null;
                /** @description English display text as the game or backend reported it. Raw player text: clients must escape it. */
                title: string | null;
                /** @description by kind: stat {metric, type, subject, threshold, unit, display}; dimension {dimension}; biome {biome}; structure {structure}; item {item, via: picked_up|crafted}; advancement {advancement}; criterion {advancement, criterion}; playtime {threshold_ms, display} */
                detail: Record<string, never>;
                backfilled: boolean;
                imported: boolean;
            }[];
        };
        /** @description Raw world block coordinates, nothing flipped: x east, z south, y height. A map UI converts with its own projection. */
        OneSoulCrs: {
            /** @enum {string} */
            type: "minecraft";
            /** @description ["x", "z", "y"]: GeoJSON positions are [x, z, y] */
            axes: string[];
            /** @enum {string} */
            unit: "block";
        };
        OneSoulTrailPoints: {
            server: string;
            cycle: number;
            soul: {
                uuid: string;
                /** @description Player name. Raw player text: clients must escape it. */
                name: string;
                turn: number;
            };
            /** @description nominal sampling interval of the mod; points are only recorded when the soul moved */
            interval_ms: number;
            /** @description true when max_points thinned the trail */
            thinned: boolean;
            /** @description points stored for the soul before thinning */
            points_total: number;
            segments: {
                dim: string;
                started_at: number;
                ended_at: number;
                points: number[][];
            }[];
        };
        /** @description format=points (default): the native form; format=geojson: the trails layer of this one soul, with thinned as a foreign member */
        OneSoulTrail: components["schemas"]["OneSoulTrailPoints"] | components["schemas"]["OneSoulMapLayer"];
        OneSoulMapLayer: {
            /** @enum {string} */
            type: "FeatureCollection";
            crs: components["schemas"]["OneSoulCrs"];
            server: string;
            cycle: number;
            /** @description when the layer last changed; null when empty */
            updated_at?: number | null;
            /** @description trail answers only: true when max_points thinned it */
            thinned?: boolean;
            features: {
                /** @enum {string} */
                type: "Feature";
                geometry: {
                    /** @enum {string} */
                    type: "Point" | "LineString";
                    /** @description Point: [x, z, y]. LineString: a list of [x, z, y] */
                    coordinates: unknown[];
                };
                /** @description kind (spawn, death, grave, waystone, trail) and dim on every feature; the rest by layer (API-EXPANSION §3). Free text in it is raw player text. */
                properties: {
                    [key: string]: unknown;
                };
            }[];
        };
        OneSoulMapIndex: {
            server: string;
            cycle: number;
            crs: components["schemas"]["OneSoulCrs"];
            dims: string[];
            layers: {
                /** @enum {string} */
                id: "spawn" | "deaths" | "graves" | "waystones" | "trails";
                title: string;
                features: number;
                /** @description when the layer last changed; null when empty */
                updated_at: number | null;
                /** @description path and query of the layer */
                href: string;
            }[];
        };
        OneSoulWaystoneRows: {
            server: string;
            cycle: number;
            total: number;
            waystones: {
                /** @description the Waystones mod's id for the waystone */
                id: string;
                /** @description the waystone's name. Raw player text: clients must escape it. */
                label: string | null;
                /** @description player, village, wilderness, dungeon or unknown */
                origin: string | null;
                dim: string;
                x: number;
                y: number;
                z: number;
                first_by: {
                    uuid: string;
                    /** @description Player name. Raw player text: clients must escape it. */
                    name: string;
                    turn: number;
                };
                first_at: number;
                /** @description souls that have used it */
                visits: number;
                /** @description set when the waystone was removed */
                removed_at: number | null;
            }[];
        };
        /** @description format=list (default): the rows; format=geojson: the waystones layer */
        OneSoulWaystoneList: components["schemas"]["OneSoulWaystoneRows"] | components["schemas"]["OneSoulMapLayer"];
        ActivityPlaytime: {
            scope: string;
            /** @enum {string} */
            bucket: "day" | "week" | "month";
            since: number;
            until: number;
            tz_offset_min: number;
            series: {
                /** @description epoch ms of the bucket's start in the requested offset */
                start: number;
                /** @description milliseconds played in the bucket */
                ms: number;
                /** @description distinct players who played in it */
                players: number;
            }[];
        };
        ActivityHeatmap: {
            scope: string;
            since: number;
            until: number;
            tz_offset_min: number;
            cells: number[][];
        };
        ActivityOnline: {
            scope: string;
            /** @enum {string} */
            bucket: "5m" | "hour" | "day";
            since: number;
            until: number;
            sample_interval_ms: number;
            series: {
                start: number;
                /** @description average players over the bucket's samples, two decimals */
                avg: number;
                max: number;
            }[];
            peak: {
                at: number;
                count: number;
            } | null;
        };
        PlayerActivity: {
            uuid: string;
            name: string;
            scope: string;
            tz_offset_min: number;
            first_session_at: number | null;
            sessions: number;
            days_active: number;
            longest_session: {
                started_at: number;
                ms: number;
                /** @description the server of a server or round scope; for the network where the session began */
                server: string | null;
            } | null;
            streak: {
                current_days: number;
                best_days: number;
                /** @description epoch ms of the start of the best streak's last day */
                best_ended: number | null;
            };
            playtime_milestones: {
                threshold_ms: number;
                display: string;
                /** @description null when the player was past it before tracking began */
                reached_at: number | null;
                /** @description this player is the first in the scope */
                first: boolean;
                backfilled: boolean;
            }[];
        };
        PlaytimeMilestoneList: {
            scope: string;
            total: number;
            milestones: {
                threshold_ms: number;
                display: string;
                uuid: string | null;
                name: string | null;
                reached_at: number | null;
                backfilled: boolean;
            }[];
        };
        CriterionMilestoneList: {
            scope: string;
            /** @description servers left out of the network figures in this answer (the request's exclude); empty when nothing was excluded or the scope is not the network */
            excluded?: string[];
            total: number;
            criteria: {
                /** @description namespaced advancement id */
                advancement: string;
                /** @description English title as last reported; the id itself when nobody completed the advancement yet */
                title: string;
                /** @description the criterion's name as the advancement defines it */
                criterion: string;
                uuid: string;
                name: string;
                /** @description where it was earned (for the network scope: where the first earner earned it) */
                server: string;
                /** @description epoch ms, the backend's grant time */
                earned_at: number;
                /** @description true when the time came from an import */
                imported: boolean;
                /** @description players who have it in the scope */
                earners: number;
            }[];
        };
        PlayerCriterionList: {
            uuid: string;
            name: string;
            scope: string;
            /** @description servers left out of the network figures in this answer (the request's exclude); empty when nothing was excluded or the scope is not the network */
            excluded?: string[];
            total: number;
            criteria: {
                /** @description namespaced advancement id */
                advancement: string;
                /** @description English title as last reported; the id itself when nobody completed the advancement yet */
                title: string;
                /** @description the criterion's name as the advancement defines it */
                criterion: string;
                /** @description epoch ms, the player's earliest time in the scope */
                earned_at: number;
                imported: boolean;
                /** @description nobody earned it earlier in the scope */
                first: boolean;
            }[];
        };
        MapIndex: {
            servers: {
                /** @description server id (velocity.toml key) */
                server: string;
                display_name: string;
                /** @description the backend is linked and its map can be asked now */
                online: boolean;
                worlds: {
                    /** @description squaremap's name of the world: the dimension id with ':' replaced by '_', e.g. minecraft_overworld */
                    id: string;
                    /** @description the dimension id (minecraft:the_nether), null when the backend does not know it */
                    dimension: string | null;
                    /** @description display name, plain text, at most 64 characters. Raw text: clients must escape it. */
                    name: string;
                    /** @description sort order, ascending */
                    order: number;
                    /** @description the mini-server the world belongs to (public mini-servers only), else null */
                    mini: string | null;
                    /**
                     * @description which of the mini-server's worlds; set exactly when mini is
                     * @enum {string|null}
                     */
                    area: "overworld" | "nether" | "end" | null;
                }[];
                /** @description whether /players is served for this server now */
                live_players: boolean;
                /** @description whether some world has a tile change log */
                changes: boolean;
                /** @description when the backend last announced its map */
                announced_at: number;
            }[];
        };
        MapWorld: {
            server: string;
            /** @description squaremap's name of the world: the dimension id with ':' replaced by '_', e.g. minecraft_overworld */
            world: string;
            /** @constant */
            tile_size: 512;
            zoom: {
                /** @constant */
                min: 0;
                /** @description deepest rendered zoom: one pixel per block */
                max: number;
                /** @description zoom to open the map at */
                default: number;
                /** @description zoom levels past max a client may scale the max tiles up by */
                extra: number;
            };
            spawn: {
                x: number;
                z: number;
            };
            /** @description how often positions are refreshed on the backend; do not poll faster */
            player_update_ms: number;
            /** @description when squaremap last wrote the settings */
            updated_at: number;
            /** @description true when the backend could not be asked and this is the last answer kept */
            stale: boolean;
        };
        MapChanges: {
            server: string;
            world: string;
            /** @description changes when the log starts over (backend restart): forget every seq */
            epoch: string;
            /** @description the highest sequence number given out */
            seq: number;
            /** @description the highest sequence number that fell out of the log; 0 when none did */
            dropped: number;
            tiles: number[][];
        };
        MapPlayers: {
            server: string;
            /** @description when squaremap last wrote the positions; it writes only when something moved */
            updated_at: number;
            /** @description true when the backend could not be asked and this is the last answer kept */
            stale: boolean;
            players: {
                /** @description dashed, lower case */
                uuid: string;
                /** @description player name. Raw text: clients must escape it. */
                name: string;
                /** @description squaremap's name of the world: the dimension id with ':' replaced by '_', e.g. minecraft_overworld */
                world: string;
                /** @description block x */
                x: number;
                /** @description block z */
                z: number;
                /** @description head yaw in degrees, as Minecraft gives it: 0 = south (+z), 90 = west */
                yaw: number;
            }[];
        };
        OneSoulRoundMapWorld: {
            server: string;
            cycle: number;
            /** @description squaremap's name of the world: the dimension id with ':' replaced by '_', e.g. minecraft_overworld */
            world: string;
            /** @constant */
            tile_size: 512;
            zoom: {
                /** @constant */
                min: 0;
                max: number;
                default: number;
                extra: number;
            };
            spawn: {
                x: number;
                z: number;
            };
            /** @description when squaremap last wrote the settings, before the round was archived */
            updated_at: number;
        };
        MapMarker: {
            /** @description never reused */
            id: number;
            /** @enum {string} */
            kind: "point" | "area" | "poly";
            /** @description 1 to 64 characters, one line. Raw text, never markup: clients must escape it. */
            title: string;
            /** @description up to 256 characters and 4 lines (\n), or null. Raw text, never markup: clients must escape it. */
            subtitle: string | null;
            /** @description #rrggbb, lower case */
            color: string;
            /** @description true when cakeutils generated the colour because the builder gave none */
            color_auto: boolean;
            /** @description kind point: the block (drawn at its centre x + 0.5, z + 0.5); else null */
            point: {
                x: number;
                y: number;
                z: number;
            } | null;
            /** @description kind area: inclusive block bounds (an area of blocks 0..9 has max 9); else null */
            bounds: {
                min_x: number;
                min_z: number;
                max_x: number;
                max_z: number;
            } | null;
            /** @description kinds area and poly: [x, z] block corners, counter-clockwise as drawn (x right, z down), from the lowest-z then lowest-x corner, every edge axis-aligned, no holes; else null */
            polygon: number[][] | null;
            /** @description kinds area and poly: where the title goes (the point inside farthest from every edge); else null */
            label: {
                x: number;
                z: number;
                /** @description distance in blocks to the nearest edge */
                r: number;
            } | null;
            /** @description bounding box in block corners (max exclusive as blocks): a point's is its block */
            bbox: {
                min_x: number;
                min_z: number;
                max_x: number;
                max_z: number;
            };
            /** @description epoch ms */
            created_at: number;
            /** @description epoch ms */
            updated_at: number;
            /** @description 1 at creation, +1 per change */
            revision: number;
        };
        MapMarkers: {
            /** @description server id (velocity.toml key) */
            server: string;
            /** @description the map world id */
            world: string;
            /** @description the world's change counter; the ETag is "m<rev>" */
            rev: number;
            /** @description ordered by id */
            markers: components["schemas"]["MapMarker"][];
        };
        AnnounceRequest: {
            /** @description "global" or "server:<id>" */
            target: string;
            /** @description MiniMessage */
            message: string;
        };
        AnnounceResponse: {
            target: string;
            reached: number;
        };
    };
    responses: {
        /** @description Bad Request */
        BadRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Unauthorized */
        Unauthorized: {
            headers: {
                "WWW-Authenticate"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Forbidden */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Not Found */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Content Too Large */
        ContentTooLarge: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Too Many Requests */
        TooManyRequests: {
            headers: {
                /** @description Seconds until a request is allowed again. */
                "Retry-After"?: number;
                "RateLimit-Limit"?: number;
                "RateLimit-Remaining"?: number;
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Internal Server Error */
        InternalError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Not Implemented */
        NotImplemented: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Service Unavailable */
        ServiceUnavailable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    health: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Health"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            500: components["responses"]["InternalError"];
        };
    };
    getNetwork: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Network"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listPlayers: {
        parameters: {
            query?: {
                /** @description true = online now, false = everyone else; absent = all. */
                online?: boolean;
                /** @description Case-insensitive substring. */
                q?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlayerList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getPlayer: {
        parameters: {
            query?: {
                /** @description Server ids, comma-separated, left out of network-scope figures (D-113): each value becomes the network value minus those servers' values, rows that only came from them are dropped. Ignored for a server or mini scope. The answer's excluded field lists what was applied. */
                exclude?: string;
            };
            header?: never;
            path: {
                /** @description Player UUID (dashed or undashed) or exact name (case-insensitive). */
                ref: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlayerProfile"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getPlayerPlaytime: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Server ids, comma-separated, left out of network-scope figures (D-113): each value becomes the network value minus those servers' values, rows that only came from them are dropped. Ignored for a server or mini scope. The answer's excluded field lists what was applied. */
                exclude?: string;
            };
            header?: never;
            path: {
                /** @description Player UUID (dashed or undashed) or exact name (case-insensitive). */
                ref: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Playtime"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    batchPlayers: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Server ids, comma-separated, left out of network-scope figures (D-113): each value becomes the network value minus those servers' values, rows that only came from them are dropped. Ignored for a server or mini scope. The answer's excluded field lists what was applied. */
                exclude?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BatchRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BatchResponse"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["ContentTooLarge"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listPlayerStats: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Server ids, comma-separated, left out of network-scope figures (D-113): each value becomes the network value minus those servers' values, rows that only came from them are dropped. Ignored for a server or mini scope. The answer's excluded field lists what was applied. */
                exclude?: string;
                /** @description Only this stat type (minecraft: may be omitted). */
                type?: string;
                /** @description Case-insensitive substring. */
                q?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path: {
                /** @description Player UUID (dashed or undashed) or exact name (case-insensitive). */
                ref: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StatList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getPlayerStat: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Server ids, comma-separated, left out of network-scope figures (D-113): each value becomes the network value minus those servers' values, rows that only came from them are dropped. Ignored for a server or mini scope. The answer's excluded field lists what was applied. */
                exclude?: string;
            };
            header?: never;
            path: {
                /** @description Player UUID (dashed or undashed) or exact name (case-insensitive). */
                ref: string;
                /** @description Stat type key, e.g. minecraft:mined (the minecraft: namespace may be omitted). */
                type: string;
                /** @description Subject key, e.g. minecraft:stone. */
                subject: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StatRow"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getPlayerRelations: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Player UUID (dashed or undashed) or exact name (case-insensitive). */
                ref: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Relations"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listStatTypes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StatTypes"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listStatSubjects: {
        parameters: {
            query?: {
                /** @description Only subjects recorded under this stat type. */
                type?: string;
                /** @description Only names of this kind. */
                kind?: "block" | "item" | "entity" | "custom" | "other";
                /** @description Case-insensitive substring. */
                q?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubjectList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getStatSubject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Subject key, e.g. minecraft:stone. */
                subject: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubjectDetail"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getIcon: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Lower-case hex SHA-256 of the PNG. */
                sha256: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description PNG image */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "image/png": string;
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    statLeaderboard: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Server ids, comma-separated, left out of network-scope figures (D-113): each value becomes the network value minus those servers' values, rows that only came from them are dropped. Ignored for a server or mini scope. The answer's excluded field lists what was applied. */
                exclude?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path: {
                /** @description Stat type key, e.g. minecraft:mined (the minecraft: namespace may be omitted). */
                type: string;
                /** @description Subject key, e.g. minecraft:stone. */
                subject: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Leaderboard"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    playtimeLeaderboard: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Server ids, comma-separated, left out of network-scope figures (D-113): each value becomes the network value minus those servers' values, rows that only came from them are dropped. Ignored for a server or mini scope. The answer's excluded field lists what was applied. */
                exclude?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Leaderboard"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    statMilestones: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
            };
            header?: never;
            path: {
                /** @description Stat type key, e.g. minecraft:mined (the minecraft: namespace may be omitted). */
                type: string;
                /** @description Subject key, e.g. minecraft:stone. */
                subject: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StatMilestones"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listMilestones: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Only this stat type's milestones, its stats and its total (minecraft: may be omitted). */
                type?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MilestoneList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listPlayerMilestones: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Only this stat type's milestones, its stats and its total (minecraft: may be omitted). */
                type?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path: {
                /** @description Player UUID (dashed or undashed) or exact name (case-insensitive). */
                ref: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlayerMilestoneList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listAdvancementMilestones: {
        parameters: {
            query?: {
                /** @description network (default), server:<id> or round:<server>/<cycle> (one round of a One Soul server). The network never contains a standalone (One Soul) server. A mini: scope is a 400. */
                scope?: string;
                /** @description Server ids, comma-separated, left out of network-scope figures (D-113): each value becomes the network value minus those servers' values, rows that only came from them are dropped. Ignored for a server or mini scope. The answer's excluded field lists what was applied. */
                exclude?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdvancementMilestoneList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    advancementMilestone: {
        parameters: {
            query?: {
                /** @description Namespaced advancement id, e.g. minecraft:story/mine_diamond (minecraft: may be omitted). Required. */
                id?: string;
                /** @description Server ids, comma-separated, left out of network-scope figures (D-113): each value becomes the network value minus those servers' values, rows that only came from them are dropped. Ignored for a server or mini scope. The answer's excluded field lists what was applied. */
                exclude?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdvancementMilestone"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listPlayerAdvancementMilestones: {
        parameters: {
            query?: {
                /** @description network (default), server:<id> or round:<server>/<cycle> (one round of a One Soul server). The network never contains a standalone (One Soul) server. A mini: scope is a 400. */
                scope?: string;
                /** @description Server ids, comma-separated, left out of network-scope figures (D-113): each value becomes the network value minus those servers' values, rows that only came from them are dropped. Ignored for a server or mini scope. The answer's excluded field lists what was applied. */
                exclude?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path: {
                /** @description Player UUID (dashed or undashed) or exact name (case-insensitive). */
                ref: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlayerAdvancementMilestoneList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    statLeaderboardHistory: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Epoch ms; days from the one containing it on (UTC). */
                since?: number;
                /** @description Epoch ms; days up to the one containing it (UTC). */
                until?: number;
                /** @description Players per day (1..10). */
                limit?: number;
            };
            header?: never;
            path: {
                /** @description Stat type key, e.g. minecraft:mined (the minecraft: namespace may be omitted). */
                type: string;
                /** @description Subject key, e.g. minecraft:stone. */
                subject: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LeaderboardHistory"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    playtimeLeaderboardHistory: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Epoch ms; days from the one containing it on (UTC). */
                since?: number;
                /** @description Epoch ms; days up to the one containing it (UTC). */
                until?: number;
                /** @description Players per day (1..10). */
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LeaderboardHistory"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listFirsts: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Comma-separated kinds to include: stat, advancement, criterion, playtime, dimension, biome, structure, item. Default: all. */
                kinds?: string;
                /** @description Epoch ms; only firsts with a known time at or after it. */
                since?: number;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FirstsList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getActivityPlaytime: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Only this player (uuid or name); 404 when unknown. */
                player?: string;
                /** @description Start of the range, epoch ms (inclusive). Default: a span before until that depends on the bucket. */
                since?: number;
                /** @description End of the range, epoch ms (exclusive). Default: now. */
                until?: number;
                /** @description Bucket width. */
                bucket?: "day" | "week" | "month";
                /** @description UTC offset in minutes that days, weeks and months are cut in (a fixed offset, no daylight saving). */
                tz_offset_min?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActivityPlaytime"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getActivityHeatmap: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Only this player (uuid or name); 404 when unknown. */
                player?: string;
                /** @description Start of the range, epoch ms (inclusive). Default: a span before until that depends on the bucket. */
                since?: number;
                /** @description End of the range, epoch ms (exclusive). Default: now. */
                until?: number;
                /** @description UTC offset in minutes that days, weeks and months are cut in (a fixed offset, no daylight saving). */
                tz_offset_min?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActivityHeatmap"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getActivityOnline: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Start of the range, epoch ms (inclusive). Default: a span before until that depends on the bucket. */
                since?: number;
                /** @description End of the range, epoch ms (exclusive). Default: now. */
                until?: number;
                /** @description Bucket width. */
                bucket?: "5m" | "hour" | "day";
                /** @description UTC offset in minutes that days, weeks and months are cut in (a fixed offset, no daylight saving). */
                tz_offset_min?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActivityOnline"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getPlayerActivity: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description UTC offset in minutes that days, weeks and months are cut in (a fixed offset, no daylight saving). */
                tz_offset_min?: number;
            };
            header?: never;
            path: {
                /** @description Player UUID (dashed or undashed) or exact name (case-insensitive). */
                ref: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlayerActivity"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listPlaytimeMilestones: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlaytimeMilestoneList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listDeaths: {
        parameters: {
            query?: {
                /** @description network (default), server:<id>, mini:<server-id>/<mini-id> or round:<server-id>/<cycle> (one round of a One Soul server). A standalone server (One Soul) never counts toward network. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
                /** @description Only this player's deaths: UUID or exact name. 404 for an unknown player. */
                player?: string;
                /** @description Only deaths at or after this epoch-millisecond instant. */
                since?: number;
                /** @description Only deaths at or before this epoch-millisecond instant. */
                until?: number;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeathList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listCriterionMilestones: {
        parameters: {
            query?: {
                /** @description network (default), server:<id> or round:<server>/<cycle> (one round of a One Soul server). The network never contains a standalone (One Soul) server. A mini: scope is a 400. */
                scope?: string;
                /** @description Only the criteria of this advancement, e.g. minecraft:adventure/adventuring_time (minecraft: may be omitted). An advancement nobody reported criteria for gives an empty list. */
                advancement?: string;
                /** @description Server ids, comma-separated, left out of network-scope figures (D-113): each value becomes the network value minus those servers' values, rows that only came from them are dropped. Ignored for a server or mini scope. The answer's excluded field lists what was applied. */
                exclude?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CriterionMilestoneList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listPlayerAdvancementCriteria: {
        parameters: {
            query?: {
                /** @description network (default), server:<id> or round:<server>/<cycle> (one round of a One Soul server). The network never contains a standalone (One Soul) server. A mini: scope is a 400. */
                scope?: string;
                /** @description Only the criteria of this advancement, e.g. minecraft:adventure/adventuring_time (minecraft: may be omitted). An advancement nobody reported criteria for gives an empty list. */
                advancement?: string;
                /** @description Server ids, comma-separated, left out of network-scope figures (D-113): each value becomes the network value minus those servers' values, rows that only came from them are dropped. Ignored for a server or mini scope. The answer's excluded field lists what was applied. */
                exclude?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path: {
                /** @description Player UUID (dashed or undashed) or exact name (case-insensitive). */
                ref: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlayerCriterionList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getOneSoul: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulStatus"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getOneSoulLive: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). Absent: every One Soul server. */
                server?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulLive"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listOneSoulRounds: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). Absent: every One Soul server. */
                server?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulRoundList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getOneSoulRound: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). Absent: every One Soul server. */
                server?: string;
            };
            header?: never;
            path: {
                /** @description cycle */
                cycle: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulRoundDetail"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listOneSoulSouls: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). Absent: every One Soul server. */
                server?: string;
                /** @description A round (cycle). Absent: every round. */
                cycle?: number;
                /** @description Only rows about this player. */
                uuid?: string;
                /** @description Only souls with this outcome. */
                outcome?: "playing" | "died" | "skipped" | "round_ended" | "replaced";
                /** @description Sort key. */
                sort?: "turn" | "duration" | "started";
                /** @description Sort direction. */
                order?: "asc" | "desc";
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulSoulList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getOneSoulSoul: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). Absent: every One Soul server. */
                server?: string;
                /** @description A round (cycle). Absent: the server's latest round with souls. */
                cycle?: number;
            };
            header?: never;
            path: {
                /** @description turn */
                turn: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulSoulDetail"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listOneSoulSoulStats: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). Absent: every One Soul server. */
                server?: string;
                /** @description A round (cycle). Absent: the server's latest round with souls. */
                cycle?: number;
                /** @description Only this stat type (minecraft: may be omitted). */
                type?: string;
                /** @description Case-insensitive substring of the subject id or English name. */
                q?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path: {
                /** @description turn */
                turn: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulSoulStats"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listOneSoulGraves: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). Absent: every One Soul server. */
                server?: string;
                /** @description A round (cycle). Absent: every round. */
                cycle?: number;
                /** @description Only claimed or only open graves. */
                claimed?: boolean;
                /** @description Only graves this player claimed. */
                claimed_by?: string;
                /** @description Only graves of this player's souls. */
                soul?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulGraveList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getOneSoulJournal: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). Absent: every One Soul server. */
                server?: string;
                /** @description A round (cycle). Absent: every round. */
                cycle?: number;
            };
            header?: never;
            path: {
                /** @description The soul's turn number in its round (1, 2, ...). */
                soul_turn: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulJournal"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listOneSoulRegistrations: {
        parameters: {
            query?: {
                /** @description The round; absent: the round sign-ups are for now. */
                round?: number;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulRegistrationList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listOneSoulEvents: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). Absent: every One Soul server. */
                server?: string;
                /** @description A round (cycle). Absent: every round. */
                cycle?: number;
                /** @description Only events after this epoch ms. */
                since?: number;
                /** @description Only rows about this player. */
                uuid?: string;
                /** @description Comma-separated kinds to keep (up to 20), e.g. death,offering. */
                kind?: string;
                /** @description Page size. */
                limit?: number;
                /** @description Rows to skip. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulEventList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getOneSoulPranks: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). Absent: every One Soul server. */
                server?: string;
                /** @description A finished round. Absent: the latest finished round. */
                cycle?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulPranks"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getPlayerOneSoul: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Player UUID (dashed or undashed) or exact name (case-insensitive). */
                ref: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulPlayer"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getOneSoulTrail: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). May be left out when there is one One Soul server. */
                server?: string;
                /** @description A round (cycle). Absent: the server's current round. */
                cycle?: number;
                /** @description Native points or a GeoJSON FeatureCollection. */
                format?: "points" | "geojson";
                /** @description Thin the trail to about this many points: every nth point is kept, always the first and last of every stay. thinned says so. */
                max_points?: number;
            };
            header?: never;
            path: {
                /** @description turn */
                turn: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulTrail"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listOneSoulWaystones: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). May be left out when there is one One Soul server. */
                server?: string;
                /** @description A round (cycle). Absent: the server's current round. */
                cycle?: number;
                /** @description Plain list or a GeoJSON FeatureCollection. */
                format?: "list" | "geojson";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulWaystoneList"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getOneSoulMap: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). May be left out when there is one One Soul server. */
                server?: string;
                /** @description A round (cycle). Absent: the server's current round. */
                cycle?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulMapIndex"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getOneSoulMapLayer: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). May be left out when there is one One Soul server. */
                server?: string;
                /** @description A round (cycle). Absent: the server's current round. */
                cycle?: number;
                /** @description Only features in this dimension id, e.g. minecraft:the_nether. */
                dim?: string;
            };
            header?: never;
            path: {
                /** @description layer */
                layer: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulMapLayer"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listMiniServers: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MiniServers"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    listMaps: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MapIndex"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    getMapWorld: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Server id (velocity.toml key). */
                server: string;
                /** @description Map world id: the dimension id with ':' replaced by '_', e.g. minecraft_overworld. */
                world: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MapWorld"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
            501: components["responses"]["NotImplemented"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    getMapChanges: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Server id (velocity.toml key). */
                server: string;
                /** @description Map world id: the dimension id with ':' replaced by '_', e.g. minecraft_overworld. */
                world: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MapChanges"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
            501: components["responses"]["NotImplemented"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    getMapTile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Server id (velocity.toml key). */
                server: string;
                /** @description Map world id: the dimension id with ':' replaced by '_', e.g. minecraft_overworld. */
                world: string;
                /** @description Tile zoom, 0 to the world's zoom.max. */
                z: string;
                /** @description Tile column (integer, may be negative). */
                x: string;
                /** @description Tile row (integer, may be negative). */
                y: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description PNG image */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "image/png": string;
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    getMapPlayers: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Server id (velocity.toml key). */
                server: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MapPlayers"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
            501: components["responses"]["NotImplemented"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    getOneSoulRoundMapWorld: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). May be left out when there is one One Soul server. */
                server?: string;
            };
            header?: never;
            path: {
                /** @description cycle */
                cycle: string;
                /** @description Map world id: the dimension id with ':' replaced by '_', e.g. minecraft_overworld. */
                world: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OneSoulRoundMapWorld"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
            501: components["responses"]["NotImplemented"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    getOneSoulRoundMapTile: {
        parameters: {
            query?: {
                /** @description A One Soul server id (velocity.toml key). May be left out when there is one One Soul server. */
                server?: string;
            };
            header?: never;
            path: {
                /** @description cycle */
                cycle: string;
                /** @description Map world id: the dimension id with ':' replaced by '_', e.g. minecraft_overworld. */
                world: string;
                /** @description Tile zoom, 0 to the world's zoom.max. */
                z: string;
                /** @description Tile column (integer, may be negative). */
                x: string;
                /** @description Tile row (integer, may be negative). */
                y: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description PNG image */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "image/png": string;
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    getMapMarkers: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Server id (velocity.toml key). */
                server: string;
                /** @description Map world id: the dimension id with ':' replaced by '_', e.g. minecraft_overworld. */
                world: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MapMarkers"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    announce: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AnnounceRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnnounceResponse"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["ContentTooLarge"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
    openapi: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OpenApiDocument"];
                };
            };
            /** @description Not modified (If-None-Match matched the ETag) */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
            500: components["responses"]["InternalError"];
        };
    };
}
