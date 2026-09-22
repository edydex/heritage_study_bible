package faith.heritage.app;

import android.content.Context;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.*;
import org.json.JSONObject;

/** Private, hash-checked chapter files. URLs are exact church book endpoints;
 * redirects are never followed and credentials are read from Android Keystore. */
final class CommunityAudioStore {
    static final String INDEX = "heritage-community-audio-active-v1";
    static String token(Context context, JSONObject identity) throws Exception {
        String raw = HeritageSecureStoragePlugin.readValue(context, "heritage-community-sessions-v1");
        JSONObject session = new JSONObject(raw == null ? "{}" : raw).optJSONObject(identity.getString("communityId"));
        URI url = new URI(identity.getString("contentUrl"));
        String origin = url.getScheme() + "://" + url.getRawAuthority();
        if (session == null || !"https".equals(url.getScheme()) || url.getUserInfo() != null
            || !url.getPath().matches("/content/books/[0-9]+") || url.getQuery() != null || url.getFragment() != null
            || !origin.equals(session.optString("issuerOrigin"))
            || session.optJSONObject("member") == null
            || !identity.getString("memberId").equals(session.getJSONObject("member").optString("id"))) throw new IOException("Community sign-in required");
        String expires = session.optString("expiresAt");
        if (!expires.isEmpty()) {
            SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT);
            format.setTimeZone(TimeZone.getTimeZone("UTC"));
            if (format.parse(expires).getTime() <= System.currentTimeMillis()) throw new IOException("Community sign-in expired");
        }
        String value = session.optString("token");
        if (value.isEmpty() || value.matches("(?s).*[\\x00-\\x1f\\x7f].*")) throw new IOException("Invalid Community session");
        return "Community " + value;
    }
    static boolean authorized(Context context, JSONObject identity) {
        try { token(context, identity); return true; } catch (Exception ignored) { return false; }
    }
    static File path(Context context, JSONObject identity, boolean downloaded) throws Exception {
        String scope = identity.getString("scope"), hash = identity.getString("audioSha256");
        if (!scope.matches("[a-f0-9]{64}") || !hash.matches("[a-f0-9]{64}")) throw new IOException("Invalid chapter identity");
        return new File(downloaded ? context.getFilesDir() : context.getCacheDir(), "heritage-community-books/" + scope + "/" + hash + ".mp3");
    }
    static boolean valid(File file, JSONObject identity, long size) throws Exception {
        if (!file.isFile() || file.length() != size) return false;
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(file)) { byte[] buffer = new byte[65536]; int count; while ((count = in.read(buffer)) != -1) sha.update(buffer, 0, count); }
        StringBuilder hex = new StringBuilder(); for (byte b : sha.digest()) hex.append(String.format(Locale.ROOT, "%02x", b));
        return hex.toString().equals(identity.getString("audioSha256"));
    }
    static File prepare(Context context, HeritageAudioCatalog.Track track) throws IOException {
        try {
            JSONObject identity = track.community;
            String authorization = token(context, identity);
            File saved = path(context, identity, true);
            if (valid(saved, identity, track.bytes)) return saved;
            File cached = path(context, identity, false);
            if (valid(cached, identity, track.bytes)) return cached;
            URI content = new URI(identity.getString("contentUrl"));
            String id = content.getPath().substring(content.getPath().lastIndexOf('/') + 1);
            String expected = content.getScheme() + "://" + content.getRawAuthority() + "/api/community/books/" + id + "/audio/" + identity.getString("chapterId");
            if (!expected.equals(track.url) || !identity.getString("chapterId").matches("[A-Za-z0-9._-]{1,128}")) throw new IOException("Invalid book audio endpoint");
            HttpURLConnection connection = (HttpURLConnection) new URL(expected).openConnection();
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(15000); connection.setReadTimeout(30000);
            connection.setRequestProperty("Authorization", authorization);
            connection.setRequestProperty("Cache-Control", "no-store");
            cached.getParentFile().mkdirs();
            File partial = new File(cached.getPath() + ".part");
            try {
                if (connection.getResponseCode() != 200) throw new IOException("Book audio access refused");
                long total = 0;
                try (InputStream in = connection.getInputStream(); OutputStream out = new FileOutputStream(partial)) {
                    byte[] buffer = new byte[65536]; int count;
                    while ((count = in.read(buffer)) != -1) { total += count; if (total > track.bytes) throw new IOException("Unexpected chapter size"); out.write(buffer, 0, count); }
                }
                if (!valid(partial, identity, track.bytes)) throw new IOException("Audio does not match text timings");
                token(context, identity); // Sign-out during transfer cannot start playback.
                if (!partial.renameTo(cached)) throw new IOException("Could not save chapter");
                return cached;
            } finally { connection.disconnect(); partial.delete(); }
        } catch (IOException error) { throw error; }
        catch (Exception error) { throw new IOException("Community audio unavailable", error); }
    }
}
