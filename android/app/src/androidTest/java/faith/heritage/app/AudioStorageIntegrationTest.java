package faith.heritage.app;

import static org.junit.Assert.*;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Offline acceptance using real Capacitor private files/preferences and packaged UI. */
@RunWith(AndroidJUnit4.class)
public class AudioStorageIntegrationTest {
    @Rule public ActivityScenarioRule<MainActivity> activity = new ActivityScenarioRule<>(MainActivity.class);
    private static final String TRACK = "lv-b7678381ba5a32ee9f74b572";

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
        fail("Packaged audio UI did not reach: " + expression + "; " + evaluate("document.body.innerText.slice(-1200)"));
    }
    private JSONObject nativeResult(String code) throws Exception {
        evaluate("window.__audioAcceptance = null; (async () => { try { " + code
            + " } catch (error) { window.__audioAcceptance = JSON.stringify({error:String(error)}); } })()");
        waitFor("typeof window.__audioAcceptance === 'string'");
        return new JSONObject(new JSONTokener(evaluate("window.__audioAcceptance")).nextValue().toString());
    }
    @Before public void ready() throws Exception {
        waitFor("window.Capacitor?.isNativePlatform() && document.getElementById('root')?.innerText.length > 30");
    }
    @Test public void deleteOfflineAudioThroughInternalStorage() throws Exception {
        JSONObject setup = nativeResult(
            "const fs=window.Capacitor.Plugins.Filesystem; const prefs=window.Capacitor.Plugins.Preferences;"
            + "await fs.writeFile({path:'heritage-audio/native-acceptance.mp3',directory:'DATA',recursive:true,data:btoa('ID3-native-audio-test')});"
            + "await prefs.set({key:'heritage-audio-downloads-v2',value:JSON.stringify({'" + TRACK + "':{trackId:'" + TRACK
            + "',bookId:'josephus-wars',bookTitle:'The Wars of the Jews',label:'Native acceptance audio',path:'heritage-audio/native-acceptance.mp3',bytes:21}})});"
            + "window.__audioAcceptance=JSON.stringify({ok:true});");
        assertTrue(setup.toString(), setup.optBoolean("ok"));
        evaluate("location.hash='/settings/storage'");
        waitFor("document.body.innerText.includes('Native acceptance audio')");
        evaluate("document.querySelector('[aria-label=\"Delete Native acceptance audio\"]').click()");
        waitFor("document.querySelector('[role=alertdialog]')");
        evaluate("Array.from(document.querySelectorAll('[role=alertdialog] button')).find(button=>button.textContent==='Delete').click()");
        waitFor("document.body.innerText.includes('Downloaded audio removed.') && !document.body.innerText.includes('Native acceptance audio')");
        JSONObject result = nativeResult(
            "const prefs=await window.Capacitor.Plugins.Preferences.get({key:'heritage-audio-downloads-v2'});"
            + "let missing=false;try{await window.Capacitor.Plugins.Filesystem.stat({path:'heritage-audio/native-acceptance.mp3',directory:'DATA'});}catch(error){missing=error.code==='OS-PLUG-FILE-0008';}"
            + "window.__audioAcceptance=JSON.stringify({missing,index:JSON.parse(prefs.value)});");
        assertTrue(result.toString(), result.optBoolean("missing"));
        assertFalse(result.getJSONObject("index").has(TRACK));
    }
    @Test public void interruptedTransferCanBeRemovedWithoutTouchingNotes() throws Exception {
        JSONObject setup = nativeResult(
            "await window.Capacitor.Plugins.Filesystem.writeFile({path:'heritage-audio/interrupted-acceptance.mp3.part',directory:'DATA',recursive:true,data:btoa('partial')});"
            + "localStorage.setItem('audio-acceptance-unrelated','keep');window.__audioAcceptance=JSON.stringify({ok:true});");
        assertTrue(setup.toString(), setup.optBoolean("ok"));
        evaluate("location.hash='/settings/storage';window.dispatchEvent(new Event('heritage:audio-downloads-changed'))");
        waitFor("document.body.innerText.includes('Interrupted download')");
        evaluate("document.querySelector('[aria-label=\"Delete Interrupted download\"]').click()");
        waitFor("document.querySelector('[role=alertdialog]')");
        evaluate("Array.from(document.querySelectorAll('[role=alertdialog] button')).find(button=>button.textContent==='Delete').click()");
        waitFor("document.body.innerText.includes('Downloaded audio removed.') && !document.body.innerText.includes('Interrupted download')");
        assertEquals("\"keep\"", evaluate("localStorage.getItem('audio-acceptance-unrelated')"));
        evaluate("localStorage.removeItem('audio-acceptance-unrelated')");
    }
}
