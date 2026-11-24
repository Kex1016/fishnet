// Renders inventory icons with cakeutils' own IconRenderer, so the site's fallback pictures look like the
// catalogue's. Usage: java RenderIcons <client.jar> <extra assets dir> <list file: "<out name> <item id>"> <out dir>
// The extra dir is layered over the jar like a resource pack (synthetic models for items cakeutils cannot draw).
import com.cakes.cakeutils.proxy.stats.icons.AssetSource;
import com.cakes.cakeutils.proxy.stats.icons.IconRenderer;
import com.cakes.cakeutils.protocol.key.NamespacedId;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipFile;

public class RenderIcons {
    public static void main(String[] a) throws Exception {
        ZipFile z = new ZipFile(a[0]);
        Path extra = Path.of(a[1]);
        Path out = Path.of(a[3]);
        AssetSource src = new AssetSource() {
            public byte[] bytes(String p) {
                try {
                    Path f = extra.resolve(p).normalize();
                    if (f.startsWith(extra) && Files.isRegularFile(f)) return Files.readAllBytes(f);
                    var e = z.getEntry("assets/" + p);
                    return e == null ? null : z.getInputStream(e).readAllBytes();
                } catch (Exception x) {
                    return null;
                }
            }
            public JsonObject json(String p) {
                byte[] b = bytes(p);
                if (b == null) return null;
                var j = JsonParser.parseString(new String(b));
                return j.isJsonObject() ? j.getAsJsonObject() : null;
            }
            public byte[] textureMeta(String p) {
                return bytes(p + ".mcmeta");
            }
        };
        IconRenderer r = new IconRenderer();
        int failed = 0;
        for (String line : Files.readAllLines(Path.of(a[2]))) {
            String[] f = line.trim().split("\\s+");
            if (f.length != 2) continue;
            var res = r.render(src, NamespacedId.parse(f[1]));
            if (res.png() == null) {
                System.err.println("no icon: " + f[0] + " (" + f[1] + "): " + res.note());
                failed++;
                continue;
            }
            Files.write(out.resolve(f[0] + ".png"), res.png());
        }
        System.exit(failed == 0 ? 0 : 1);
    }
}
