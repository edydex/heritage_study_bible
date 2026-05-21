package faith.heritage.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int HERITAGE_BLUE = Color.rgb(30, 64, 175);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(HeritageControlsPlugin.class);
        super.onCreate(savedInstanceState);
        configureSystemBars();
    }

    private void configureSystemBars() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, true);
        window.setStatusBarColor(HERITAGE_BLUE);
        window.setNavigationBarColor(Color.WHITE);

        int systemUiFlags = 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            systemUiFlags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        window.getDecorView().setSystemUiVisibility(systemUiFlags);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        boolean isVolumeKey = keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN;
        boolean isPageKey = keyCode == KeyEvent.KEYCODE_PAGE_UP || keyCode == KeyEvent.KEYCODE_PAGE_DOWN;

        if ((isVolumeKey || isPageKey) && HeritageControlsPlugin.isSideButtonScrollEnabled()) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) {
                String direction = (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_PAGE_UP) ? "up" : "down";
                if (getBridge() != null) {
                    getBridge().eval(
                        "window.dispatchEvent(new CustomEvent('heritage:native-scroll',{detail:{direction:'" + direction + "'}}));",
                        null
                    );
                }
            }
            return true;
        }

        return super.dispatchKeyEvent(event);
    }
}
