package faith.heritage.app;

import static org.junit.Assert.*;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.session.LibraryResult;
import androidx.media3.session.MediaBrowser;
import androidx.media3.session.SessionCommand;
import androidx.media3.session.SessionResult;
import androidx.media3.session.SessionToken;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** A real MediaBrowser, ExoPlayer, private file and packaged WebView; no network. */
@UnstableApi
@RunWith(AndroidJUnit4.class)
public class AudioPlaybackIntegrationTest {
    private static final String ID = "lv-b7678381ba5a32ee9f74b572";
    private Context context;
    private MediaBrowser browser;
    private android.media.browse.MediaBrowser legacyBrowser;
    private File fixture;
    private ActivityScenario<MainActivity> reader;
    private <T> T main(Callable<T> action) throws Exception {
        AtomicReference<T> result = new AtomicReference<>(); AtomicReference<Exception> failure = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> { try { result.set(action.call()); } catch (Exception error) { failure.set(error); } });
        if (failure.get() != null) throw failure.get();
        return result.get();
    }
    private void await(Callable<Boolean> condition) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(35);
        while (System.nanoTime() < deadline) { if (condition.call()) return; Thread.sleep(100); }
        fail("Native audio condition timed out; state=" + state()
            + (reader == null ? "" : "; route=" + js("location.hash") + "; page=" + js("document.body.innerText.slice(0,600)")));
    }
    private JSONObject command(String action, Bundle args) throws Exception {
        args.putString("action", action);
        SessionResult result = main(() -> browser.sendCustomCommand(new SessionCommand(HeritagePlaybackService.COMMAND, Bundle.EMPTY), args)).get(10, TimeUnit.SECONDS);
        assertEquals("Native command rejected: " + action, SessionResult.RESULT_SUCCESS, result.resultCode);
        return new JSONObject(result.extras.getString("state"));
    }
    private JSONObject state() throws Exception { return command("state", new Bundle()); }
    private String js(String source) throws Exception {
        CountDownLatch done = new CountDownLatch(1); AtomicReference<String> result = new AtomicReference<>("null");
        reader.onActivity(activity -> {
            if (activity.getBridge() == null) { done.countDown(); return; }
            activity.getBridge().getWebView().evaluateJavascript(source, value -> { result.set(value); done.countDown(); });
        });
        assertTrue(done.await(10, TimeUnit.SECONDS)); return result.get();
    }
    @Before public void connect() throws Exception {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        fixture = new File(context.getFilesDir(), "heritage-audio/playback-acceptance.mp3");
        assertTrue(fixture.getParentFile().isDirectory() || fixture.getParentFile().mkdirs());
        // Self-generated, silent PCM; the extractor sniffs the bytes rather than
        // trusting the catalog's filename extension. No sermon or licensed audio.
        int samples = 80 * 8000;
        ByteBuffer wave = ByteBuffer.allocate(44 + samples * 2).order(ByteOrder.LITTLE_ENDIAN);
        wave.put("RIFF".getBytes()).putInt(wave.capacity() - 8).put("WAVEfmt ".getBytes()).putInt(16)
            .putShort((short) 1).putShort((short) 1).putInt(8000).putInt(16000).putShort((short) 2).putShort((short) 16)
            .put("data".getBytes()).putInt(samples * 2);
        try (FileOutputStream stream = new FileOutputStream(fixture)) { stream.write(wave.array()); }
        JSONObject record = new JSONObject().put("trackId", ID).put("path", "heritage-audio/playback-acceptance.mp3");
        assertTrue(context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit()
            .putString(HeritageAudioCatalog.DOWNLOAD_INDEX, new JSONObject().put(ID, record).toString())
            .putString(HeritagePlaybackService.PROGRESS, new JSONObject().put("lastTrackId", ID).put("rate", 1.5)
                .put("positions", new JSONObject().put(ID, 12)).toString()).commit());
        ListenableFuture<MediaBrowser> future = main(() -> new MediaBrowser.Builder(context,
            new SessionToken(context, new ComponentName(context, HeritagePlaybackService.class))).buildAsync());
        browser = future.get(15, TimeUnit.SECONDS);
    }
    @After public void cleanup() throws Exception {
        if (browser != null) { command("unload", new Bundle()); }
        if (reader != null) { reader.close(); reader = null; }
        if (legacyBrowser != null) { main(() -> { legacyBrowser.disconnect(); return null; }); legacyBrowser = null; }
        if (browser != null) { main(() -> { browser.release(); return null; }); browser = null; }
        context.stopService(new Intent(context, HeritagePlaybackService.class));
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit().remove(HeritageAudioCatalog.DOWNLOAD_INDEX).remove(HeritagePlaybackService.PROGRESS).commit();
        if (fixture != null) fixture.delete();
    }
    @Test public void carLibraryAndSavedQueueLoadWithoutOpeningTheBible() throws Exception {
        LibraryResult<MediaItem> root = main(() -> browser.getLibraryRoot(null)).get(10, TimeUnit.SECONDS);
        assertEquals(HeritageAudioCatalog.ROOT, root.value.mediaId);
        LibraryResult<ImmutableList<MediaItem>> books = main(() -> browser.getChildren(HeritageAudioCatalog.BOOKS, 0, 100, null)).get(10, TimeUnit.SECONDS);
        assertEquals(10, books.value.size());
        LibraryResult<ImmutableList<MediaItem>> volumes = main(() -> browser.getChildren("book:josephus-antiquities", 0, 100, null)).get(10, TimeUnit.SECONDS);
        assertEquals(4, volumes.value.size());
        assertEquals(Boolean.TRUE, volumes.value.get(0).mediaMetadata.isBrowsable);
        LibraryResult<ImmutableList<MediaItem>> downloads = main(() -> browser.getChildren(HeritageAudioCatalog.DOWNLOADS, 0, 100, null)).get(10, TimeUnit.SECONDS);
        assertEquals(ID, downloads.value.get(0).mediaId);
        assertNull(downloads.value.get(0).localConfiguration); // No file paths in the browser catalog.
        JSONObject saved = state();
        assertEquals(12d, saved.getDouble("position"), .1); assertEquals(1.5, saved.getDouble("rate"), .01);
        assertEquals("paused", saved.getString("status"));
        assertEquals(Player.STATE_IDLE, (int) main(() -> browser.getPlaybackState()));
        assertFalse(main(() -> browser.getPlayWhenReady()));
        LibraryResult<MediaItem> invalid = main(() -> browser.getItem("../../private-notes")).get(10, TimeUnit.SECONDS);
        assertNotEquals(LibraryResult.RESULT_SUCCESS, invalid.resultCode);
        LibraryResult<ImmutableList<MediaItem>> search = main(() -> browser.getSearchResult("Antiquities", 0, 10, null)).get(10, TimeUnit.SECONDS);
        assertEquals(10, search.value.size());
    }
    @Test public void appAndCarSharePlaybackWhichContinuesAfterTheReaderCloses() throws Exception {
        reader = ActivityScenario.launch(new Intent(context, MainActivity.class).setAction("faith.heritage.app.OPEN_AUDIO"));
        await(() -> "true".equals(js("Boolean(document.querySelector('.audio-player-title'))")));
        await(() -> "true".equals(js("location.hash === '#/audio'")));
        // An external request can identify a catalog item but cannot replace its
        // URL/title. The legitimate local copy must be decoded while offline.
        main(() -> {
            browser.setMediaItem(new MediaItem.Builder().setMediaId(ID).setUri("https://invalid.example/untrusted.mp3")
                .setMediaMetadata(new MediaMetadata.Builder().setTitle("Untrusted title").build()).build());
            browser.prepare(); browser.play(); return null;
        });
        await(() -> main(() -> browser.isPlaying()));
        assertEquals(72, (int) main(() -> browser.getMediaItemCount()));
        assertNotEquals("Untrusted title", main(() -> browser.getMediaMetadata().title.toString()));
        assertTrue(state().getBoolean("offline"));
        await(() -> "true".equals(js("Array.from(document.querySelectorAll('.audio-player button')).some(button=>button.textContent==='Pause')")));
        // On-screen pause controls the exact same player the car is observing.
        js("Array.from(document.querySelectorAll('.audio-player button')).find(button=>button.textContent==='Pause').click()");
        await(() -> !main(() -> browser.getPlayWhenReady()));
        main(() -> { browser.seekTo(25000); browser.play(); return null; });
        await(() -> main(() -> browser.isPlaying() && browser.getCurrentPosition() >= 25000));
        reader.close(); reader = null;
        long before = main(() -> browser.getCurrentPosition());
        await(() -> main(() -> browser.isPlaying() && browser.getCurrentPosition() > before + 1500));
        assertTrue(HeritagePlaybackService.isPlaybackActive());
        JSONObject paused = command("pause", new Bundle());
        assertEquals("paused", paused.getString("status"));
        JSONObject persisted = new JSONObject(context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).getString(HeritagePlaybackService.PROGRESS, "{}"));
        assertTrue(persisted.getJSONObject("positions").getDouble(ID) >= 25);
    }
    @Test public void offlineResolverRejectsTraversalAndUnrelatedAppFiles() throws Exception {
        HeritageAudioCatalog catalog = new HeritageAudioCatalog(context);
        assertNotNull(catalog.downloadedFile(ID));
        context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit().putString(HeritageAudioCatalog.DOWNLOAD_INDEX,
            new JSONObject().put(ID, new JSONObject().put("path", "heritage-audio/../private-notes.mp3")).toString()).commit();
        assertNull(catalog.downloadedFile(ID));
        assertNull(catalog.downloadedFile("unknown"));
        assertEquals("https", catalog.item(ID, true).localConfiguration.uri.getScheme());
    }
    @Test public void legacyCarBrowserCanDiscoverTheLibraryWithoutOpeningTheReader() throws Exception {
        CountDownLatch connected = new CountDownLatch(1), listed = new CountDownLatch(1);
        AtomicReference<java.util.List<android.media.browse.MediaBrowser.MediaItem>> books = new AtomicReference<>();
        main(() -> {
            legacyBrowser = new android.media.browse.MediaBrowser(context,
                new ComponentName(context, HeritagePlaybackService.class),
                new android.media.browse.MediaBrowser.ConnectionCallback() {
                    @Override public void onConnected() { connected.countDown(); }
                    @Override public void onConnectionFailed() { connected.countDown(); }
                }, null);
            legacyBrowser.connect(); return null;
        });
        assertTrue("Legacy car connection timed out", connected.await(10, TimeUnit.SECONDS));
        assertTrue(main(() -> legacyBrowser.isConnected()));
        assertEquals(HeritageAudioCatalog.ROOT, main(() -> legacyBrowser.getRoot()));
        main(() -> {
            legacyBrowser.subscribe(HeritageAudioCatalog.BOOKS, new android.media.browse.MediaBrowser.SubscriptionCallback() {
                @Override public void onChildrenLoaded(String id, java.util.List<android.media.browse.MediaBrowser.MediaItem> items) { books.set(items); listed.countDown(); }
                @Override public void onError(String id) { listed.countDown(); }
            }); return null;
        });
        assertTrue("Legacy car library timed out", listed.await(10, TimeUnit.SECONDS));
        assertNotNull(books.get()); assertEquals(10, books.get().size());
        assertTrue(books.get().get(0).isBrowsable());
        assertFalse(main(() -> browser.getPlayWhenReady()));
    }
}
