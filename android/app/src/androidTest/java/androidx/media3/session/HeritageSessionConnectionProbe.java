package androidx.media3.session;

import androidx.media3.common.MediaItem;
import androidx.media3.common.util.UnstableApi;
import com.google.common.util.concurrent.ListenableFuture;

/** Test-only access to the actual live service callback, not a substitute session. */
@UnstableApi
public final class HeritageSessionConnectionProbe {
    private HeritageSessionConnectionProbe() { }

    public static ListenableFuture<MediaSession.ConnectionResult> connect(
            MediaSession.ControllerInfo controller, String expectedTrackId) {
        MediaSession session = MediaSession.getSession(MediaSessionImpl.createSessionUri(null));
        if (session == null) throw new IllegalStateException("The live Heritage service session is missing");
        MediaItem current = session.getPlayer().getCurrentMediaItem();
        if (current == null || !expectedTrackId.equals(current.mediaId)) {
            throw new IllegalStateException("The connection probe did not find the seeded service player");
        }
        return session.getImpl().onConnectOnHandler(controller);
    }
}
