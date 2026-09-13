package faith.heritage.app;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.view.accessibility.AccessibilityNodeInfo;
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
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class CommunityIntegrationTest {
    @Rule public ActivityScenarioRule<MainActivity> activity = new ActivityScenarioRule<>(MainActivity.class);

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
        Bitmap bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(bitmap);
        try (FileOutputStream out = new FileOutputStream(new File(folder, name + ".png"))) {
            assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, out));
        }
        bitmap.recycle();
    }

    private void route(String hash, String heading) throws Exception {
        evaluate("window.location.hash=" + JSONObject.quote(hash));
        waitFor("document.body.innerText.includes(" + JSONObject.quote(heading) + ")");
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(45);
        while (System.nanoTime() < deadline) {
            AccessibilityNodeInfo root = InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();
            boolean visible = root != null && "faith.heritage.app".equals(String.valueOf(root.getPackageName()))
                    && root.findAccessibilityNodeInfosByText(heading).stream().anyMatch(AccessibilityNodeInfo::isVisibleToUser);
            if (visible) {
                InstrumentationRegistry.getInstrumentation().getUiAutomation().waitForIdle(200, 5000);
                return;
            }
            Thread.sleep(200);
        }
        screenshot("unexpected-visible-screen");
        fail("The expected Heritage heading was not visible: " + heading);
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
