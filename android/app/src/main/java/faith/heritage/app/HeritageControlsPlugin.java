package faith.heritage.app;

import android.content.Context;
import android.view.View;
import android.view.inputmethod.InputMethodManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "HeritageControls")
public class HeritageControlsPlugin extends Plugin {
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
    public void exitApp(PluginCall call) {
        if (getActivity() != null) {
            getActivity().finish();
        }
        call.resolve();
    }
}
