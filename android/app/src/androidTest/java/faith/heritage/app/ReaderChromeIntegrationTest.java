package faith.heritage.app;

import static org.junit.Assert.*;

import android.graphics.Bitmap;
import android.os.Build;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real packaged-reader scrolling and Android status/navigation bar insets. */
@RunWith(AndroidJUnit4.class)
public class ReaderChromeIntegrationTest {
    @Rule public ActivityScenarioRule<MainActivity> activity = new ActivityScenarioRule<>(MainActivity.class);

    private String js(String source) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>("null");
        activity.getScenario().onActivity(instance -> {
            if (instance.getBridge() == null) { done.countDown(); return; }
            instance.getBridge().getWebView().evaluateJavascript(source, value -> {
                result.set(value); done.countDown();
            });
        });
        assertTrue("WebView evaluation timed out", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private void await(Callable<Boolean> condition) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(25);
        while (System.nanoTime() < deadline) {
            if (condition.call()) return;
            Thread.sleep(100);
        }
        fail("Reader/system-bar condition timed out; route=" + js("location.hash") + "; bars=" + bars());
    }

    private JSONObject bars() {
        AtomicReference<JSONObject> result = new AtomicReference<>(new JSONObject());
        activity.getScenario().onActivity(instance -> {
            View decor = instance.getWindow().getDecorView(), web = instance.getBridge().getWebView();
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);
            if (insets == null) return;
            Insets edges = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            int[] location = new int[2]; web.getLocationInWindow(location);
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(instance.getWindow(), decor);
            try {
                result.set(new JSONObject()
                    .put("statusVisible", insets.isVisible(WindowInsetsCompat.Type.statusBars()))
                    .put("navigationVisible", insets.isVisible(WindowInsetsCompat.Type.navigationBars()))
                    .put("safeBottom", Math.max(0, edges.bottom - (decor.getHeight() - location[1] - web.getHeight())) / instance.getResources().getDisplayMetrics().density)
                    .put("behavior", controller.getSystemBarsBehavior())
                    .put("flags", decor.getSystemUiVisibility())
                    .put("lightStatus", controller.isAppearanceLightStatusBars())
                    .put("lightNavigation", controller.isAppearanceLightNavigationBars())
                    .put("statusColor", instance.getWindow().getStatusBarColor())
                    .put("navigationColor", instance.getWindow().getNavigationBarColor()));
            } catch (Exception error) { throw new AssertionError(error); }
        });
        return result.get();
    }

    private void awaitBars(boolean visible) throws Exception {
        await(() -> bars().optBoolean("statusVisible", !visible) == visible
            && bars().optBoolean("navigationVisible", !visible) == visible);
        await(() -> {
            String cssBottom = js("parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-bottom'))");
            return !"null".equals(cssBottom) && Math.abs(Double.parseDouble(cssBottom) - bars().getDouble("safeBottom")) < 1;
        });
    }

    private void screenshot(String name) throws Exception {
        InstrumentationRegistry.getInstrumentation().getUiAutomation().waitForIdle(200, 5000);
        Bitmap screenshot = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(screenshot);
        File output = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "native-acceptance/" + name + ".png");
        assertTrue(output.getParentFile().isDirectory() || output.getParentFile().mkdirs());
        try (FileOutputStream stream = new FileOutputStream(output)) {
            assertTrue(screenshot.compress(Bitmap.CompressFormat.PNG, 100, stream));
        } finally { screenshot.recycle(); }
    }

    @Test public void readerScrollHidesBothSystemBarsAndRestoresInsetsOnExit() throws Exception {
        await(() -> "true".equals(js("Boolean(window.Capacitor?.isNativePlatform() && document.getElementById('root')?.innerText.length > 30)")));
        js("location.hash='/genesis/1'");
        await(() -> "true".equals(js("Boolean(document.querySelector('#verse-1-1') && document.querySelector('header'))")));
        js("window.scrollTo({top:0,behavior:'instant'});window.__readerInsetsEvents=0;window.addEventListener('heritage:native-insets-changed',()=>window.__readerInsetsEvents++)");
        awaitBars(true);
        JSONObject before = bars();
        screenshot("reader-bars-visible");
        // The reader intentionally ignores resize-induced scroll for 700 ms.
        Thread.sleep(800);
        int events = Integer.parseInt(js("window.__readerInsetsEvents"));
        js("window.scrollTo({top:420,behavior:'instant'})");
        awaitBars(false);
        await(() -> Integer.parseInt(js("window.__readerInsetsEvents")) > events);
        assertEquals(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE, bars().getInt("behavior"));
        screenshot("reader-bars-hidden");
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            int flags = bars().getInt("flags");
            assertTrue((flags & View.SYSTEM_UI_FLAG_HIDE_NAVIGATION) != 0);
            assertTrue((flags & View.SYSTEM_UI_FLAG_FULLSCREEN) != 0);
            assertTrue((flags & View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY) != 0);
        }

        Thread.sleep(800);
        js("window.scrollTo({top:160,behavior:'instant'})");
        awaitBars(true);
        JSONObject restored = bars();
        assertEquals(before.getBoolean("lightStatus"), restored.getBoolean("lightStatus"));
        assertEquals(before.getBoolean("lightNavigation"), restored.getBoolean("lightNavigation"));
        assertEquals(before.getInt("statusColor"), restored.getInt("statusColor"));
        assertEquals(before.getInt("navigationColor"), restored.getInt("navigationColor"));
        int immersiveFlags = View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_IMMERSIVE | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
        assertEquals(0, restored.getInt("flags") & immersiveFlags);

        Thread.sleep(800);
        js("window.scrollTo({top:520,behavior:'instant'})");
        awaitBars(false);
        js("location.hash='/settings/audio'");
        await(() -> "true".equals(js("document.body.innerText.includes('Audio Settings')")));
        awaitBars(true);
        screenshot("reader-bars-restored");
    }
}
