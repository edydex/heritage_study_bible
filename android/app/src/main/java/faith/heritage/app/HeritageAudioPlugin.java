package faith.heritage.app;

import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.session.MediaBrowser;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionCommand;
import androidx.media3.session.SessionResult;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.concurrent.Executor;
import java.util.function.Consumer;

/** An app controller only: releasing the WebView never releases the service player. */
@UnstableApi
@CapacitorPlugin(name = "HeritageAudio")
public class HeritageAudioPlugin extends Plugin {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Executor main = command -> handler.post(command);
    private ListenableFuture<MediaBrowser> connecting;
    private MediaBrowser controller;
    private boolean destroyed, foreground = true;
    private String boundaryTrack;
    private PlaybackBoundaries boundaries;
    private long boundaryGeneration;
    private final Runnable boundaryTick = new Runnable() { public void run() {
        if (destroyed || !foreground || boundaries == null || controller == null || !controller.isConnected()) return;
        if (controller.getCurrentMediaItem() == null || !controller.getCurrentMediaItem().mediaId.equals(boundaryTrack)) return;
        long generation = boundaryGeneration;
        Bundle args = new Bundle(); args.putString("action", "state");
        send(args, null, state -> {
            if (destroyed || !foreground || generation != boundaryGeneration || boundaries == null) return;
            if (!boundaryTrack.equals(state.optString("trackId")) || !"playing".equals(state.optString("status"))) return;
            // Schedule from the SAME service snapshot sent to the reader.
            // MediaController extrapolates its position and can cross a boundary
            // before ExoPlayer; treating that estimate as final loses the wake-up.
            long position = (long) Math.floor(state.optDouble("position", 0) * 1000);
            long delay = boundaries.delayMs(position, (float) state.optDouble("rate", 1));
            handler.postDelayed(this, delay >= 0 ? delay : 1000);
        });
    }};
    private void refreshBoundaries() {
        boundaryGeneration++;
        handler.removeCallbacks(boundaryTick);
        if (foreground && !destroyed && boundaries != null) handler.post(boundaryTick);
    }
    private final Runnable tick = new Runnable() { public void run() {
        if (destroyed || !foreground) return;
        if (controller != null && (controller.isPlaying() || controller.getPlayWhenReady())) requestState();
        handler.postDelayed(this, 1000);
    }};
    private final Player.Listener events = new Player.Listener() {
        @Override public void onEvents(Player player, Player.Events events) {
            if (foreground) { requestState(); refreshBoundaries(); }
        }
    };
    private void connect(Runnable ready, PluginCall call) {
        if (destroyed) { if (call != null) call.reject("Audio controller closed"); return; }
        if (controller != null && !controller.isConnected()) {
            controller.removeListener(events);
            if (connecting != null) MediaController.releaseFuture(connecting);
            controller = null; connecting = null;
        }
        if (controller != null && controller.isConnected()) { ready.run(); return; }
        if (connecting == null) {
            SessionToken token = new SessionToken(getContext(), new ComponentName(getContext(), HeritagePlaybackService.class));
            connecting = new MediaBrowser.Builder(getContext(), token).buildAsync();
            connecting.addListener(() -> {
                if (destroyed) return;
                try {
                    controller = connecting.get();
                    controller.addListener(events);
                    handler.removeCallbacks(tick); handler.post(tick);
                    refreshBoundaries();
                } catch (Exception ignored) { connecting = null; }
            }, main);
        }
        ListenableFuture<MediaBrowser> pending = connecting;
        if (pending == null) { if (call != null) call.reject("Could not connect to Android audio"); return; }
        pending.addListener(() -> {
            if (destroyed) return;
            try { controller = pending.get(); ready.run(); }
            catch (Exception error) { connecting = null; if (call != null) call.reject("Could not connect to Android audio"); }
        }, main);
    }
    private void send(Bundle args, PluginCall call) {
        send(args, call, null);
    }
    private void send(Bundle args, PluginCall call, Consumer<JSObject> received) {
        if (controller == null || !controller.isConnected()) { if (call != null) call.reject("Audio disconnected"); return; }
        ListenableFuture<SessionResult> result = controller.sendCustomCommand(new SessionCommand(HeritagePlaybackService.COMMAND, Bundle.EMPTY), args);
        result.addListener(() -> {
            if (destroyed) return;
            try {
                SessionResult response = result.get();
                if (response.resultCode != SessionResult.RESULT_SUCCESS) { if (call != null) call.reject("Android audio rejected this request"); return; }
                JSObject state = new JSObject(response.extras.getString("state", "{}"));
                notifyListeners("state", state);
                if (call != null) call.resolve(state);
                if (received != null) received.accept(state);
            } catch (Exception error) { if (call != null) call.reject("Could not read Android audio state"); }
        }, main);
    }
    private void requestState() { Bundle args = new Bundle(); args.putString("action", "state"); send(args, null); }
    private void openFromIntent(Intent intent) {
        if (intent != null && "faith.heritage.app.OPEN_AUDIO".equals(intent.getAction())
            && !intent.getBooleanExtra("heritage.audio.openHandled", false)) {
            // Keep the launch intent's identity stable for lifecycle restoration.
            intent.putExtra("heritage.audio.openHandled", true);
            notifyListeners("openLibrary", new JSObject(), true);
        }
    }
    @Override public void load() { openFromIntent(getActivity().getIntent()); }
    @Override protected void handleOnNewIntent(Intent intent) { openFromIntent(intent); }
    @PluginMethod public void watchPositions(PluginCall call) {
        try {
            JSArray values = call.getArray("positions", new JSArray());
            if (values.length() > 1000) throw new IllegalArgumentException("Too many playback boundaries");
            double[] seconds = new double[values.length()];
            for (int i = 0; i < seconds.length; i++) seconds[i] = values.getDouble(i);
            PlaybackBoundaries next = seconds.length == 0 ? null : new PlaybackBoundaries(seconds);
            String track = call.getString("trackId");
            if (next != null && (track == null || track.length() > 128)) throw new IllegalArgumentException("Missing playback track");
            handler.post(() -> {
                if (destroyed) { call.reject("Audio controller closed"); return; }
                boundaryTrack = track; boundaries = next;
                refreshBoundaries(); call.resolve();
            });
        } catch (Exception error) { call.reject("Invalid playback boundaries"); }
    }
    @PluginMethod public void command(PluginCall call) {
        Bundle args = new Bundle();
        args.putString("action", call.getString("action", "state"));
        String id = call.getString("trackId"); if (id != null) args.putString("trackId", id);
        args.putBoolean("restart", call.getBoolean("restart", false));
        args.putDouble("position", call.getDouble("position", 0d));
        args.putDouble("rate", call.getDouble("rate", 1d));
        args.putInt("direction", call.getInt("direction", 1));
        handler.post(() -> connect(() -> send(args, call), call));
    }
    @Override protected void handleOnPause() { foreground = false; boundaryGeneration++; handler.removeCallbacks(tick); handler.removeCallbacks(boundaryTick); }
    @Override protected void handleOnResume() {
        foreground = true;
        handler.post(() -> { if (controller != null) requestState(); handler.removeCallbacks(tick); handler.post(tick); refreshBoundaries(); });
    }
    @Override protected void handleOnDestroy() {
        destroyed = true; handler.removeCallbacksAndMessages(null);
        if (controller != null) controller.removeListener(events);
        if (connecting != null) MediaController.releaseFuture(connecting);
        controller = null; connecting = null;
    }
}
