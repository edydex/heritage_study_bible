package faith.heritage.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.inputmethod.InputMethodManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import androidx.core.view.WindowCompat;
import androidx.core.view.ViewCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

@CapacitorPlugin(name = "HeritageControls")
public class HeritageControlsPlugin extends Plugin {
    private static boolean sideButtonScrollEnabled = false;
    private static boolean searchKeyboardCaptureInputEnabled = false;
    private int chromeInsetsGeneration = 0;

    public static boolean isSideButtonScrollEnabled() {
        return sideButtonScrollEnabled;
    }

    public static boolean isSearchKeyboardCaptureInputEnabled() {
        return searchKeyboardCaptureInputEnabled;
    }

    @PluginMethod
    public void setSideButtonScrollEnabled(PluginCall call) {
        sideButtonScrollEnabled = call.getBoolean("enabled", false);
        JSObject result = new JSObject();
        result.put("enabled", sideButtonScrollEnabled);
        call.resolve(result);
    }

    @PluginMethod
    public void setSearchKeyboardCaptureInputEnabled(PluginCall call) {
        searchKeyboardCaptureInputEnabled = call.getBoolean("enabled", false);

        if (getActivity() != null && getBridge() != null) {
            getActivity().runOnUiThread(() -> {
                View webView = getBridge().getWebView();
                InputMethodManager inputMethodManager = (InputMethodManager) getActivity().getSystemService(Context.INPUT_METHOD_SERVICE);
                if (webView != null && inputMethodManager != null) {
                    inputMethodManager.restartInput(webView);
                }
            });
        }

        JSObject result = new JSObject();
        result.put("enabled", searchKeyboardCaptureInputEnabled);
        call.resolve(result);
    }

    @PluginMethod
    public void setTextSelectionMenuSuppressed(PluginCall call) {
        boolean suppressed = call.getBoolean("suppressed", false);
        HeritageWebView.setTextSelectionMenuSuppressed(suppressed);

        if (getActivity() != null && getBridge() != null) {
            getActivity().runOnUiThread(() -> {
                View webView = getBridge().getWebView();
                if (webView instanceof HeritageWebView) {
                    ((HeritageWebView) webView).applyTextSelectionMenuSuppressed(suppressed);
                }
            });
        }

        JSObject result = new JSObject();
        result.put("suppressed", suppressed);
        call.resolve(result);
    }

    @PluginMethod
    public void setReaderChromeHidden(PluginCall call) {
        boolean hidden = call.getBoolean("hidden", false);

        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                Window window = getActivity().getWindow();
                View decorView = window.getDecorView();
                WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);

                WindowCompat.setDecorFitsSystemWindows(window, true);
                if (hidden) {
                    controller.setSystemBarsBehavior(
                        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    );
                    controller.hide(WindowInsetsCompat.Type.systemBars());
                } else {
                    controller.show(WindowInsetsCompat.Type.systemBars());
                    controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_DEFAULT);
                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                        // Keep the page's icon appearance and unrelated flags;
                        // only leave legacy fullscreen/immersive navigation.
                        int immersiveFlags = View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_IMMERSIVE | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
                        decorView.setSystemUiVisibility(decorView.getSystemUiVisibility() & ~immersiveFlags);
                    }
                }
                ViewCompat.requestApplyInsets(decorView);
                if (getBridge() != null) ViewCompat.requestApplyInsets(getBridge().getWebView());
                notifyReaderInsetsApplied(decorView, hidden, call, ++chromeInsetsGeneration);
            });
            return;
        }

        JSObject result = new JSObject();
        result.put("hidden", hidden);
        call.resolve(result);
    }

    private void notifyReaderInsetsApplied(View decorView, boolean hidden, PluginCall call, int generation) {
        // Edge-to-edge Android can change system-bar insets without resizing the
        // WebView. Observe frames without replacing Capacitor's inset listeners.
        decorView.postOnAnimation(new Runnable() {
            private int frames = 0;
            @Override public void run() {
                frames++;
                WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decorView);
                boolean applied = insets != null
                    && insets.isVisible(WindowInsetsCompat.Type.statusBars()) != hidden
                    && insets.isVisible(WindowInsetsCompat.Type.navigationBars()) != hidden;
                boolean superseded = generation != chromeInsetsGeneration;
                if (!superseded && frames < 30 && (frames < 2 || !applied)) {
                    decorView.postOnAnimation(this);
                    return;
                }
                if (!superseded && getBridge() != null) getBridge().triggerWindowJSEvent("heritage:native-insets-changed");
                JSObject result = new JSObject();
                result.put("hidden", hidden);
                result.put("applied", applied && !superseded);
                call.resolve(result);
            }
        });
    }

    @PluginMethod
    public void exitApp(PluginCall call) {
        if (getActivity() != null) {
            getActivity().finish();
        }
        call.resolve();
    }

    @PluginMethod
    public void getSafeArea(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            View web = getBridge().getWebView();
            WindowInsetsCompat windowInsets = ViewCompat.getRootWindowInsets(web);
            JSObject result = new JSObject();
            if (windowInsets != null) {
                Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                int[] location = new int[2];
                web.getLocationInWindow(location);
                View decor = getActivity().getWindow().getDecorView();
                float density = getContext().getResources().getDisplayMetrics().density;
                // Only inset the part actually covered by system UI. Older
                // Android versions already place the WebView inside the bars.
                int coveredTop = Math.max(0, insets.top - location[1]);
                Boolean darkStatusIcons = call.getBoolean("darkStatusIcons");
                if (darkStatusIcons != null) {
                    Window window = getActivity().getWindow();
                    // Android 15+ makes the status bar transparent even when the
                    // WebView already applies its inset. Older Android retains
                    // the app's blue bar unless content extends underneath it.
                    WindowCompat.getInsetsController(window, window.getDecorView())
                        .setAppearanceLightStatusBars(darkStatusIcons && (Build.VERSION.SDK_INT >= 35 || coveredTop > 0));
                }
                result.put("top", coveredTop / density);
                result.put("bottom", Math.max(0, insets.bottom - (decor.getHeight() - location[1] - web.getHeight())) / density);
            }
            call.resolve(result);
        });
    }

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        JSObject result = new JSObject();

        try {
            Context context = getContext();
            PackageManager packageManager = context.getPackageManager();
            PackageInfo packageInfo = packageManager.getPackageInfo(context.getPackageName(), 0);

            result.put("packageName", context.getPackageName());
            result.put("versionName", packageInfo.versionName);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                result.put("versionCode", packageInfo.getLongVersionCode());
            } else {
                result.put("versionCode", packageInfo.versionCode);
            }
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to read app version", error);
        }
    }

    @PluginMethod
    public void openExternalUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("Missing URL");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to open URL", error);
        }
    }
}
