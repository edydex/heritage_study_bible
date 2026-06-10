package faith.heritage.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import android.view.inputmethod.InputMethodManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

@CapacitorPlugin(name = "HeritageControls")
public class HeritageControlsPlugin extends Plugin {
    private static final int HERITAGE_BLUE = Color.rgb(30, 64, 175);
    private static boolean sideButtonScrollEnabled = false;
    private static boolean searchKeyboardCaptureInputEnabled = false;

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
    public void setReaderChromeHidden(PluginCall call) {
        boolean hidden = call.getBoolean("hidden", false);

        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                Window window = getActivity().getWindow();
                View decorView = window.getDecorView();
                WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);

                if (hidden) {
                    WindowCompat.setDecorFitsSystemWindows(window, true);
                    controller.hide(WindowInsetsCompat.Type.statusBars());
                    controller.setSystemBarsBehavior(
                        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    );
                    return;
                }

                WindowCompat.setDecorFitsSystemWindows(window, true);
                controller.show(WindowInsetsCompat.Type.statusBars());
                window.setStatusBarColor(HERITAGE_BLUE);
                window.setNavigationBarColor(Color.WHITE);
                controller.setAppearanceLightStatusBars(false);
                controller.setAppearanceLightNavigationBars(true);

                int systemUiFlags = 0;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    systemUiFlags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
                decorView.setSystemUiVisibility(systemUiFlags);
            });
        }

        JSObject result = new JSObject();
        result.put("hidden", hidden);
        call.resolve(result);
    }

    @PluginMethod
    public void exitApp(PluginCall call) {
        if (getActivity() != null) {
            getActivity().finish();
        }
        call.resolve();
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
