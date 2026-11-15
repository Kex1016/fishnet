// /map/<server>/live?world=<id>&epoch=<e>&seq=<n> (FM-2; brief §4.3): the live hub's Server-Sent Events.
//   event: players  {at, players, gone}       the full snapshot first, then what changed
//   event: tiles    {world, epoch, tiles, reset}   the shown world's change log (only with ?world=)
//   event: status   {state, as_of}            on connect and whenever cakeutils or the backend comes or goes
//   : hb                                      every 15 s; `retry: 5000`; closed after 30 min (the browser reconnects)
// `epoch` + `seq` = the change log the page loaded with, so the catch-up sends only what is newer. A server not on
// the live map is a 404; past the stream limits (4 per address, MAP_SSE_MAX in all) a 503 with Retry-After. The
// page's fallback after three failures is players.json.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { mapApi } from "#lib/server/cakeutils/client.ts";
import { liveHub } from "#lib/server/map/index.ts";
import { parseInt10, validServerId, validWorldId } from "#lib/map/links.ts";

const EPOCH = /^[A-Za-z0-9._:-]{1,64}$/;

export const GET: RequestHandler = async (event) => {
  const { params, url } = event;
  const server = params.server;
  const m = mapApi();
  if (!validServerId(server) || !m.serverVisible(server, "live")) error(404, "Not found");
  const index = await m.mapServers();
  const entry = index.ok ? index.data.servers.find((s) => s.server === server) : undefined;
  if (index.ok && !entry) error(404, "Not found");
  if (!index.ok && index.kind !== "down" && index.kind !== "rate_limited") error(404, "Not found");

  const w = url.searchParams.get("world");
  // a world the server lists (or, while /v2/map is unreachable, any well-formed id: the hub's poll answers for it)
  const world = w && validWorldId(w) && (!entry || entry.worlds.some((x) => x.id === w)) ? w : null;
  const epoch = url.searchParams.get("epoch");
  const seq = parseInt10(url.searchParams.get("seq") ?? "", 2 ** 31);
  const since = world && epoch && EPOCH.test(epoch) && seq !== null && seq >= 0 ? { epoch, seq } : null;

  let ip = "unknown";
  try {
    ip = event.getClientAddress();
  } catch {
    /* no address (tests, odd adapters): one shared bucket */
  }

  const enc = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let done = false;
  let close = () => {};
  const body = new ReadableStream<Uint8Array>(
    {
      start(c) {
        controller = c;
      },
      cancel() {
        done = true;
        close();
      }
    },
    // nothing is meant to queue: desiredSize is then minus the bytes the reader has not taken yet
    new ByteLengthQueuingStrategy({ highWaterMark: 0 })
  );

  const res = liveHub().subscribe({
    server,
    ip,
    world,
    since,
    sink: {
      write(frame) {
        if (done) return 0;
        controller.enqueue(enc.encode(frame));
        return -(controller.desiredSize ?? 0);
      },
      end() {
        if (done) return;
        done = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    }
  });

  if (!res.ok) {
    if (res.reason === "hidden") error(404, "Not found");
    return new Response("Too many live map streams; try again shortly.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "retry-after": String(res.retryAfter) }
    });
  }
  close = () => res.sub.close();
  event.request.signal?.addEventListener("abort", () => {
    close();
    done = true;
  }, { once: true });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no"
    }
  });
};
