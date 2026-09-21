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

/** The bundled public catalog is the only authority for playable URLs and IDs. */
public final class HeritageAudioCatalog {
    public static final String ROOT = "heritage-audio", BOOKS = "books", DOWNLOADS = "downloads", CONTINUE = "continue";
    public static final String DOWNLOAD_INDEX = "heritage-audio-downloads-v2";
    public static final class Track {
        public final String id, bookId, editionId, title, bookTitle, author, url;
        public final long durationMs;
        Track(JSONObject row, JSONObject book, String edition) {
            id = row.optString("id"); bookId = book.optString("id"); editionId = edition;
            title = row.optString("title"); bookTitle = book.optString("title"); author = book.optString("author");
            url = row.optString("url"); durationMs = (long) (row.optDouble("duration", 0) * 1000);
            if (!id.matches("lv-[a-f0-9]{24}") || !url.startsWith("https://archive.org/download/")) throw new IllegalArgumentException("Invalid bundled audio track");
        }
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
        folder(CONTINUE, "Continue listening", ROOT); folder(DOWNLOADS, "Downloaded", ROOT); folder(BOOKS, "Audiobooks", ROOT);
        try (InputStream input = this.context.getAssets().open("audio-catalog.json")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192]; int count;
            while ((count = input.read(chunk)) != -1) bytes.write(chunk, 0, count);
            JSONArray books = new JSONObject(bytes.toString(StandardCharsets.UTF_8.name())).getJSONArray("books");
            for (int b = 0; b < books.length(); b++) {
                JSONObject book = books.getJSONObject(b);
                String bookNode = "book:" + book.getString("id");
                folder(bookNode, book.getString("title"), BOOKS);
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
    }
    private void folder(String id, String title, String parent) {
        folders.put(id, new MediaItem.Builder().setMediaId(id).setMediaMetadata(new MediaMetadata.Builder()
            .setTitle(title).setIsBrowsable(true).setIsPlayable(false).setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_MIXED).build()).build());
        children.put(id, new ArrayList<>());
        if (parent != null) children.get(parent).add(id);
    }
    public Track track(String id) { return tracks.get(id); }
    public boolean isFolder(String id) { return folders.containsKey(id); }
    public File downloadedFile(String id) {
        if (!tracks.containsKey(id)) return null;
        try {
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
        if (playableUri) builder.setUri(local != null ? Uri.fromFile(local) : Uri.parse(track.url));
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
