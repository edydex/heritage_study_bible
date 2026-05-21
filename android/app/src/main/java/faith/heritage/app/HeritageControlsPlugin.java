package faith.heritage.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "HeritageControls")
public class HeritageControlsPlugin extends Plugin {
    private static boolean sideButtonScrollEnabled = false;

    public static boolean isSideButtonScrollEnabled() {
        return sideButtonScrollEnabled;
    }

    @PluginMethod
    public void setSideButtonScrollEnabled(PluginCall call) {
        sideButtonScrollEnabled = call.getBoolean("enabled", false);
        JSObject result = new JSObject();
        result.put("enabled", sideButtonScrollEnabled);
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
