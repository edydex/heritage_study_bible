package faith.heritage.app;

import android.os.Bundle;
import android.view.KeyEvent;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(HeritageControlsPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        boolean isVolumeKey = keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN;

        if (isVolumeKey && HeritageControlsPlugin.isSideButtonScrollEnabled()) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) {
                String direction = keyCode == KeyEvent.KEYCODE_VOLUME_UP ? "up" : "down";
                if (getBridge() != null) {
                    getBridge().triggerWindowJSEvent(
                        "heritage:native-scroll",
                        "{\"direction\":\"" + direction + "\"}"
                    );
                }
            }
            return true;
        }

        return super.dispatchKeyEvent(event);
    }
}
