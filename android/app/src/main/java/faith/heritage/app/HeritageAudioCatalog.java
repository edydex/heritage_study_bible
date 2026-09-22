package faith.heritage.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import java.io.File;
import java.io.ByteArrayOutputStream;
import java.util.Collections;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** Bundled public audio plus issuer-bound Community chapter identities. */
public final class HeritageAudioCatalog {
    public static final String ROOT = "heritage-audio", BOOKS = "books", BIBLES = "bibles", DOWNLOADS = "downloads", CONTINUE = "continue";
    public static final String DOWNLOAD_INDEX = "heritage-audio-downloads-v2";
    public static final class Track {
        public final String id, bookId, editionId, title, bookTitle, author, url;
        public final long durationMs;
        public final JSONObject community;
        public final long bytes;
        Track(JSONObject row, JSONObject book, String edition) {
            this(row, book, edition, false);
        }
        Track(JSONObject row, JSONObject book, String edition, boolean privateBook) {
            id = row.optString("id"); bookId = book.optString("id"); editionId = edition;
            title = row.optString("title"); bookTitle = book.optString("title"); author = book.optString("author");
            url = row.optString("url"); durationMs = (long) (row.optDouble("duration", 0) * 1000);
            community = privateBook ? row.optJSONObject("community") : null;
            bytes = row.optLong("bytes");
            boolean librivox = id.matches("lv-[a-f0-9]{24}") && url.startsWith("https://archive.org/download/");
            boolean bible = id.matches("bsb-hays-[0-9]{2}-[0-9]{3}") && url.matches("https://openbible\\.com/audio/hays/BSB_[0-9]{2}_[A-Za-z0-9]+_[0-9]{3}_H\\.mp3");
            boolean memberBook = privateBook && community != null && id.matches("cb-[a-f0-9]{24}-[0-9]+") && bytes > 0 && bytes <= 512L * 1024 * 1024;
            if (privateBook ? !memberBook : !librivox && !bible) throw new IllegalArgumentException("Invalid audio track");
        }
    }
    public synchronized void reloadCommunityBooks() {
        List<String> obsolete = new ArrayList<>();
        for (Track track : tracks.values()) if (track.community != null) obsolete.add(track.id);
        java.util.Set<String> bookNodes = new java.util.HashSet<>();
        for (String id : obsolete) { bookNodes.add("book:" + tracks.get(id).bookId); tracks.remove(id); }
        for (String node : bookNodes) { folders.remove(node); children.remove(node); children.get(BOOKS).remove(node); }
        try {
            JSONArray books = new JSONArray(preferences.getString(CommunityAudioStore.INDEX, "[]"));
            for (int b = 0; b < Math.min(books.length(), 100); b++) {
                JSONObject book = books.getJSONObject(b), identity = book.getJSONObject("community");
                if (!book.optString("id").matches("remote--[A-Za-z0-9._-]+--books--[0-9]+")) continue;
                if (!CommunityAudioStore.authorized(context, identity)) continue;
                JSONArray rows = book.getJSONArray("editions").getJSONObject(0).getJSONArray("tracks");
                String node = "book:" + book.getString("id");
                folder(node, book.getString("title"), BOOKS);
                for (int t = 0; t < Math.min(rows.length(), 2000); t++) {
                    Track track = new Track(rows.getJSONObject(t), book, "community", true);
                    if (!CommunityAudioStore.authorized(context, track.community)) continue;
                    tracks.put(track.id, track); children.get(node).add(track.id);
                }
            }
        } catch (Exception ignored) { /* Invalid private metadata never becomes a playback URI. */ }
    }
    private final Context context;
    private final SharedPreferences preferences;
    private String cachedDownloadText;
    private JSONObject cachedDownloads = new JSONObject();
    public final Map<String, Track> tracks = new LinkedHashMap<>();
    private final Map<String, MediaItem> folders = new LinkedHashMap<>();
    private final Map<String, List<String>> children = new LinkedHashMap<>();
    public HeritageAudioCatalog(Context context) throws Exception {
        this.context = context.getApplicationContext();
        preferences = this.context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        folder(ROOT, "Heritage audio", null);
        folder(CONTINUE, "Continue listening", ROOT); folder(DOWNLOADS, "Downloaded", ROOT); folder(BOOKS, "Audiobooks", ROOT); folder(BIBLES, "Bible · BSB", ROOT);
        try (InputStream input = this.context.getAssets().open("audio-catalog.json")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192]; int count;
            while ((count = input.read(chunk)) != -1) bytes.write(chunk, 0, count);
            JSONArray books = new JSONObject(bytes.toString(StandardCharsets.UTF_8.name())).getJSONArray("books");
            for (int b = 0; b < books.length(); b++) {
                JSONObject book = books.getJSONObject(b);
                String bookNode = "book:" + book.getString("id");
                folder(bookNode, book.getString("title"), "bible".equals(book.optString("kind")) ? BIBLES : BOOKS);
                JSONArray editions = book.getJSONArray("editions");
                for (int e = 0; e < editions.length(); e++) {
                    JSONObject edition = editions.getJSONObject(e);
                    String parent = bookNode, editionId = edition.getString("id");
                    if (editions.length() > 1) {
                        parent = "edition:" + book.getString("id") + ":" + editionId;
                        folder(parent, edition.getString("title"), bookNode);
                    }
                    JSONArray rows = edition.getJSONArray("tracks");
                    for (int t = 0; t < rows.length(); t++) {
                        Track track = new Track(rows.getJSONObject(t), book, editionId);
                        if (tracks.put(track.id, track) != null) throw new IllegalArgumentException("Duplicate audio ID");
                        children.get(parent).add(track.id);
                    }
                }
            }
        }
        reloadCommunityBooks();
    }
    private void folder(String id, String title, String parent) {
        folders.put(id, new MediaItem.Builder().setMediaId(id).setMediaMetadata(new MediaMetadata.Builder()
            .setTitle(title).setIsBrowsable(true).setIsPlayable(false).setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_MIXED).build()).build());
        children.put(id, new ArrayList<>());
        if (parent != null) children.get(parent).add(id);
    }
    public synchronized Track track(String id) { return tracks.get(id); }
    public boolean isFolder(String id) { return folders.containsKey(id); }
    public File downloadedFile(String id) {
        if (!tracks.containsKey(id)) return null;
        try {
            Track track = tracks.get(id);
            if (track.community != null) {
                File file = CommunityAudioStore.path(context, track.community, true);
                return CommunityAudioStore.authorized(context, track.community) && file.isFile() && file.length() == track.bytes ? file : null;
            }
            String text = preferences.getString(DOWNLOAD_INDEX, "{}");
            if (!text.equals(cachedDownloadText)) { cachedDownloads = new JSONObject(text); cachedDownloadText = text; }
            JSONObject record = cachedDownloads.optJSONObject(id);
            if (record == null) return null;
            String path = record.optString("path");
            if (!path.matches("heritage-audio/[a-zA-Z0-9.-]+\\.mp3")) return null;
            File root = new File(context.getFilesDir(), "heritage-audio").getCanonicalFile();
            File file = new File(context.getFilesDir(), path).getCanonicalFile();
            if (!root.equals(file.getParentFile()) || !file.isFile() || file.length() <= 0) return null;
            return file;
        } catch (Exception ignored) { return null; }
    }
    public MediaItem item(String id, boolean playableUri) {
        Track track = tracks.get(id);
        if (track == null) return folders.get(id);
        File local = downloadedFile(id);
        MediaItem.Builder builder = new MediaItem.Builder().setMediaId(id).setMediaMetadata(new MediaMetadata.Builder()
            .setTitle(track.title).setArtist(track.author).setAlbumTitle(track.bookTitle)
            .setSubtitle(track.bookTitle + (local != null ? " · Downloaded" : ""))
            .setIsBrowsable(false).setIsPlayable(true).setMediaType(MediaMetadata.MEDIA_TYPE_AUDIO_BOOK_CHAPTER).build());
        if (playableUri) builder.setUri(track.community != null ? Uri.parse("heritage-book:///" + track.id) : local != null ? Uri.fromFile(local) : Uri.parse(track.url));
        return builder.build();
    }
    public List<MediaItem> children(String id, String lastId) {
        List<MediaItem> result = new ArrayList<>();
        if (CONTINUE.equals(id)) { if (tracks.containsKey(lastId)) result.add(item(lastId, false)); return result; }
        if (DOWNLOADS.equals(id)) { for (String key : tracks.keySet()) if (downloadedFile(key) != null) result.add(item(key, false)); return result; }
        for (String key : children.getOrDefault(id, Collections.emptyList())) result.add(item(key, false));
        return result;
    }
    public List<MediaItem> queue(String id) {
        List<MediaItem> result = new ArrayList<>();
        Track selected = tracks.get(id);
        if (selected != null) for (Track track : tracks.values()) if (track.bookId.equals(selected.bookId)) result.add(item(track.id, true));
        return result;
    }
    public List<MediaItem> search(String query) {
        List<MediaItem> result = new ArrayList<>();
        String normalized = query.trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty() || normalized.length() > 200) return result;
        for (Track track : tracks.values()) if ((track.bookTitle + " " + track.author + " " + track.title).toLowerCase(Locale.ROOT).contains(normalized)) result.add(item(track.id, false));
        return result;
    }
}
