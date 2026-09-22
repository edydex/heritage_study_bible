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
import org.json.JSONArray;
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
    private File communityFixture;
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
    private JSONObject observeVerseBoundary(int verse, double boundary, double rate) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15);
        while (System.nanoTime() < deadline) {
            double before = state().getDouble("position") * 1000;
            String marked = js("document.querySelector('[data-audio-active=true]')?.getAttribute('data-verse') || ''");
            if (marked.equals("\"" + verse + "\"")) {
                // Read the service's actual ExoPlayer clock after observing the
                // DOM. Include the observation round-trip in the upper bound.
                double after = state().getDouble("position") * 1000;
                double latenessMs = (after - boundary * 1000) / rate;
                // The boundary may pass between the pre-observation clock read
                // and evaluating the DOM. Only the subsequent clock can prove
                // a marker was premature; never compare it to the earlier read.
                assertTrue("Marker preceded the playback boundary: " + marked + "; position=" + after,
                    after >= boundary * 1000);
                assertTrue("Verse " + verse + " highlight delayed " + latenessMs + " ms", latenessMs < 300);
                return new JSONObject().put("verse", verse).put("boundary", boundary).put("rate", rate)
                    .put("observedUpperLatencyMs", latenessMs).put("observationSpanMs", (after - before) / rate);
            }
            Thread.sleep(20);
        }
        throw new AssertionError("Verse marker never reached " + verse);
    }
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
        // Match the 44.1 kHz BSB recording instead of a telephone-rate fixture;
        // low-rate AudioTrack buffers produce coarse position steps in CI.
        int sampleRate = 44100, samples = 80 * sampleRate;
        ByteBuffer wave = ByteBuffer.allocate(44 + samples * 2).order(ByteOrder.LITTLE_ENDIAN);
        wave.put("RIFF".getBytes()).putInt(wave.capacity() - 8).put("WAVEfmt ".getBytes()).putInt(16)
            .putShort((short) 1).putShort((short) 1).putInt(sampleRate).putInt(sampleRate * 2).putShort((short) 2).putShort((short) 16)
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
        // stopService/unbinding are asynchronous. Let onDestroy finish saving
        // the previous fixture before another test seeds its initial progress.
        android.app.ActivityManager manager = (android.app.ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        long stoppedBy = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        boolean running;
        do {
            running = manager.getRunningServices(Integer.MAX_VALUE).stream()
                .anyMatch(service -> HeritagePlaybackService.class.getName().equals(service.service.getClassName()));
            if (running) Thread.sleep(20);
        } while (running && System.nanoTime() < stoppedBy);
        if (running) {
            File trace = new File(context.getExternalFilesDir(null), "native-acceptance/playback-stop-timeout.txt");
            trace.getParentFile().mkdirs();
            try (android.os.ParcelFileDescriptor result = InstrumentationRegistry.getInstrumentation().getUiAutomation()
                    .executeShellCommand("dumpsys activity services faith.heritage.app");
                 java.io.FileInputStream in = new java.io.FileInputStream(result.getFileDescriptor());
                 FileOutputStream out = new FileOutputStream(trace)) { in.transferTo(out); }
        }
        assertFalse("Previous playback service did not finish stopping", running);
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit().remove(HeritageAudioCatalog.DOWNLOAD_INDEX).remove(HeritagePlaybackService.PROGRESS).commit();
        context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit().remove(CommunityAudioStore.INDEX).commit();
        context.getSharedPreferences("heritage_secure_storage", Context.MODE_PRIVATE).edit().remove("heritage-community-sessions-v1").commit();
        if (communityFixture != null) communityFixture.delete();
        if (fixture != null) fixture.delete();
    }
    private void seedCommunitySession(JSONObject sessions) throws Exception {
        String alias = "heritage-secure-storage-v1", key = "heritage-community-sessions-v1";
        java.security.KeyStore keys = java.security.KeyStore.getInstance("AndroidKeyStore"); keys.load(null);
        if (!keys.containsAlias(alias)) {
            javax.crypto.KeyGenerator generator = javax.crypto.KeyGenerator.getInstance("AES", "AndroidKeyStore");
            generator.init(new android.security.keystore.KeyGenParameterSpec.Builder(alias, android.security.keystore.KeyProperties.PURPOSE_ENCRYPT | android.security.keystore.KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes("GCM").setEncryptionPaddings("NoPadding").build()); generator.generateKey();
        }
        javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, ((java.security.KeyStore.SecretKeyEntry) keys.getEntry(alias, null)).getSecretKey());
        cipher.updateAAD(key.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        int flags = android.util.Base64.NO_WRAP | android.util.Base64.URL_SAFE;
        String value = android.util.Base64.encodeToString(cipher.getIV(), flags) + "." + android.util.Base64.encodeToString(cipher.doFinal(sessions.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)), flags);
        context.getSharedPreferences("heritage_secure_storage", Context.MODE_PRIVATE).edit().putString(key, value).commit();
    }
    @Test public void communityBookPlaysDownloadedChaptersWithoutWebViewAndStopsAtSignOut() throws Exception {
        byte[] data = java.nio.file.Files.readAllBytes(fixture.toPath());
        StringBuilder digest = new StringBuilder();
        for (byte b : java.security.MessageDigest.getInstance("SHA-256").digest(data)) digest.append(String.format(java.util.Locale.ROOT, "%02x", b));
        String scope = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", first = "cb-aaaaaaaaaaaaaaaaaaaaaaaa-0", second = "cb-aaaaaaaaaaaaaaaaaaaaaaaa-1";
        JSONObject identity = new JSONObject().put("scope", scope).put("communityId", "test-church").put("memberId", "1")
            .put("contentUrl", "https://church.example/content/books/1").put("audioSha256", digest.toString());
        seedCommunitySession(new JSONObject().put("test-church", new JSONObject().put("token", "fixture-only-token").put("issuerOrigin", "https://church.example")
            .put("expiresAt", "2099-01-01T00:00:00.000Z").put("member", new JSONObject().put("id", "1"))));
        communityFixture = CommunityAudioStore.path(context, identity, true);
        communityFixture.getParentFile().mkdirs(); java.nio.file.Files.write(communityFixture.toPath(), data);
        JSONArray tracks = new JSONArray();
        for (int i = 0; i < 2; i++) tracks.put(new JSONObject().put("id", i == 0 ? first : second).put("title", "Chapter " + (i + 1)).put("duration", 80).put("bytes", data.length)
            .put("url", "https://church.example/api/community/books/1/audio/chapter-" + i)
            .put("community", new JSONObject(identity.toString()).put("chapterId", "chapter-" + i)));
        JSONObject book = new JSONObject().put("id", "remote--test--books--1").put("title", "Community prayer book").put("author", "Test author")
            .put("community", identity).put("editions", new JSONArray().put(new JSONObject().put("tracks", tracks)));
        context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit().putString(CommunityAudioStore.INDEX, new JSONArray().put(book).toString()).commit();
        await(() -> main(() -> browser.getItem(first)).get(5, TimeUnit.SECONDS).resultCode == SessionResult.RESULT_SUCCESS);
        Bundle play = new Bundle(); play.putString("trackId", first); play.putBoolean("restart", true); command("play", play);
        await(() -> state().optString("status").equals("playing"));
        assertTrue(state().getBoolean("offline"));
        double initial = state().getDouble("position");
        await(() -> state().getDouble("position") > initial + 1);
        Bundle seek = new Bundle(); seek.putDouble("position", 20); command("seek", seek); command("pause", new Bundle());
        assertEquals(20, state().getDouble("position"), 1);
        Bundle skip = new Bundle(); skip.putInt("direction", 1); command("skip", skip);
        await(() -> state().optString("trackId").equals(second) && state().optString("status").equals("playing"));
        assertNotNull(new HeritageAudioCatalog(context).downloadedFile(second));
        context.getSharedPreferences("heritage_secure_storage", Context.MODE_PRIVATE).edit().remove("heritage-community-sessions-v1").commit();
        await(() -> state().optString("status").equals("idle"));
        assertNull(new HeritageAudioCatalog(context).track(first));
        // An untrusted file path or changed recording cannot replace a verified chapter.
        JSONObject wrong = new JSONObject(identity.toString()).put("scope", "../../outside");
        try { CommunityAudioStore.path(context, wrong, true); fail("Traversal accepted"); } catch (java.io.IOException expected) { }
    }
    @Test public void carLibraryAndSavedQueueLoadWithoutOpeningTheBible() throws Exception {
        LibraryResult<MediaItem> root = main(() -> browser.getLibraryRoot(null)).get(10, TimeUnit.SECONDS);
        assertEquals(HeritageAudioCatalog.ROOT, root.value.mediaId);
        LibraryResult<ImmutableList<MediaItem>> books = main(() -> browser.getChildren(HeritageAudioCatalog.BOOKS, 0, 100, null)).get(10, TimeUnit.SECONDS);
        assertEquals(10, books.value.size());
        LibraryResult<ImmutableList<MediaItem>> bibles = main(() -> browser.getChildren(HeritageAudioCatalog.BIBLES, 0, 100, null)).get(10, TimeUnit.SECONDS);
        assertEquals(66, bibles.value.size());
        LibraryResult<ImmutableList<MediaItem>> romans = main(() -> browser.getChildren("book:bible-bsb-romans", 0, 100, null)).get(10, TimeUnit.SECONDS);
        assertEquals(16, romans.value.size());
        assertEquals("bsb-hays-45-001", romans.value.get(0).mediaId);
        assertNull(romans.value.get(0).localConfiguration);
        HeritageAudioCatalog catalog = new HeritageAudioCatalog(context);
        assertEquals("https://openbible.com/audio/hays/BSB_45_Rom_001_H.mp3", catalog.item("bsb-hays-45-001", true).localConfiguration.uri.toString());
        assertEquals(16, catalog.queue("bsb-hays-45-001").size());
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
        await(() -> "true".equals(js("document.body.innerText.includes('BSB Audio Bible') && !Array.from(document.querySelectorAll('h2')).some(node=>node.textContent==='Genesis')")));
        await(() -> "true".equals(js("document.documentElement.style.getPropertyValue('--native-safe-top') !== ''")));
        AtomicReference<Double> requiredTop = new AtomicReference<>(0d);
        reader.onActivity(activity -> {
            android.view.View web = activity.getBridge().getWebView();
            androidx.core.view.WindowInsetsCompat insets = androidx.core.view.ViewCompat.getRootWindowInsets(web);
            int[] origin = new int[2]; web.getLocationInWindow(origin);
            if (insets != null) requiredTop.set((double) Math.max(0, insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars() | androidx.core.view.WindowInsetsCompat.Type.displayCutout()).top - origin[1]) / activity.getResources().getDisplayMetrics().density);
        });
        assertTrue("Audio library overlaps the native status bar", Double.parseDouble(js("document.querySelector('main.audio-library header').getBoundingClientRect().top")) >= requiredTop.get() + 12);
        // Android 15 can inset the WebView while keeping the system bar
        // transparent: zero uncovered inset must not imply a blue background.
        if (android.os.Build.VERSION.SDK_INT >= 35) reader.onActivity(activity ->
            assertTrue("Light audio page requires dark status icons",
                androidx.core.view.WindowCompat.getInsetsController(activity.getWindow(), activity.getWindow().getDecorView()).isAppearanceLightStatusBars()));
        File screen = new File(context.getExternalFilesDir(null), "native-acceptance/audio-library.png");
        assertTrue(screen.getParentFile().isDirectory() || screen.getParentFile().mkdirs());
        InstrumentationRegistry.getInstrumentation().getUiAutomation().waitForIdle(200, 5000);
        android.graphics.Bitmap screenshot = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        try (FileOutputStream out = new FileOutputStream(screen)) { assertTrue(screenshot.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out)); }
        screenshot.recycle();
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
    @Test public void ezekielVerseHighlightsFollowTheNativeClockAtRealBoundaries() throws Exception {
        String bibleId = "bsb-hays-26-042";
        JSONObject downloads = new JSONObject(context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
            .getString(HeritageAudioCatalog.DOWNLOAD_INDEX, "{}"));
        downloads.put(bibleId, new JSONObject().put("trackId", bibleId).put("path", "heritage-audio/playback-acceptance.mp3"));
        assertTrue(context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit()
            .putString(HeritageAudioCatalog.DOWNLOAD_INDEX, downloads.toString()).commit());
        reader = ActivityScenario.launch(MainActivity.class);
        await(() -> "true".equals(js("Boolean(window.Capacitor?.Plugins?.HeritageAudio) && Boolean(document.querySelector('main'))")));
        js("localStorage.setItem('heritage-translation','BSB');localStorage.setItem('heritage-default-translation-v2','done');location.hash='#/ezekiel/42'");
        await(() -> "true".equals(js("Boolean(document.querySelector('#verse-42-1 [data-translation=BSB]'))")));
        // The PCM fixture exercises ExoPlayer's clock without network or a
        // recognition model. Boundaries are the exact shipped Ezekiel timings.
        JSONObject timing;
        try (java.io.InputStream input = context.getAssets().open("public/data/audio/bsb-hays/ezekiel.json")) {
            timing = new JSONObject(new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
        }
        JSONArray spans = timing.getJSONObject("chapters").getJSONObject("42").getJSONArray("verses");
        double[] boundaries = {spans.getJSONObject(0).getDouble("start"), spans.getJSONObject(0).getDouble("end"),
            spans.getJSONObject(1).getDouble("end"), spans.getJSONObject(2).getDouble("end")};
        Bundle rate = new Bundle(); rate.putDouble("rate", 2); command("rate", rate);
        Bundle play = new Bundle(); play.putString("trackId", bibleId); play.putBoolean("restart", true); command("play", play);
        await(() -> main(() -> browser.isPlaying()));
        JSONArray observed = new JSONArray();
        for (int i = 0; i < boundaries.length; i++) {
            observed.put(observeVerseBoundary(i + 1, boundaries[i], 2));
        }
        command("pause", new Bundle());
        Bundle seek = new Bundle(); seek.putDouble("position", boundaries[1] - .35); command("seek", seek);
        await(() -> "\"1\"".equals(js("document.querySelector('[data-audio-active=true]')?.getAttribute('data-verse')")));
        double paused = state().getDouble("position");
        Thread.sleep(450); // A scheduled boundary must not advance while paused.
        assertEquals(paused, state().getDouble("position"), .01);
        assertEquals("\"1\"", js("document.querySelector('[data-audio-active=true]')?.getAttribute('data-verse')"));
        rate.putDouble("rate", 1); command("rate", rate); play.putBoolean("restart", false); command("play", play);
        observed.put(observeVerseBoundary(2, boundaries[1], 1));
        rate.putDouble("rate", .75); command("rate", rate);
        seek.putDouble("position", boundaries[2] - .4); command("seek", seek);
        observed.put(observeVerseBoundary(3, boundaries[2], .75));
        File output = new File(context.getExternalFilesDir(null), "native-acceptance/ezekiel-highlight-latency.json");
        assertTrue(output.getParentFile().isDirectory() || output.getParentFile().mkdirs());
        try (FileOutputStream stream = new FileOutputStream(output)) {
            stream.write(observed.toString(2).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        command("pause", new Bundle());
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
