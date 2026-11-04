// Generated from openapi.json by scripts/gen-types.ts. Do not edit by hand: bun run types
// Milestones (cakeutils D-109) are not in the document yet; their types are hand-written in types.ts.

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
         * Servers (id, display_name, online player count, players waiting for it, mc_version, platform) and the total online.
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
        };
        StatList: {
            uuid: string;
            scope: string;
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
                /** @description network (default), server:<id> or mini:<server-id>/<mini-id>. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
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
                /** @description network (default), server:<id> or mini:<server-id>/<mini-id>. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
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
                /** @description network (default), server:<id> or mini:<server-id>/<mini-id>. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
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
                /** @description network (default), server:<id> or mini:<server-id>/<mini-id>. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
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
                /** @description network (default), server:<id> or mini:<server-id>/<mini-id>. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
                scope?: string;
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
                /** @description network (default), server:<id> or mini:<server-id>/<mini-id>. A private mini-server (public:false) answers exactly like one that was never seen, for every token. */
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
