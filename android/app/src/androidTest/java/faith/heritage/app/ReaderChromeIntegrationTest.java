package faith.heritage.app;

import static org.junit.Assert.*;

import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.WebView;
import androidx.appcompat.view.WindowCallbackWrapper;
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
import java.io.InputStream;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONArray;
import org.json.JSONTokener;
import org.junit.After;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real packaged-reader scrolling and Android status/navigation bar insets. */
@RunWith(AndroidJUnit4.class)
public class ReaderChromeIntegrationTest {
    @Rule public ActivityScenarioRule<MainActivity> activity = new ActivityScenarioRule<>(MainActivity.class);
    private String lastGestureTarget = "none";
    private final JSONArray nativeTitleEvents = new JSONArray();
    private final JSONArray injectedTitleEvents = new JSONArray();
    private Window.Callback originalWindowCallback;
    private Window.Callback tracedWindowCallback;

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
        await("Reader condition", condition);
    }

    private void await(String stage, Callable<Boolean> condition) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(25);
        while (System.nanoTime() < deadline) {
            if (condition.call()) return;
            Thread.sleep(100);
        }
        String evidence = "stage=" + stage + "; bars=" + bars() + "; native=" + nativeInputState() + "; lastTarget=" + lastGestureTarget
            + "; reader=" + readerInputState();
        try { retainNativeInputDump("reader-failure"); }
        catch (Exception error) { evidence += "; inputDumpError=" + error; }
        try { screenshot("reader-failure"); }
        catch (Exception error) { evidence += "; screenshotError=" + error; }
        fail("Reader acceptance condition timed out; " + evidence);
    }

    private String readerInputState() throws Exception {
        return js("JSON.stringify((()=>{const target=document.querySelector('.navigation-wheel-trigger');"
                + "const rect=target?.getBoundingClientRect();const hit=rect?document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2):null;"
                + "return {route:location.hash,scrollY,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},"
                + "visualViewport:visualViewport?{height:visualViewport.height,offsetTop:visualViewport.offsetTop,scale:visualViewport.scale}:null,"
                + "title:target?{text:target.textContent,rect:rect.toJSON(),hit:hit?.outerHTML.slice(0,300)}:null,"
                + "targetReady:window.__nativeTitleTarget,traceInstalled:window.__nativeTitleTraceDocument===document,"
                + "traceToken:window.__nativeTitleTraceToken,pointerEvents:window.__nativeTitleEvents,body:document.body.innerText.slice(0,500)}})())");
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
        await("Both system bars " + (visible ? "visible" : "hidden"), () -> bars().optBoolean("statusVisible", !visible) == visible
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

    private float[] screenCenter(String selector) throws Exception {
        String encoded = js("JSON.stringify((()=>{const element=[...document.querySelectorAll(" + JSONObject.quote(selector)
            + ")].find(node=>node.getClientRects().length);if(!element)return null;const rect=element.getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2}})())");
        Object value = new JSONTokener(encoded).nextValue();
        assertNotEquals("Missing native gesture target: " + selector, "null", value.toString());
        JSONObject css = new JSONObject(value.toString());
        AtomicReference<float[]> result = new AtomicReference<>();
        activity.getScenario().onActivity(instance -> {
            View web = instance.getBridge().getWebView();
            int[] location = new int[2]; web.getLocationOnScreen(location);
            float density = instance.getResources().getDisplayMetrics().density;
            result.set(new float[] { location[0] + (float) css.optDouble("x") * density,
                location[1] + (float) css.optDouble("y") * density });
            lastGestureTarget = selector + "; css=" + css + "; nativeWeb={x:" + location[0] + ",y:" + location[1]
                + ",width:" + web.getWidth() + ",height:" + web.getHeight() + ",density:" + density + "}";
        });
        return result.get();
    }

    private void awaitVisualCommit() throws Exception {
        CountDownLatch painted = new CountDownLatch(1);
        activity.getScenario().onActivity(instance -> {
            WebView web = instance.getBridge().getWebView();
            assertTrue("Native gesture requires a visible focused WebView", web.isShown() && web.hasWindowFocus());
            // DOM queries can succeed before WebView has committed the route's
            // frame and hit-test tree. The callback guarantees the next draw
            // contains the queried DOM; observe that draw before native input.
            web.postVisualStateCallback(System.nanoTime(), new WebView.VisualStateCallback() {
                @Override public void onComplete(long requestId) {
                    web.postInvalidateOnAnimation();
                    web.postOnAnimation(() -> web.postOnAnimation(painted::countDown));
                }
            });
        });
        assertTrue("WebView did not commit the native gesture target", painted.await(10, TimeUnit.SECONDS));
    }

    private float[] readyTitleCenter() throws Exception {
        js("window.__nativeTitleTarget={ready:false};(()=>{let previous='',lastNode=null,stable=0;"
            + "const sample=()=>{const node=document.querySelector('.navigation-wheel-trigger'),rect=node?.getBoundingClientRect();"
            + "const x=rect?rect.x+rect.width/2:-1,y=rect?rect.y+rect.height/2:-1,hit=document.elementFromPoint(x,y);"
            + "const hittable=Boolean(node&&rect.width>0&&rect.height>0&&x>0&&y>0&&x<innerWidth&&y<innerHeight"
            + "&&node.contains(hit)&&getComputedStyle(node).pointerEvents!=='none'&&node.checkVisibility?.({checkOpacity:true,checkVisibilityCSS:true})!==false);"
            + "const signature=JSON.stringify([rect?.x,rect?.y,rect?.width,rect?.height,innerWidth,innerHeight,scrollY]);"
            + "stable=hittable&&node===lastNode&&signature===previous?stable+1:0;previous=signature;lastNode=node;"
            + "window.__nativeTitleTarget={ready:stable>=2,hittable,stable,signature};"
            + "if(stable<2)requestAnimationFrame(sample)};requestAnimationFrame(sample)})()");
        await("Title has a stable unobstructed touch target", () -> "true".equals(js("window.__nativeTitleTarget.ready")));
        awaitVisualCommit();
        return screenCenter(".navigation-wheel-trigger");
    }

    private void traceTitlePointerEvents() throws Exception {
        activity.getScenario().onActivity(instance -> {
            Window window = instance.getWindow();
            originalWindowCallback = window.getCallback();
            tracedWindowCallback = new WindowCallbackWrapper(originalWindowCallback) {
                @Override public boolean dispatchTouchEvent(MotionEvent event) {
                    try {
                        JSONObject entry = new JSONObject().put("action", event.getActionMasked())
                            .put("rawX", event.getRawX()).put("rawY", event.getRawY())
                            .put("x", event.getX()).put("y", event.getY())
                            .put("source", event.getSource()).put("toolType", event.getToolType(0))
                            .put("deviceId", event.getDeviceId()).put("event", event.toString()).put("time", event.getEventTime());
                        nativeTitleEvents.put(entry);
                        if (nativeTitleEvents.length() > 32) nativeTitleEvents.remove(0);
                        boolean handled = super.dispatchTouchEvent(event);
                        entry.put("handled", handled);
                        return handled;
                    } catch (org.json.JSONException error) { throw new AssertionError(error); }
                }
            };
            window.setCallback(tracedWindowCallback);
        });
        js("window.__nativeTitleEvents=[];window.__nativeTitleTraceDocument=document;window.__nativeTitleTraceToken=performance.timeOrigin+':'+performance.now();"
            + "for(const type of ['pointerdown','pointerup','pointercancel','touchstart','touchend','touchcancel','click'])"
            + "document.addEventListener(type,event=>{window.__nativeTitleEvents.push({type:event.type,pointerType:event.pointerType,"
            + "x:event.clientX,y:event.clientY,target:event.target.tagName+'.'+event.target.className,time:performance.now()});"
            + "if(window.__nativeTitleEvents.length>32)window.__nativeTitleEvents.shift()},true)");
    }

    @After public void restoreWindowInputCallback() {
        if (originalWindowCallback == null) return;
        try { retainNativeInputDump("reader-after-inputs"); }
        catch (Exception | AssertionError error) {
            // A failed evidence capture must never replace the actual test
            // assertion (including direct hold assertions outside await()).
            android.util.Log.w("ReaderInputEvidence", "Could not retain final input state", error);
        }
        activity.getScenario().onActivity(instance -> {
            if (instance.getWindow().getCallback() == tracedWindowCallback) instance.getWindow().setCallback(originalWindowCallback);
        });
    }

    private JSONObject viewInputState(View view) throws org.json.JSONException {
        int[] screen = new int[2], window = new int[2];
        view.getLocationOnScreen(screen); view.getLocationInWindow(window);
        Rect visible = new Rect(); boolean globalVisible = view.getGlobalVisibleRect(visible);
        return new JSONObject().put("class", view.getClass().getName()).put("screenX", screen[0]).put("screenY", screen[1])
            .put("windowX", window[0]).put("windowY", window[1]).put("width", view.getWidth()).put("height", view.getHeight())
            .put("globalVisible", globalVisible).put("visibleBounds", visible.toShortString())
            .put("shown", view.isShown()).put("windowFocus", view.hasWindowFocus()).put("viewFocus", view.hasFocus())
            .put("scaleX", view.getScaleX()).put("scaleY", view.getScaleY())
            .put("translationX", view.getTranslationX()).put("translationY", view.getTranslationY())
            .put("displayId", view.getDisplay() == null ? -1 : view.getDisplay().getDisplayId());
    }

    private void visibleNativeViews(View view, JSONArray result, int depth) throws org.json.JSONException {
        if (depth > 8 || !view.isShown() || result.length() >= 40) return;
        result.put(viewInputState(view).put("depth", depth));
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) visibleNativeViews(group.getChildAt(i), result, depth + 1);
        }
    }

    private JSONObject nativeInputState() {
        AtomicReference<JSONObject> result = new AtomicReference<>(new JSONObject());
        activity.getScenario().onActivity(instance -> {
            try {
                WebView web = instance.getBridge().getWebView();
                View decor = instance.getWindow().getDecorView();
                WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);
                JSONArray views = new JSONArray(); visibleNativeViews(decor, views, 0);
                result.set(new JSONObject().put("windowCallbackInstalled", instance.getWindow().getCallback() == tracedWindowCallback)
                    .put("web", viewInputState(web).put("pageScale", web.getScale()))
                    .put("decor", viewInputState(decor)).put("windowFlags", instance.getWindow().getAttributes().flags)
                    .put("systemBars", insets == null ? "none" : insets.getInsets(WindowInsetsCompat.Type.systemBars()).toString())
                    .put("ime", insets == null ? "none" : insets.getInsets(WindowInsetsCompat.Type.ime()).toString())
                    .put("systemGestures", insets == null ? "none" : insets.getInsets(WindowInsetsCompat.Type.systemGestures()).toString())
                    .put("events", nativeTitleEvents).put("injectedEvents", injectedTitleEvents).put("visibleViews", views));
            } catch (org.json.JSONException error) { throw new AssertionError(error); }
        });
        return result.get();
    }

    private void retainNativeInputDump(String name) throws Exception {
        File output = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "native-acceptance");
        assertTrue(output.isDirectory() || output.mkdirs());
        try (FileOutputStream stream = new FileOutputStream(new File(output, name + "-native.json"))) {
            stream.write(nativeInputState().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        try (FileOutputStream stream = new FileOutputStream(new File(output, name + "-dom.json"))) {
            Object state = new JSONTokener(readerInputState()).nextValue();
            stream.write(state.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        for (String service : new String[] { "input", "window windows" }) {
            // Read-only, bounded system snapshots distinguish a SystemUI/input
            // recipient from a touch that reached this window but not the DOM.
            try (InputStream input = new ParcelFileDescriptor.AutoCloseInputStream(InstrumentationRegistry.getInstrumentation().getUiAutomation()
                    .executeShellCommand("dumpsys -t 2 " + service));
                 FileOutputStream stream = new FileOutputStream(new File(output, name + "-" + service.replace(' ', '-') + ".txt"))) {
                byte[] buffer = new byte[8192]; int count, remaining = 262144;
                while (remaining > 0 && (count = input.read(buffer, 0, Math.min(buffer.length, remaining))) != -1) {
                    stream.write(buffer, 0, count); remaining -= count;
                }
            }
        }
    }

    private void touch(int action, long downTime, float x, float y) {
        MotionEvent.PointerProperties finger = new MotionEvent.PointerProperties();
        finger.id = 0;
        finger.toolType = MotionEvent.TOOL_TYPE_FINGER;
        MotionEvent.PointerCoords position = new MotionEvent.PointerCoords();
        position.x = x; position.y = y;
        position.pressure = action == MotionEvent.ACTION_UP ? 0 : 1;
        position.size = 1;
        MotionEvent event = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), action, 1,
            new MotionEvent.PointerProperties[] { finger }, new MotionEvent.PointerCoords[] { position },
            0, 0, 1, 1, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0);
        try {
            boolean injected = InstrumentationRegistry.getInstrumentation().getUiAutomation().injectInputEvent(event, true);
            if (tracedWindowCallback != null) {
                try {
                    injectedTitleEvents.put(new JSONObject().put("action", action).put("x", x).put("y", y)
                        .put("downTime", downTime).put("eventTime", event.getEventTime()).put("accepted", injected));
                    if (injectedTitleEvents.length() > 32) injectedTitleEvents.remove(0);
                } catch (org.json.JSONException error) { throw new AssertionError(error); }
            }
            assertTrue("Native touch injection failed", injected);
        } finally { event.recycle(); }
    }

    private void tap(String selector) throws Exception {
        float[] point = screenCenter(selector);
        long downTime = SystemClock.uptimeMillis();
        touch(MotionEvent.ACTION_DOWN, downTime, point[0], point[1]);
        try { Thread.sleep(80); }
        finally { touch(MotionEvent.ACTION_UP, downTime, point[0], point[1]); }
    }

    private void configureButton(String text, boolean exact) throws Exception {
        // Configure the comparison through its normal UI handlers; only the
        // word gestures under test are injected as native touchscreen events.
        String match = "[...document.querySelectorAll('button')].find(button=>button.getClientRects().length && button.textContent.trim()"
            + (exact ? "===" + JSONObject.quote(text) : ".includes(" + JSONObject.quote(text) + ")") + ")";
        await(() -> "true".equals(js("Boolean(" + match + ")")));
        js(match + ".click()");
    }

    @Test public void parallelWordsRespondToNativeTapHoldReleaseAndScrolling() throws Exception {
        await(() -> "true".equals(js("Boolean(window.Capacitor?.isNativePlatform() && document.getElementById('root')?.innerText.length > 30)")));
        js("location.hash='/romans/1';window.scrollTo({top:0,behavior:'instant'})");
        await(() -> "true".equals(js("Boolean(document.querySelector('#verse-1-1') && document.querySelector('[title=\"Change translation\"]'))")));
        js("document.querySelector('[title=\"Change translation\"]').click()");
        configureButton("Berean Standard Bible", false);
        js("document.querySelector('[title=\"Enable parallel mode\"]').click()");
        configureButton("English", true);
        configureButton("Literal Standard Version", false);
        String word = "#verse-1-1 [data-translation='BSB'] [data-word-paired='true']";
        await(() -> "true".equals(js("Boolean([...document.querySelectorAll(" + JSONObject.quote(word)
            + ")].find(node=>node.getClientRects().length) && document.querySelector('#verse-1-1 [data-translation=\"LSV\"] [data-word-paired=\"true\"]'))")));
        String active = "[...document.querySelectorAll('.bible-word-link-active')].filter(node=>node.getClientRects().length)";

        tap(word);
        await(() -> "2".equals(js(active + ".length")));
        assertEquals("Both translations must select the checked Paul source anchor", "\"Paul|Paul\"", js(active + ".map(node=>node.textContent).join('|')"));
        assertEquals("A short word tap must leave the comparison visible", "false", js("Boolean(document.querySelector('.word-study-dialog[open]'))"));
        screenshot("parallel-native-tap-pair");
        tap("[aria-label='Clear word match']");
        await(() -> "0".equals(js(active + ".length")));

        float[] held = screenCenter(word);
        long downTime = SystemClock.uptimeMillis();
        touch(MotionEvent.ACTION_DOWN, downTime, held[0], held[1]);
        try {
            Thread.sleep(700);
            assertEquals("A native finger hold must open word study", "true", js("Boolean(document.querySelector('.word-study-dialog[open]'))"));
        } finally { touch(MotionEvent.ACTION_UP, downTime, held[0], held[1]); }
        // The original finger's release must not click the newly opened modal
        // backdrop and dismiss it. Wait for the real occurrence content too.
        await(() -> "true".equals(js("Boolean(document.querySelector('.word-study-dialog[open]')?.textContent.includes('Occurrences of the source lemma'))")));
        js("window.__wordReleasePainted=false;requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__wordReleasePainted=true}))");
        await(() -> "true".equals(js("window.__wordReleasePainted")));
        assertEquals("Held-release compatibility click dismissed word study", "true", js("Boolean(document.querySelector('.word-study-dialog[open]'))"));
        screenshot("parallel-native-hold-release-study");
        tap("[aria-label='Close word study']");
        await(() -> "false".equals(js("Boolean(document.querySelector('.word-study-dialog[open]'))")));
        assertEquals("Closing study must retain the selected pair", "2", js(active + ".length"));
        tap("[aria-label='Clear word match']");
        await(() -> "0".equals(js(active + ".length")));

        float[] start = screenCenter(word);
        double beforeScroll = Double.parseDouble(js("window.scrollY"));
        AtomicReference<Float> density = new AtomicReference<>(1f);
        activity.getScenario().onActivity(instance -> density.set(instance.getResources().getDisplayMetrics().density));
        downTime = SystemClock.uptimeMillis();
        touch(MotionEvent.ACTION_DOWN, downTime, start[0], start[1]);
        float endY = start[1];
        try {
            for (int step = 1; step <= 8; step++) {
                Thread.sleep(16);
                endY = start[1] - step * 14 * density.get();
                touch(MotionEvent.ACTION_MOVE, downTime, start[0], endY);
            }
        } finally { touch(MotionEvent.ACTION_UP, downTime, start[0], endY); }
        await(() -> Double.parseDouble(js("window.scrollY")) > beforeScroll + 30);
        long remainingHold = downTime + 700 - SystemClock.uptimeMillis();
        if (remainingHold > 0) Thread.sleep(remainingHold);
        assertEquals("Scrolling must cancel the pending study hold", "false", js("Boolean(document.querySelector('.word-study-dialog[open]'))"));
        assertEquals("A scroll release must not select a word", "0", js(active + ".length"));
        screenshot("parallel-native-scroll-cancels-study");
    }

    private void verifyNativeTitleTapAndHoldSlide() throws Exception {
        js("location.hash='/genesis/1';window.scrollTo({top:0,behavior:'instant'})");
        await(() -> "true".equals(js("Boolean(document.querySelector('#verse-1-1') && document.querySelector('.navigation-wheel-trigger'))")));
        awaitBars(true);
        traceTitlePointerEvents();
        retainNativeInputDump("reader-before-title-tap");
        float[] title = readyTitleCenter();
        long tapDown = SystemClock.uptimeMillis();
        touch(MotionEvent.ACTION_DOWN, tapDown, title[0], title[1]);
        Thread.sleep(80);
        touch(MotionEvent.ACTION_UP, tapDown, title[0], title[1]);
        await("One native short title tap opens Select Book", () -> "true".equals(js("document.body.innerText.includes('Select Book')")));
        InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
        await(() -> "false".equals(js("document.body.innerText.includes('Select Book')")));

        // Exercise the real immersive bottom title, where Android's native
        // long-press handling previously cancelled the pointer after opening.
        Thread.sleep(800);
        js("window.scrollTo({top:520,behavior:'instant'})");
        awaitBars(false);
        title = readyTitleCenter();
        long downTime = SystemClock.uptimeMillis();
        float x = title[0], y = title[1];
        touch(MotionEvent.ACTION_DOWN, downTime, x, y);
        try {
            Thread.sleep(650);
            assertEquals("A continuous native hold must keep the navigation fan open", "true",
                js("Boolean(document.querySelector('.navigation-wheel'))"));
            float[] destination = screenCenter(".navigation-wheel-choice[aria-label='Audiobooks'] .navigation-wheel-label");
            for (int step = 1; step <= 8; step++) {
                Thread.sleep(16);
                x = title[0] + (destination[0] - title[0]) * step / 8f;
                y = title[1] + (destination[1] - title[1]) * step / 8f;
                touch(MotionEvent.ACTION_MOVE, downTime, x, y);
            }
        } finally {
            // One downTime for the entire native stream, including cleanup if
            // the menu was cancelled; separate ADB commands cannot ensure this.
            touch(MotionEvent.ACTION_UP, downTime, x, y);
        }
        await(() -> "true".equals(js("location.hash.startsWith('#/audio?kind=audiobook')")));
        screenshot("reader-native-hold-slide-audiobooks");
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
        verifyNativeTitleTapAndHoldSlide();
    }
}
