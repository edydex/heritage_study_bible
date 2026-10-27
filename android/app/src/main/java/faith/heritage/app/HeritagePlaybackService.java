package faith.heritage.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.session.LibraryResult;
import androidx.media3.session.MediaLibraryService;
import androidx.media3.session.MediaSession;
import androidx.media3.session.SessionCommand;
import androidx.media3.session.SessionResult;
import androidx.media3.session.SessionError;
import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.ArrayList;
import java.util.Collections;
import java.util.UUID;
import java.util.List;
import org.json.JSONObject;

@UnstableApi
public class HeritagePlaybackService extends MediaLibraryService {
    public static final String COMMAND = "heritage.audio.command", PROGRESS = "heritage-audio-progress-v1";
    private static volatile boolean playbackActive;
    private static volatile int livePlayers;
    static boolean hasLivePlayer() { return livePlayers > 0; }
    public static boolean isPlaybackActive() { return playbackActive; }
    private ExoPlayer player;
    private MediaLibrarySession session;
    private HeritageAudioCatalog catalog;
    private SharedPreferences preferences;
    private SharedPreferences securePreferences;
    private JSONObject positions = new JSONObject();
    private JSONObject lastPlayed = new JSONObject();
    private String lastId = "";
    private String completedCursorId = "";
    private static final int MAX_PROGRESS_TRACKS = 10000;
    private float speed = 1f;
    private long revision = 0;
    private final String sessionId = UUID.randomUUID().toString();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable saveTick = new Runnable() { public void run() { persist(); handler.postDelayed(this, 5000); } };
    private final SharedPreferences.OnSharedPreferenceChangeListener preferencesChanged = (prefs, key) -> {
        if ((CommunityAudioStore.INDEX.equals(key) || "heritage-community-sessions-v1".equals(key)) && session != null) {
            handler.post(() -> {
                catalog.reloadCommunityBooks();
                MediaItem current = player.getCurrentMediaItem();
                if (current != null && current.mediaId.startsWith("cb-") && catalog.track(current.mediaId) == null) {
                    persist(); player.stop(); player.clearMediaItems(); lastId = "";
                }
                session.notifyChildrenChanged(HeritageAudioCatalog.BOOKS, catalog.children(HeritageAudioCatalog.BOOKS, lastId).size(), null);
                session.notifyChildrenChanged(HeritageAudioCatalog.DOWNLOADS, catalog.children(HeritageAudioCatalog.DOWNLOADS, lastId).size(), null);
                session.notifyChildrenChanged(HeritageAudioCatalog.CONTINUE, catalog.continueListening(lastId, positions, lastPlayed).size(), null);
            });
        }
        if (HeritageAudioCatalog.DOWNLOAD_INDEX.equals(key) && session != null) {
            session.notifyChildrenChanged(HeritageAudioCatalog.DOWNLOADS, catalog.children(HeritageAudioCatalog.DOWNLOADS, lastId).size(), null);
            // A download or deletion can happen after the queue was built. Keep
            // later tracks current without interrupting the recording in use.
            if (player.getPlaybackState() == Player.STATE_IDLE && catalog.track(lastId) != null) restore(lastId, false);
            else for (int i = 0; i < player.getMediaItemCount(); i++) {
                if (i == player.getCurrentMediaItemIndex()) continue;
                MediaItem replacement = catalog.item(player.getMediaItemAt(i).mediaId, true);
                if (replacement != null) player.replaceMediaItem(i, replacement);
            }
        }
    };
    @Override public void onCreate() {
        super.onCreate();
        livePlayers++;
        try { catalog = new HeritageAudioCatalog(this); }
        catch (Exception error) { throw new IllegalStateException("The bundled audio catalog could not load", error); }
        preferences = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        try {
            JSONObject saved = new JSONObject(preferences.getString(PROGRESS, "{}"));
            String savedLastId = saved.optString("lastTrackId", "");
            JSONObject raw = saved.optJSONObject("positions");
            readProgressValues(raw, positions, savedLastId);
            JSONObject times = saved.optJSONObject("lastPlayed");
            readProgressValues(times, lastPlayed, savedLastId);
            lastId = savedLastId; if (catalog.track(lastId) == null) lastId = "";
            if (lastId.isEmpty()) {
                List<MediaItem> recent = catalog.continueListening(lastId, positions, lastPlayed);
                if (!recent.isEmpty()) lastId = recent.get(0).mediaId;
            }
            speed = validSpeed((float) saved.optDouble("rate", 1));
        } catch (Exception ignored) { /* Invalid saved values never become media URIs. */ }
        player = new ExoPlayer.Builder(this)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this, () -> new CommunityAudioDataSource(this, catalog))))
            .setSeekBackIncrementMs(15000).setSeekForwardIncrementMs(15000).build();
        player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(), true);
        player.setHandleAudioBecomingNoisy(true);
        player.setWakeMode(C.WAKE_MODE_LOCAL);
        player.setPlaybackSpeed(speed);
        if (!lastId.isEmpty()) restore(lastId, false); // Queue metadata only; never prepare/play on launch.
        player.addListener(new Player.Listener() {
            @Override public void onEvents(Player player, Player.Events events) {
                playbackActive = player.getPlayWhenReady() && (player.getPlaybackState() == Player.STATE_READY || player.getPlaybackState() == Player.STATE_BUFFERING) && player.getPlayerError() == null;
                if (player.getPlayWhenReady() && (events.contains(Player.EVENT_PLAY_WHEN_READY_CHANGED) || events.contains(Player.EVENT_MEDIA_ITEM_TRANSITION))) {
                    MediaItem current = player.getCurrentMediaItem();
                    if (current != null) {
                        if (!current.mediaId.equals(completedCursorId)) completedCursorId = "";
                        markPlayed(current.mediaId);
                    }
                }
                if (events.contains(Player.EVENT_IS_PLAYING_CHANGED) || events.contains(Player.EVENT_MEDIA_ITEM_TRANSITION) || events.contains(Player.EVENT_PLAY_WHEN_READY_CHANGED)
                    || events.contains(Player.EVENT_PLAYBACK_PARAMETERS_CHANGED) || events.contains(Player.EVENT_PLAYBACK_STATE_CHANGED)) persist();
            }
            @Override public void onPositionDiscontinuity(Player.PositionInfo oldPosition, Player.PositionInfo newPosition, int reason) {
                if (reason == Player.DISCONTINUITY_REASON_SEEK) completedCursorId = "";
                if (oldPosition.mediaItem != null) remember(oldPosition.mediaItem.mediaId, oldPosition.positionMs);
                persist();
            }
            @Override public void onPlayerError(PlaybackException error) { persist(); }
        });
        Intent open = new Intent(this, MainActivity.class).setAction("faith.heritage.app.OPEN_AUDIO").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        session = new MediaLibrarySession.Builder(this, player, new LibraryCallback())
            .setSessionActivity(PendingIntent.getActivity(this, 21, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)).build();
        preferences.registerOnSharedPreferenceChangeListener(preferencesChanged);
        securePreferences = getSharedPreferences("heritage_secure_storage", Context.MODE_PRIVATE);
        securePreferences.registerOnSharedPreferenceChangeListener(preferencesChanged);
        handler.postDelayed(saveTick, 5000);
    }
    private static float validSpeed(float value) { return value == .75f || value == 1f || value == 1.25f || value == 1.5f || value == 1.75f || value == 2f ? value : 1f; }
    private boolean validProgressId(String id) {
        return catalog.track(id) != null || id.matches("cb-[a-f0-9]{24}-[0-9]{1,4}") && Integer.parseInt(id.substring(28)) < 2000;
    }
    private void readProgressValues(JSONObject raw, JSONObject target, String preferredId) throws org.json.JSONException {
        if (raw == null) return;
        double preferred = raw.optDouble(preferredId, -1);
        if (validProgressId(preferredId) && Double.isFinite(preferred) && preferred >= 0) target.put(preferredId, preferred);
        java.util.Iterator<String> ids = raw.keys();
        while (ids.hasNext() && target.length() < MAX_PROGRESS_TRACKS) {
            String id = ids.next();
            // Keep private chapter cursors through sign-out/restart. These IDs
            // never authorize a title, URI or playback without the catalog.
            if (!validProgressId(id)) continue;
            double value = raw.optDouble(id, -1);
            if (Double.isFinite(value) && value >= 0) target.put(id, value);
        }
    }
    private void trimProgressValues(JSONObject values) {
        if (values.length() <= MAX_PROGRESS_TRACKS) return;
        List<String> ids = new ArrayList<>(); values.keys().forEachRemaining(ids::add);
        ids.sort((a, b) -> a.equals(b) ? 0 : a.equals(lastId) ? 1 : b.equals(lastId) ? -1
            : Double.compare(lastPlayed.optDouble(a, 0), lastPlayed.optDouble(b, 0)));
        for (int index = 0; values.length() > MAX_PROGRESS_TRACKS; index++) values.remove(ids.get(index));
    }
    private boolean preserveCompletedCursor(String id) { return id.equals(completedCursorId) && !player.getPlayWhenReady(); }
    private long savedPosition(String id) {
        double seconds = positions.optDouble(id, 0);
        long millis = Double.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : 0;
        HeritageAudioCatalog.Track track = catalog.track(id);
        return track != null && track.durationMs > 0 ? Math.min(millis, track.durationMs) : millis;
    }
    private void remember(String id, long millis) {
        if (catalog.track(id) == null || millis < 0 || preserveCompletedCursor(id)) return;
        try { positions.put(id, millis / 1000d); } catch (Exception ignored) {}
    }
    private void markPlayed(String id) {
        if (catalog.track(id) == null) return;
        try { lastPlayed.put(id, System.currentTimeMillis()); } catch (Exception ignored) {}
        if (session != null) session.notifyChildrenChanged(HeritageAudioCatalog.CONTINUE,
            catalog.continueListening(id, positions, lastPlayed).size(), null);
    }
    private void persist() {
        if (player == null) return;
        MediaItem current = player.getCurrentMediaItem();
        if (current != null && catalog.track(current.mediaId) != null) { lastId = current.mediaId; remember(lastId, player.getCurrentPosition()); }
        speed = validSpeed(player.getPlaybackParameters().speed);
        trimProgressValues(positions); trimProgressValues(lastPlayed);
        try {
            JSONObject saved = new JSONObject().put("lastTrackId", lastId).put("positions", positions).put("lastPlayed", lastPlayed).put("rate", speed);
            preferences.edit().putString(PROGRESS, saved.toString()).apply();
        } catch (Exception ignored) {}
    }
    private MediaSession.MediaItemsWithStartPosition restoredQueue(String id, boolean restart) {
        List<MediaItem> items = catalog.queue(id);
        int index = 0; for (int i = 0; i < items.size(); i++) if (items.get(i).mediaId.equals(id)) { index = i; break; }
        return new MediaSession.MediaItemsWithStartPosition(items, index, restart ? 0 : savedPosition(id));
    }
    private MediaSession.MediaItemsWithStartPosition playbackQueue(String id, boolean restart) {
        HeritageAudioCatalog.Track track = catalog.track(id);
        boolean completed = track != null && track.durationMs > 0 && savedPosition(id) >= track.durationMs;
        return restoredQueue(id, restart || completed);
    }
    private void restore(String id, boolean restart) {
        HeritageAudioCatalog.Track track = catalog.track(id);
        completedCursorId = !restart && track != null && track.durationMs > 0 && savedPosition(id) >= track.durationMs ? id : "";
        MediaSession.MediaItemsWithStartPosition queue = restoredQueue(id, restart);
        player.setMediaItems(queue.mediaItems, queue.startIndex, queue.startPositionMs);
    }
    private void play(String id, boolean restart) {
        if (catalog.track(id) == null) throw new IllegalArgumentException("Unknown recording");
        persist();
        boolean replayCompleted = id.equals(completedCursorId);
        completedCursorId = "";
        MediaItem current = player.getCurrentMediaItem();
        if (restart || replayCompleted || current == null || !id.equals(current.mediaId) || player.getPlaybackState() == Player.STATE_IDLE || player.getPlayerError() != null || player.getPlaybackState() == Player.STATE_ENDED) {
            MediaSession.MediaItemsWithStartPosition queue = playbackQueue(id, restart);
            player.setMediaItems(queue.mediaItems, queue.startIndex, queue.startPositionMs);
        }
        markPlayed(id); player.prepare(); player.play(); persist();
    }
    private Bundle snapshot() {
        MediaItem current = player.getCurrentMediaItem();
        String id = current != null ? current.mediaId : lastId;
        HeritageAudioCatalog.Track track = catalog.track(id);
        long duration = player.getDuration(); if (duration == C.TIME_UNSET || duration < 0) duration = track != null ? track.durationMs : 0;
        boolean completedCursor = track != null && preserveCompletedCursor(id);
        if (completedCursor) duration = track.durationMs;
        String status = track == null ? "idle" : player.getPlayerError() != null ? "error" : player.isPlaying() ? "playing"
            : player.getPlayWhenReady() && player.getPlaybackState() == Player.STATE_BUFFERING ? "loading" : "paused";
        JSONObject state = new JSONObject();
        try {
            state.put("trackId", track != null ? id : JSONObject.NULL).put("position", current != null && !completedCursor ? player.getCurrentPosition() / 1000d : savedPosition(id) / 1000d)
                .put("duration", duration / 1000d).put("rate", player.getPlaybackParameters().speed).put("status", status)
                .put("offline", current != null && (track != null && track.community != null ? catalog.downloadedFile(id) != null : current.localConfiguration != null && "file".equals(current.localConfiguration.uri.getScheme())))
                .put("error", player.getPlayerError() == null ? "" : "Audio could not load. Check your connection or try Play again. Your saved position is kept.")
                .put("positions", positions).put("lastPlayed", lastPlayed)
                .put("sessionId", sessionId).put("revision", ++revision);
        } catch (Exception ignored) {}
        Bundle bundle = new Bundle(); bundle.putString("state", state.toString()); return bundle;
    }
    @Override public MediaLibrarySession onGetSession(MediaSession.ControllerInfo controllerInfo) { return session; }
    @Override public void onDestroy() {
        handler.removeCallbacksAndMessages(null); persist(); playbackActive = false;
        if (preferences != null) preferences.unregisterOnSharedPreferenceChangeListener(preferencesChanged);
        if (securePreferences != null) securePreferences.unregisterOnSharedPreferenceChangeListener(preferencesChanged);
        if (session != null) session.release();
        if (player != null) player.release();
        super.onDestroy();
        livePlayers--;
    }
    private final class LibraryCallback implements MediaLibrarySession.Callback {
        @Override public ListenableFuture<MediaSession.ConnectionResult> onConnectAsync(MediaSession mediaSession, MediaSession.ControllerInfo controller) {
            boolean verified = controller.isPackageNameVerified();
            if (!verified && controller.getUid() >= 0) {
                String[] packages = getPackageManager().getPackagesForUid(controller.getUid());
                verified = packages != null && java.util.Arrays.asList(packages).contains(controller.getPackageName());
            }
            if (verified && mediaSession.isAutoCompanionController(controller) && player.getPlaybackState() == Player.STATE_IDLE
                && !player.getPlayWhenReady() && player.getCurrentMediaItem() != null) {
                // Legacy STATE_NONE hides the car's playback screen. Preparing
                // the restored queue exposes paused controls without autoplay.
                player.prepare();
            }
            MediaSession.ConnectionResult.AcceptedResultBuilder builder = new MediaSession.ConnectionResult.AcceptedResultBuilder(mediaSession, controller);
            if (controller.getUid() == android.os.Process.myUid()) builder.setAvailableSessionCommands(
                MediaSession.ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS.buildUpon().add(new SessionCommand(COMMAND, Bundle.EMPTY)).build());
            return Futures.immediateFuture(builder.build());
        }
        @Override public ListenableFuture<LibraryResult<MediaItem>> onGetLibraryRoot(MediaLibrarySession session, MediaSession.ControllerInfo browser, @Nullable LibraryParams params) {
            String root = params != null && params.isRecent ? HeritageAudioCatalog.CONTINUE
                : params != null && params.isOffline ? HeritageAudioCatalog.DOWNLOADS : HeritageAudioCatalog.ROOT;
            return Futures.immediateFuture(LibraryResult.ofItem(catalog.item(root, false), params));
        }
        @Override public ListenableFuture<LibraryResult<MediaItem>> onGetItem(MediaLibrarySession session, MediaSession.ControllerInfo browser, String id) {
            MediaItem item = catalog.item(id, false);
            return Futures.immediateFuture(item == null ? LibraryResult.ofError(SessionError.ERROR_BAD_VALUE) : LibraryResult.ofItem(item, null));
        }
        private LibraryResult<ImmutableList<MediaItem>> page(List<MediaItem> items, int page, int size, @Nullable LibraryParams params) {
            if (page < 0 || size < 1) return LibraryResult.ofError(SessionError.ERROR_BAD_VALUE);
            long start = (long) page * size;
            if (start >= items.size()) return LibraryResult.ofItemList(Collections.emptyList(), params);
            return LibraryResult.ofItemList(items.subList((int) start, (int) Math.min(items.size(), start + size)), params);
        }
        @Override public ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> onGetChildren(MediaLibrarySession session, MediaSession.ControllerInfo browser, String parent, int page, int size, @Nullable LibraryParams params) {
            return Futures.immediateFuture(catalog.isFolder(parent) ? page(catalog.children(parent, lastId, positions, lastPlayed), page, size, params) : LibraryResult.ofError(SessionError.ERROR_BAD_VALUE));
        }
        @Override public ListenableFuture<LibraryResult<Void>> onSearch(MediaLibrarySession session, MediaSession.ControllerInfo browser, String query, @Nullable LibraryParams params) {
            session.notifySearchResultChanged(browser, query, catalog.search(query).size(), params);
            return Futures.immediateFuture(LibraryResult.ofVoid());
        }
        @Override public ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> onGetSearchResult(MediaLibrarySession session, MediaSession.ControllerInfo browser, String query, int page, int size, @Nullable LibraryParams params) {
            return Futures.immediateFuture(page(catalog.search(query), page, size, params));
        }
        @Override public ListenableFuture<List<MediaItem>> onAddMediaItems(MediaSession session, MediaSession.ControllerInfo controller, List<MediaItem> requested) {
            List<MediaItem> resolved = new ArrayList<>();
            if (requested.size() > catalog.tracks.size()) return Futures.immediateFailedFuture(new IllegalArgumentException("Too many recordings"));
            for (MediaItem item : requested) {
                if (catalog.track(item.mediaId) == null) return Futures.immediateFailedFuture(new IllegalArgumentException("Unknown recording"));
                resolved.add(catalog.item(item.mediaId, true)); // Ignore all caller-supplied URLs and metadata.
            }
            return Futures.immediateFuture(resolved);
        }
        @Override public ListenableFuture<MediaSession.MediaItemsWithStartPosition> onSetMediaItems(MediaSession session, MediaSession.ControllerInfo controller, List<MediaItem> requested, int startIndex, long startPositionMs) {
            persist();
            completedCursorId = "";
            if (requested.size() == 1 && requested.get(0).requestMetadata.searchQuery != null) {
                List<MediaItem> matches = catalog.search(requested.get(0).requestMetadata.searchQuery);
                if (matches.isEmpty()) return Futures.immediateFailedFuture(new IllegalArgumentException("No matching recording"));
                return Futures.immediateFuture(playbackQueue(matches.get(0).mediaId, false));
            }
            if (requested.size() == 1 && catalog.track(requested.get(0).mediaId) != null) {
                MediaSession.MediaItemsWithStartPosition queue = playbackQueue(requested.get(0).mediaId, false);
                long position = startIndex != C.INDEX_UNSET && startPositionMs != C.TIME_UNSET ? Math.max(0, startPositionMs) : queue.startPositionMs;
                return Futures.immediateFuture(new MediaSession.MediaItemsWithStartPosition(queue.mediaItems, queue.startIndex, position));
            }
            return MediaLibrarySession.Callback.super.onSetMediaItems(session, controller, requested, startIndex, startPositionMs);
        }
        @Override public ListenableFuture<MediaSession.MediaItemsWithStartPosition> onPlaybackResumption(MediaSession session, MediaSession.ControllerInfo controller, boolean forPlayback) {
            player.setPlaybackSpeed(speed);
            if (forPlayback) completedCursorId = "";
            if (catalog.track(lastId) == null) {
                // An empty first launch has no recording to resume. Give the
                // car a useful message while retaining browsing/play commands.
                if (forPlayback) session.sendError(controller, new SessionError(SessionError.ERROR_INVALID_STATE,
                    "Choose a recording from Audiobooks or Bible first.", Bundle.EMPTY));
                return Futures.immediateFailedFuture(new UnsupportedOperationException("No saved recording"));
            }
            return Futures.immediateFuture(forPlayback ? playbackQueue(lastId, false) : restoredQueue(lastId, false));
        }
        @Override public void onPlayerInteractionFinished(MediaSession session, MediaSession.ControllerInfo controller, Player.Commands commands) {
            if (!commands.contains(Player.COMMAND_PLAY_PAUSE) || !player.getPlayWhenReady()) return;
            MediaItem current = player.getCurrentMediaItem();
            HeritageAudioCatalog.Track track = current == null ? null : catalog.track(current.mediaId);
            boolean replayCompleted = current != null && current.mediaId.equals(completedCursorId);
            completedCursorId = "";
            // A car can issue plain Play against the metadata-only queue. Keep
            // its completed cursor on launch, then replay only on that command.
            if (track != null && (replayCompleted || track.durationMs > 0 && player.getCurrentPosition() >= track.durationMs)) {
                player.seekTo(0); persist();
            }
        }
        @Override public ListenableFuture<SessionResult> onCustomCommand(MediaSession session, MediaSession.ControllerInfo controller, SessionCommand command, Bundle args) {
            if (!COMMAND.equals(command.customAction) || controller.getUid() != android.os.Process.myUid()) return Futures.immediateFuture(new SessionResult(SessionError.ERROR_PERMISSION_DENIED));
            try {
                switch (args.getString("action", "state")) {
                    case "play": play(args.getString("trackId", lastId), args.getBoolean("restart", false)); break;
                    case "pause": player.pause(); persist(); break;
                    case "seek": {
                        double seconds = args.getDouble("position", 0);
                        if (!Double.isFinite(seconds) || seconds < 0) throw new IllegalArgumentException();
                        completedCursorId = "";
                        player.seekTo((long) (seconds * 1000)); persist(); break;
                    }
                    case "rate": player.setPlaybackSpeed(validSpeed((float) args.getDouble("rate", 1))); persist(); break;
                    case "skip": {
                        int target = player.getCurrentMediaItemIndex() + (args.getInt("direction", 1) < 0 ? -1 : 1);
                        if (target >= 0 && target < player.getMediaItemCount()) play(player.getMediaItemAt(target).mediaId, true);
                        break;
                    }
                    case "unload": player.pause(); persist(); player.stop(); player.clearMediaItems(); break;
                    case "persist": persist(); break;
                    case "state": break;
                    default: throw new IllegalArgumentException();
                }
                return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS, snapshot()));
            } catch (IllegalArgumentException invalid) { return Futures.immediateFuture(new SessionResult(SessionError.ERROR_BAD_VALUE)); }
        }
    }
}
