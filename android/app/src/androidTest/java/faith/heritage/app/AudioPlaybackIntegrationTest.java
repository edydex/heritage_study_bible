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
import androidx.media3.session.MediaConstants;
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
import java.util.concurrent.atomic.AtomicBoolean;
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
    private boolean carHostStarted;
    private final AtomicBoolean readerOpened = new AtomicBoolean();
    private final android.app.Application.ActivityLifecycleCallbacks activityObserver = new android.app.Application.ActivityLifecycleCallbacks() {
        @Override public void onActivityCreated(android.app.Activity activity, Bundle state) { if (activity instanceof MainActivity) readerOpened.set(true); }
        @Override public void onActivityStarted(android.app.Activity activity) { if (activity instanceof MainActivity) readerOpened.set(true); }
        @Override public void onActivityResumed(android.app.Activity activity) { if (activity instanceof MainActivity) readerOpened.set(true); }
        @Override public void onActivityPaused(android.app.Activity activity) { }
        @Override public void onActivityStopped(android.app.Activity activity) { }
        @Override public void onActivitySaveInstanceState(android.app.Activity activity, Bundle state) { }
        @Override public void onActivityDestroyed(android.app.Activity activity) { }
    };
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
        ((android.app.Application) context.getApplicationContext()).registerActivityLifecycleCallbacks(activityObserver);
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
        if (carHostStarted) { try { carCommand("close", null); } finally { carHostStarted = false; } }
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
            // ActivityManager can remove its service record before onDestroy
            // has released the player and persisted its final position.
            running = HeritagePlaybackService.hasLivePlayer() || manager.getRunningServices(Integer.MAX_VALUE).stream()
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
        ((android.app.Application) context.getApplicationContext()).unregisterActivityLifecycleCallbacks(activityObserver);
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
        // Start playback from the visible app, as a reader does. Android 15
        // rejects a new audio-focus request from an otherwise background app.
        reader = ActivityScenario.launch(new Intent(context, MainActivity.class).setAction("faith.heritage.app.OPEN_AUDIO"));
        await(() -> "true".equals(js("Boolean(document.querySelector('.audio-player-title'))")));
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
        try {
            new HeritageAudioCatalog.Track(new JSONObject(tracks.getJSONObject(0).toString()).put("id", ID).put("url", "https://archive.org/download/example/audio.mp3"), book, "community", true);
            fail("Private metadata replaced a bundled audio ID");
        } catch (IllegalArgumentException expected) { }
        context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit().putString(CommunityAudioStore.INDEX, new JSONArray().put(book).toString()).commit();
        await(() -> main(() -> browser.getItem(first)).get(5, TimeUnit.SECONDS).resultCode == SessionResult.RESULT_SUCCESS);
        Bundle play = new Bundle(); play.putString("trackId", first); play.putBoolean("restart", true); command("play", play);
        await(() -> state().optString("status").equals("playing"));
        assertTrue(state().getBoolean("offline"));
        reader.close(); reader = null; // The service now owns playback without a WebView.
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
        connectLegacyCar();
        CountDownLatch listed = new CountDownLatch(1);
        AtomicReference<java.util.List<android.media.browse.MediaBrowser.MediaItem>> books = new AtomicReference<>();
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
    private android.media.session.MediaController connectLegacyCar() throws Exception {
        CountDownLatch connected = new CountDownLatch(1);
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
        return main(() -> new android.media.session.MediaController(context, legacyBrowser.getSessionToken()));
    }
    private Bundle carCommand(String action, String trackId) throws Exception {
        boolean closing = "close".equals(action);
        if (!closing) {
            assertNull("Car acceptance must leave the reader unopened", reader);
            assertFalse("Car acceptance opened MainActivity", readerOpened.get());
        }
        CountDownLatch answered = new CountDownLatch(1);
        AtomicReference<Bundle> reply = new AtomicReference<>();
        AtomicReference<Integer> code = new AtomicReference<>();
        android.os.ResultReceiver receiver = new android.os.ResultReceiver(new android.os.Handler(android.os.Looper.getMainLooper())) {
            @Override protected void onReceiveResult(int resultCode, Bundle result) {
                code.set(resultCode); reply.set(result); answered.countDown();
            }
        };
        Context host = InstrumentationRegistry.getInstrumentation().getContext();
        Intent request = new Intent().setComponent(new ComponentName(host.getPackageName(), CarControllerTestActivity.class.getName()))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("targetPackage", context.getPackageName()).putExtra("targetService", HeritagePlaybackService.class.getName())
            .putExtra("command", action).putExtra("trackId", trackId).putExtra("result", receiver);
        context.startActivity(request);
        carHostStarted = true;
        assertTrue("External car host did not answer: " + action, answered.await(15, TimeUnit.SECONDS));
        Bundle result = reply.get();
        assertEquals("External car command failed: " + result.getString("failure"), 0, (int) code.get());
        if (closing) return result; // Always finish the host, including after an earlier assertion failed.
        assertNotEquals("Car host must use another UID", android.os.Process.myUid(), result.getInt("uid"));
        assertEquals(host.getPackageName(), result.getString("package"));
        assertTrue("Test precondition: the disposable-emulator runner must enable the test host notification listener for media-controller trust",
            result.getBoolean("trusted"));
        assertTrue("Car controller must be visible when sending transport requests", result.getBoolean("resumed"));
        assertTrue("Car controller must have window focus", result.getBoolean("focused"));
        assertEquals(HeritageAudioCatalog.ROOT, result.getString("root"));
        assertFalse("External car host launched the Bible reader", readerOpened.get());
        return result;
    }
    @Test public void legacyCarPlayAndPauseResumeColdSavedQueueWithoutReaderOrPrepare() throws Exception {
        main(() -> { browser.release(); return null; }); browser = null;
        context.stopService(new Intent(context, HeritagePlaybackService.class));
        long stoppedBy = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (HeritagePlaybackService.hasLivePlayer() && System.nanoTime() < stoppedBy) Thread.sleep(20);
        assertFalse("Initial audio service did not stop", HeritagePlaybackService.hasLivePlayer());
        // A legacy browser in the external host is the first client to create
        // the service, just like a car connecting while the reader is closed.
        carCommand("connect", null);
        browser = main(() -> new MediaBrowser.Builder(context,
            new SessionToken(context, new ComponentName(context, HeritagePlaybackService.class))).buildAsync()).get(15, TimeUnit.SECONDS);
        assertEquals(Player.STATE_IDLE, (int) main(() -> browser.getPlaybackState()));
        assertFalse(main(() -> browser.getPlayWhenReady()));
        assertEquals(12d, state().getDouble("position"), .1);
        // Real car TransportControls must work without the phone UI supplying
        // a prepare call, including the first Play after the service starts.
        carCommand("play", null);
        await(() -> main(() -> browser.isPlaying() && browser.getCurrentPosition() >= 12000));
        assertEquals(1.5, state().getDouble("rate"), .01);
        carCommand("pause", null);
        await(() -> !main(() -> browser.getPlayWhenReady()));
        double paused = state().getDouble("position");
        Thread.sleep(350);
        assertEquals(paused, state().getDouble("position"), .05);
        carCommand("mediaPlayPause", null);
        await(() -> main(() -> browser.isPlaying()));
        assertTrue(state().getJSONObject("lastPlayed").getDouble(ID) > 0);
    }
    @Test public void carContinueListeningResumesDifferentBooksAtTheirOwnPositions() throws Exception {
        HeritageAudioCatalog catalog = new HeritageAudioCatalog(context);
        String other = catalog.tracks.values().stream().filter(track -> !track.bookId.equals(catalog.track(ID).bookId)).findFirst().get().id;
        JSONObject downloads = new JSONObject(context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
            .getString(HeritageAudioCatalog.DOWNLOAD_INDEX, "{}"));
        downloads.put(other, new JSONObject().put("path", "heritage-audio/playback-acceptance.mp3"));
        assertTrue(context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit()
            .putString(HeritageAudioCatalog.DOWNLOAD_INDEX, downloads.toString()).commit());
        carCommand("connect", null);
        carCommand("play", null); await(() -> main(() -> browser.isPlaying()));
        Bundle seek = new Bundle(); seek.putDouble("position", 25); command("seek", seek); command("pause", new Bundle());
        carCommand("playFromMediaId", other);
        await(() -> main(() -> browser.isPlaying()));
        seek.putDouble("position", 10); command("seek", seek); command("pause", new Bundle());
        LibraryResult<ImmutableList<MediaItem>> recent = main(() -> browser.getChildren(HeritageAudioCatalog.CONTINUE, 0, 20, null)).get(10, TimeUnit.SECONDS);
        assertEquals(2, recent.value.size());
        assertEquals(other, recent.value.get(0).mediaId); assertEquals(ID, recent.value.get(1).mediaId);
        assertEquals(Boolean.TRUE, recent.value.get(0).mediaMetadata.isPlayable);
        assertTrue(recent.value.get(1).mediaMetadata.extras.getDouble(MediaConstants.EXTRAS_KEY_COMPLETION_PERCENTAGE) > 0);
        JSONObject snapshot = state();
        assertEquals(25, snapshot.getJSONObject("positions").getDouble(ID), .1);
        assertEquals(10, snapshot.getJSONObject("positions").getDouble(other), .1);
        androidx.media3.session.MediaLibraryService.LibraryParams recentParams = new androidx.media3.session.MediaLibraryService.LibraryParams.Builder().setRecent(true).build();
        LibraryResult<MediaItem> recentRoot = main(() -> browser.getLibraryRoot(recentParams)).get(10, TimeUnit.SECONDS);
        assertEquals(HeritageAudioCatalog.CONTINUE, recentRoot.value.mediaId);
        assertFalse(main(() -> browser.getPlayWhenReady()));
        carCommand("playFromMediaId", ID);
        await(() -> main(() -> browser.isPlaying() && ID.equals(browser.getCurrentMediaItem().mediaId)));
        assertTrue(state().getDouble("position") >= 25);
        assertTrue(state().getDouble("position") < 30);
    }
    @Test public void carPlayWithoutHistoryExplainsHowToChooseARecordingAndStillBrowses() throws Exception {
        main(() -> { browser.release(); return null; }); browser = null;
        context.stopService(new Intent(context, HeritagePlaybackService.class));
        long stoppedBy = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (HeritagePlaybackService.hasLivePlayer() && System.nanoTime() < stoppedBy) Thread.sleep(20);
        assertFalse("Initial audio service did not stop", HeritagePlaybackService.hasLivePlayer());
        assertTrue(context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit().remove(HeritagePlaybackService.PROGRESS).commit());
        Bundle connected = carCommand("connect", null);
        browser = main(() -> new MediaBrowser.Builder(context,
            new SessionToken(context, new ComponentName(context, HeritagePlaybackService.class))).buildAsync()).get(15, TimeUnit.SECONDS);
        assertFalse(main(() -> browser.getPlayWhenReady()));
        assertEquals("", connected.getString("playbackError")); // Connecting alone must not report a playback error.
        carCommand("play", null);
        await(() -> carCommand("state", null).getString("playbackError").contains("Choose a recording"));
        assertFalse(main(() -> browser.isPlaying()));
        LibraryResult<ImmutableList<MediaItem>> roots = main(() -> browser.getChildren(HeritageAudioCatalog.ROOT, 0, 10, null)).get(10, TimeUnit.SECONDS);
        assertTrue(roots.value.stream().anyMatch(item -> HeritageAudioCatalog.BOOKS.equals(item.mediaId)));
        // The hint must be nonfatal: a car selection can play immediately.
        carCommand("playFromMediaId", ID);
        await(() -> main(() -> browser.isPlaying()));
    }
    @Test public void finishedBookRemainsCompleteAcrossColdCarConnectionUntilExplicitReplay() throws Exception {
        HeritageAudioCatalog catalog = new HeritageAudioCatalog(context);
        java.util.List<MediaItem> queue = catalog.queue(ID);
        String finalId = queue.get(queue.size() - 1).mediaId;
        double completed = catalog.track(finalId).durationMs / 1000d;
        assertTrue(completed > 0);
        main(() -> { browser.release(); return null; }); browser = null;
        context.stopService(new Intent(context, HeritagePlaybackService.class));
        long stoppedBy = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (HeritagePlaybackService.hasLivePlayer() && System.nanoTime() < stoppedBy) Thread.sleep(20);
        assertFalse("Initial audio service did not stop", HeritagePlaybackService.hasLivePlayer());
        JSONObject downloads = new JSONObject().put(finalId, new JSONObject().put("path", "heritage-audio/playback-acceptance.mp3"));
        JSONObject progress = new JSONObject().put("lastTrackId", finalId).put("rate", 1)
            .put("positions", new JSONObject().put(finalId, completed)).put("lastPlayed", new JSONObject().put(finalId, 1000));
        assertTrue(context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit()
            .putString(HeritageAudioCatalog.DOWNLOAD_INDEX, downloads.toString()).putString(HeritagePlaybackService.PROGRESS, progress.toString()).commit());
        carCommand("connect", null);
        browser = main(() -> new MediaBrowser.Builder(context,
            new SessionToken(context, new ComponentName(context, HeritagePlaybackService.class))).buildAsync()).get(15, TimeUnit.SECONDS);
        assertFalse(main(() -> browser.getPlayWhenReady()));
        assertEquals(completed, state().getDouble("position"), .001);
        // Auto prepares the idle queue to expose its playback screen. This
        // fixture is intentionally shorter than catalog metadata, exercising
        // a decoder's end clamp without losing the logical completed cursor.
        main(() -> { browser.prepare(); return null; });
        await(() -> main(() -> browser.getPlaybackState() == Player.STATE_READY || browser.getPlaybackState() == Player.STATE_ENDED));
        assertFalse(main(() -> browser.getPlayWhenReady()));
        assertEquals(completed, state().getDouble("position"), .001);
        command("persist", new Bundle());
        JSONObject saved = new JSONObject(context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).getString(HeritagePlaybackService.PROGRESS, "{}"));
        assertEquals(completed, saved.getJSONObject("positions").getDouble(finalId), .001);
        LibraryResult<ImmutableList<MediaItem>> recent = main(() -> browser.getChildren(HeritageAudioCatalog.CONTINUE, 0, 10, null)).get(10, TimeUnit.SECONDS);
        assertEquals(1, recent.value.size());
        assertEquals(1d, recent.value.get(0).mediaMetadata.extras.getDouble(MediaConstants.EXTRAS_KEY_COMPLETION_PERCENTAGE), .00001);
        carCommand("play", null);
        await(() -> main(() -> browser.isPlaying()));
        assertEquals(finalId, state().getString("trackId"));
        assertTrue("Replay did not begin at the start", state().getDouble("position") < 5);
    }
    @Test public void preparingTheRestoredCarQueueExposesPausedControlsWithoutAutoplay() throws Exception {
        android.media.session.MediaController car = connectLegacyCar();
        carCommand("connect", null);
        assertEquals(android.media.session.PlaybackState.STATE_NONE, (int) main(() -> car.getPlaybackState().getState()));
        main(() -> { browser.prepare(); return null; });
        await(() -> main(() -> browser.getPlaybackState() == Player.STATE_READY));
        assertFalse(main(() -> browser.getPlayWhenReady()));
        await(() -> main(() -> car.getPlaybackState().getState() == android.media.session.PlaybackState.STATE_PAUSED));
        assertEquals(12d, state().getDouble("position"), .1);
        carCommand("play", null);
        await(() -> main(() -> browser.isPlaying()));
    }
    @Test public void privateBookHistoryIsBoundedAndSurvivesSignedOutRestartWithoutExposingTitles() throws Exception {
        String privateId = "cb-aaaaaaaaaaaaaaaaaaaaaaaa-0";
        JSONObject identity = new JSONObject().put("scope", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
            .put("communityId", "test-church").put("memberId", "1").put("contentUrl", "https://church.example/content/books/1")
            .put("audioSha256", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
        JSONObject track = new JSONObject().put("id", privateId).put("title", "Private chapter").put("duration", 80).put("bytes", fixture.length())
            .put("url", "https://church.example/api/community/books/1/audio/chapter-0")
            .put("community", new JSONObject(identity.toString()).put("chapterId", "chapter-0"));
        JSONObject book = new JSONObject().put("id", "remote--test--books--1").put("title", "Private prayer book").put("author", "Test author")
            .put("community", identity).put("editions", new JSONArray().put(new JSONObject().put("tracks", new JSONArray().put(track))));
        main(() -> { browser.release(); return null; }); browser = null;
        context.stopService(new Intent(context, HeritagePlaybackService.class));
        long stoppedBy = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (HeritagePlaybackService.hasLivePlayer() && System.nanoTime() < stoppedBy) Thread.sleep(20);
        assertFalse("Initial audio service did not stop", HeritagePlaybackService.hasLivePlayer());
        JSONObject positions = new JSONObject().put(privateId, 30).put("../../private", 50).put("cb-aaaaaaaaaaaaaaaaaaaaaaaa-9999", 20);
        for (int index = 0; index < 10010; index++) positions.put(String.format(java.util.Locale.ROOT, "cb-%024x-%d", index / 2000, index % 2000), 1);
        JSONObject progress = new JSONObject().put("lastTrackId", privateId).put("positions", positions)
            .put("lastPlayed", new JSONObject().put(privateId, 1000));
        assertTrue(context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit()
            .putString(CommunityAudioStore.INDEX, new JSONArray().put(book).toString()).putString(HeritagePlaybackService.PROGRESS, progress.toString()).commit());
        browser = main(() -> new MediaBrowser.Builder(context,
            new SessionToken(context, new ComponentName(context, HeritagePlaybackService.class))).buildAsync()).get(15, TimeUnit.SECONDS);
        assertTrue(state().isNull("trackId"));
        assertFalse(main(() -> browser.getPlayWhenReady()));
        assertNotEquals(LibraryResult.RESULT_SUCCESS, main(() -> browser.getItem(privateId)).get(10, TimeUnit.SECONDS).resultCode);
        LibraryResult<ImmutableList<MediaItem>> hidden = main(() -> browser.getChildren(HeritageAudioCatalog.CONTINUE, 0, 20, null)).get(10, TimeUnit.SECONDS);
        assertTrue(hidden.value.isEmpty());
        command("persist", new Bundle());
        JSONObject saved = new JSONObject(context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).getString(HeritagePlaybackService.PROGRESS, "{}"));
        assertEquals(10000, saved.getJSONObject("positions").length());
        assertEquals(30, saved.getJSONObject("positions").getDouble(privateId), .001);
        assertFalse(saved.getJSONObject("positions").has("../../private"));
        assertFalse(saved.getJSONObject("positions").has("cb-aaaaaaaaaaaaaaaaaaaaaaaa-9999"));
        main(() -> { browser.setMediaItem(new MediaItem.Builder().setMediaId(ID).build()); return null; });
        await(() -> ID.equals(state().optString("trackId")));
        command("persist", new Bundle());
        saved = new JSONObject(context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).getString(HeritagePlaybackService.PROGRESS, "{}"));
        assertEquals(10000, saved.getJSONObject("positions").length());
        assertTrue("Newly selected chapter was dropped at the history limit", saved.getJSONObject("positions").has(ID));
        seedCommunitySession(new JSONObject().put("test-church", new JSONObject().put("token", "fixture-only-token").put("issuerOrigin", "https://church.example")
            .put("expiresAt", "2099-01-01T00:00:00.000Z").put("member", new JSONObject().put("id", "1"))));
        await(() -> main(() -> browser.getItem(privateId)).get(5, TimeUnit.SECONDS).resultCode == LibraryResult.RESULT_SUCCESS);
        LibraryResult<ImmutableList<MediaItem>> restored = main(() -> browser.getChildren(HeritageAudioCatalog.CONTINUE, 0, 20, null)).get(10, TimeUnit.SECONDS);
        MediaItem privateResume = restored.value.stream().filter(item -> privateId.equals(item.mediaId)).findFirst().get();
        assertEquals(.375, privateResume.mediaMetadata.extras.getDouble(MediaConstants.EXTRAS_KEY_COMPLETION_PERCENTAGE), .00001);
        assertEquals(ID, state().getString("trackId")); // Reauthorization never selects private content.
        assertFalse(main(() -> browser.getPlayWhenReady()));
    }
}
