package faith.heritage.app;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.media.browse.MediaBrowser;
import android.media.session.MediaController;
import android.media.session.PlaybackState;
import android.os.Bundle;
import android.os.ResultReceiver;
import android.view.KeyEvent;
import android.widget.TextView;

/**
 * A visible, separate-UID car host. Background self-control does not receive
 * Android 15's user-interaction exemption for media-session audio focus.
 * Only the androidTest APK contains this Activity.
 */
public final class CarControllerTestActivity extends Activity {
    private MediaBrowser browser;
    private MediaController controller;
    private Intent pending;
    private Intent closing;
    private String error = "";
    private boolean resumed;
    private final MediaController.Callback callback = new MediaController.Callback() {
        @Override public void onPlaybackStateChanged(PlaybackState state) {
            if (state != null && state.getErrorMessage() != null) error = state.getErrorMessage().toString();
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        TextView label = new TextView(this);
        label.setText("Heritage car controller acceptance test\nThe Bible reader remains closed.");
        label.setPadding(24, 48, 24, 24);
        setContentView(label);
        pending = getIntent();
        browser = new MediaBrowser(this,
            new ComponentName(pending.getStringExtra("targetPackage"), pending.getStringExtra("targetService")),
            new MediaBrowser.ConnectionCallback() {
                @Override public void onConnected() {
                    controller = new MediaController(CarControllerTestActivity.this, browser.getSessionToken());
                    controller.registerCallback(callback);
                    executePending();
                }
                @Override public void onConnectionFailed() { failPending("Car host could not connect"); }
                @Override public void onConnectionSuspended() { failPending("Car host connection suspended"); }
            }, null);
        browser.connect();
    }

    @Override public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        pending = intent;
        executePending();
    }
    @Override public void onResume() { super.onResume(); resumed = true; executePending(); }
    @Override public void onPause() { resumed = false; super.onPause(); }
    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) executePending();
    }

    private void executePending() {
        if (pending == null) return;
        if ("close".equals(pending.getStringExtra("command"))) {
            closing = pending;
            pending = null;
            finish();
            return;
        }
        // Real transport requests must originate from the visible external
        // host, just as a driver pressing Play in Android Auto does.
        if (controller == null || !resumed || !hasWindowFocus()) return;
        Intent request = pending;
        pending = null;
        try {
            String command = request.getStringExtra("command");
            switch (command) {
                case "connect": case "state": break;
                case "play": controller.getTransportControls().play(); break;
                case "pause": controller.getTransportControls().pause(); break;
                case "playFromMediaId": controller.getTransportControls().playFromMediaId(request.getStringExtra("trackId"), Bundle.EMPTY); break;
                case "mediaPlayPause":
                    controller.dispatchMediaButtonEvent(new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE));
                    controller.dispatchMediaButtonEvent(new KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE));
                    break;
                default: throw new IllegalArgumentException("Unknown car test command: " + command);
            }
            android.util.Log.i("HeritageCarTestHost", command + " from uid=" + android.os.Process.myUid() + "; resumed=" + resumed);
            reply(request, null);
        } catch (RuntimeException failure) { reply(request, failure.toString()); }
    }

    private void failPending(String message) {
        if (pending != null) { reply(pending, message); pending = null; }
    }
    private void reply(Intent request, String failure) {
        ResultReceiver receiver = request.getParcelableExtra("result");
        if (receiver == null) return;
        Bundle result = new Bundle();
        result.putInt("uid", android.os.Process.myUid());
        result.putString("package", getPackageName());
        result.putBoolean("resumed", resumed);
        result.putBoolean("focused", hasWindowFocus());
        result.putBoolean("trusted", isTrustedMediaController());
        result.putString("root", browser != null && browser.isConnected() ? browser.getRoot() : "");
        result.putString("playbackError", error);
        result.putString("failure", failure);
        receiver.send(failure == null ? 0 : 1, result);
    }
    private boolean isTrustedMediaController() {
        if (android.os.Build.VERSION.SDK_INT >= 28) {
            android.media.session.MediaSessionManager manager = getSystemService(android.media.session.MediaSessionManager.class);
            return manager.isTrustedForMediaControl(new android.media.session.MediaSessionManager.RemoteUserInfo(
                getPackageName(), android.os.Process.myPid(), android.os.Process.myUid()));
        }
        String enabled = android.provider.Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        String component = new ComponentName(this, CarControllerTestNotificationListener.class).flattenToString();
        return enabled != null && java.util.Arrays.asList(enabled.split(":")).contains(component);
    }
    @Override public void onDestroy() {
        if (controller != null) controller.unregisterCallback(callback);
        if (browser != null) browser.disconnect();
        if (closing != null) reply(closing, null);
        super.onDestroy();
    }
}
