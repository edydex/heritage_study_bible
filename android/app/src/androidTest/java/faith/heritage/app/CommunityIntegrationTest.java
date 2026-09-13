package faith.heritage.app;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.net.ConnectivityManager;
import android.webkit.WebView;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Before;
import org.junit.After;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class CommunityIntegrationTest {
    @Rule public ActivityScenarioRule<MainActivity> activity = new ActivityScenarioRule<>(MainActivity.class);
    private Bitmap previousScreen;

    @After public void releaseScreenshot() {
        if (previousScreen != null) { previousScreen.recycle(); previousScreen = null; }
    }

    private String evaluate(String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>("null");
        activity.getScenario().onActivity(instance -> {
            if (instance.getBridge() == null) { done.countDown(); return; }
            instance.getBridge().getWebView().evaluateJavascript(script, result -> {
                value.set(result); done.countDown();
            });
        });
        assertTrue("WebView evaluation timed out", done.await(10, TimeUnit.SECONDS));
        return value.get();
    }

    private void waitFor(String expression) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(45);
        while (System.nanoTime() < deadline) {
            if ("true".equals(evaluate("Boolean(" + expression + ")"))) return;
            Thread.sleep(200);
        }
        fail("Packaged reader did not reach: " + expression + "; body=" + evaluate("document.body.innerText.slice(0,500)"));
    }

    @Before public void ready() throws Exception {
        waitFor("window.Capacitor && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins.HeritageSecureStorage && document.getElementById('root')?.innerText.length > 30");
    }

    private JSONObject nativeResult(String code) throws Exception {
        evaluate("window.__nativeAcceptance = null; (async () => { try { " + code
                + " } catch (error) { window.__nativeAcceptance = JSON.stringify({error:String(error)}); } })()");
        waitFor("typeof window.__nativeAcceptance === 'string'");
        Object result = new JSONTokener(evaluate("window.__nativeAcceptance")).nextValue();
        return new JSONObject(result.toString());
    }

    private void screenshot(String name) throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File folder = new File(context.getExternalFilesDir(null), "native-acceptance");
        assertTrue(folder.isDirectory() || folder.mkdirs());
        Bitmap bitmap;
        Bitmap content;
        boolean changed;
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (true) {
            bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
            assertNotNull(bitmap);
            // Ignore the system clock/navigation areas when waiting for a new
            // screen. A compositor capture can still contain the prior frame.
            content = Bitmap.createBitmap(bitmap, 0, bitmap.getHeight() / 5,
                    bitmap.getWidth(), bitmap.getHeight() * 3 / 5);
            changed = previousScreen == null || !previousScreen.sameAs(content);
            if (changed || name.equals("unexpected-visible-screen") || System.nanoTime() >= deadline) break;
            content.recycle();
            bitmap.recycle();
            Thread.sleep(200);
        }
        try (FileOutputStream out = new FileOutputStream(new File(folder, name + ".png"))) {
            assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, out));
        }
        bitmap.recycle();
        if (previousScreen != null) previousScreen.recycle();
        previousScreen = content;
        assertTrue("The captured screen did not advance: " + name, changed || name.equals("unexpected-visible-screen"));
    }

    private void route(String hash, String heading) throws Exception {
        evaluate("window.location.hash=" + JSONObject.quote(hash));
        waitFor("document.body.innerText.includes(" + JSONObject.quote(heading) + ")");
        CountDownLatch painted = new CountDownLatch(1);
        activity.getScenario().onActivity(instance -> instance.getBridge().getWebView()
                .postVisualStateCallback(System.nanoTime(), new WebView.VisualStateCallback() {
                    @Override public void onComplete(long requestId) {
                        WebView web = instance.getBridge().getWebView();
                        web.postInvalidateOnAnimation();
                        web.postOnAnimation(() -> web.postOnAnimation(painted::countDown));
                    }
                }));
        assertTrue("WebView did not commit the expected screen: " + heading, painted.await(20, TimeUnit.SECONDS));
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(45);
        while (System.nanoTime() < deadline) {
            AtomicReference<Boolean> visible = new AtomicReference<>(false);
            activity.getScenario().onActivity(instance -> {
                WebView web = instance.getBridge().getWebView();
                Rect bounds = new Rect();
                visible.set(instance.getWindow().getDecorView().hasWindowFocus() && web.isShown()
                        && web.getGlobalVisibleRect(bounds) && bounds.width() > 0 && bounds.height() > 0);
            });
            if (visible.get()) {
                InstrumentationRegistry.getInstrumentation().getUiAutomation().waitForIdle(200, 5000);
                return;
            }
            Thread.sleep(200);
        }
        screenshot("unexpected-visible-screen");
        fail("The rendered Heritage window was hidden or lacked focus: " + heading);
    }

    @Test public void packagedCommunityScreensAndMemberLinkWorkOffline() throws Exception {
        ConnectivityManager connectivity = InstrumentationRegistry.getInstrumentation()
                .getTargetContext().getSystemService(ConnectivityManager.class);
        long offlineDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(45);
        while (connectivity.getActiveNetwork() != null && System.nanoTime() < offlineDeadline) Thread.sleep(200);
        assertNull("The emulator still has an active network", connectivity.getActiveNetwork());
        waitFor("navigator.onLine === false");
        route("/community", "Community Home");
        screenshot("community-home");
        route("/resources/sermons", "Published Sermons");
        waitFor("document.body.innerText.includes('No published sermon sources are installed')");
        screenshot("sermon-archive");
        route("/community-song?access=member&server=android-fixture&url=https%3A%2F%2Ffixture.example%2Fcontent%2Fsongs%2Fdemo", "Community sign-in required");
        assertFalse(evaluate("document.body.innerText").contains("Synthetic private lyrics"));
        screenshot("member-sign-in");
    }

    @Test public void secureStorageUsesNativeKeystoreAndSurvivesActivityRestart() throws Exception {
        JSONObject written = nativeResult("const p=window.Capacitor.Plugins.HeritageSecureStorage;"
                + "await p.set({key:'acceptance-token',value:'QA only — English Русский'});"
                + "window.__nativeAcceptance=JSON.stringify(await p.get({key:'acceptance-token'}));");
        assertEquals("QA only — English Русский", written.getString("value"));
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String raw = context.getSharedPreferences("heritage_secure_storage", Context.MODE_PRIVATE).getString("acceptance-token", null);
        assertNotNull(raw);
        assertFalse(raw.contains("QA only"));
        assertFalse(raw.contains("Русский"));
        assertEquals(2, raw.split("\\.", 2).length);
        activity.getScenario().recreate();
        ready();
        JSONObject restored = nativeResult("window.__nativeAcceptance=JSON.stringify(await window.Capacitor.Plugins.HeritageSecureStorage.get({key:'acceptance-token'}));");
        assertEquals("QA only — English Русский", restored.getString("value"));
        JSONObject removed = nativeResult("const p=window.Capacitor.Plugins.HeritageSecureStorage;await p.remove({key:'acceptance-token'});window.__nativeAcceptance=JSON.stringify(await p.get({key:'acceptance-token'}));");
        assertTrue(removed.isNull("value"));
    }

    @Test public void encryptedValuesCannotBeSubstitutedForAnotherStorageKey() throws Exception {
        JSONObject created = nativeResult("const p=window.Capacitor.Plugins.HeritageSecureStorage;await p.set({key:'acceptance-original',value:'Synthetic member session'});window.__nativeAcceptance=JSON.stringify(await p.get({key:'acceptance-original'}));");
        assertEquals("Synthetic member session", created.getString("value"));
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        SharedPreferences prefs = context.getSharedPreferences("heritage_secure_storage", Context.MODE_PRIVATE);
        assertTrue(prefs.edit().putString("acceptance-substituted", prefs.getString("acceptance-original", null)).commit());
        JSONObject rejected = nativeResult("window.__nativeAcceptance=JSON.stringify(await window.Capacitor.Plugins.HeritageSecureStorage.get({key:'acceptance-substituted'}));");
        assertTrue(rejected.has("error"));
        assertFalse(prefs.contains("acceptance-substituted"));
        JSONObject original = nativeResult("const p=window.Capacitor.Plugins.HeritageSecureStorage;const value=await p.get({key:'acceptance-original'});await p.remove({key:'acceptance-original'});window.__nativeAcceptance=JSON.stringify(value);");
        assertEquals("Synthetic member session", original.getString("value"));
    }
}
