// What "one client" means for the live map's stream limit (FM-7; brief §4.3: 4 streams per client).
// An IPv4 host has one address, an IPv6 host has a whole /64 (2^64 addresses it can pick from freely, and
// privacy extensions rotate them anyway). Counting exact addresses would let one IPv6 host open 4 streams
// from every address it owns and take every stream of the site (MAP_SSE_MAX), so IPv6 is counted by its
// /64 prefix. An IPv4 address written as IPv6 (::ffff:a.b.c.d, as Node reports it on a dual-stack socket)
// counts as that IPv4 address. Anything that is not an address is its own key, as it is.
//
// Pure: no I/O. Never logged (the hub's log lines carry no address).

const V4 = /^(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$/;
const GROUP = /^[0-9a-f]{1,4}$/;

/** The 8 groups of an IPv6 address as numbers, or null when the text is not one. */
function groupsOf(text: string): number[] | null {
  let s = text;
  // a dotted tail (::ffff:1.2.3.4, 64:ff9b::1.2.3.4) is the last two groups
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    if (!V4.test(tail)) return null;
    const [a, b, c, d] = tail.split(".").map(Number);
    s = `${s.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string): number[] | null => {
    if (part === "") return [];
    const out: number[] = [];
    for (const g of part.split(":")) {
      if (!GROUP.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  if (!head || !rest) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const fill = 8 - head.length - rest.length;
  if (fill < 1) return null;
  return [...head, ...new Array<number>(fill).fill(0), ...rest];
}

/**
 * The key the stream limit counts by: an IPv4 address as it is, an IPv6 address as its /64
 * (`2001:db8:1:2::/64`), an IPv4-mapped IPv6 address as the IPv4 address. Brackets, a zone id (`%eth0`)
 * and case are ignored. Text that is not an address comes back trimmed and lower-cased.
 */
export function addressKey(address: string): string {
  let s = address.trim().toLowerCase();
  if (s.startsWith("[")) {
    const end = s.indexOf("]");
    if (end > 0) s = s.slice(1, end);
  }
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  if (V4.test(s)) return s;
  if (!s.includes(":")) return s;
  const g = groupsOf(s);
  if (!g) return s;
  // ::ffff:a.b.c.d: the same host as a.b.c.d
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) return `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  return `${g.slice(0, 4).map((n) => n.toString(16)).join(":")}::/64`;
}
