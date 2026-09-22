package faith.heritage.app;

import android.content.Context;
import android.net.Uri;
import androidx.media3.datasource.*;
import java.io.IOException;
import java.util.*;

/** Resolves private chapter media IDs on ExoPlayer's worker, including while
 * backgrounded. Public audio keeps the standard HTTP data source. */
final class CommunityAudioDataSource implements DataSource {
    private final Context context;
    private final HeritageAudioCatalog catalog;
    private final DataSource http = new DefaultHttpDataSource.Factory().createDataSource();
    private final DataSource file = new FileDataSource();
    private DataSource selected;
    CommunityAudioDataSource(Context context, HeritageAudioCatalog catalog) { this.context = context; this.catalog = catalog; }
    @Override public void addTransferListener(TransferListener listener) { http.addTransferListener(listener); file.addTransferListener(listener); }
    @Override public long open(DataSpec spec) throws IOException {
        if (!"heritage-book".equals(spec.uri.getScheme())) { selected = http; return selected.open(spec); }
        HeritageAudioCatalog.Track track = catalog.track(spec.uri.getLastPathSegment());
        if (track == null || track.community == null) throw new IOException("Unknown Community chapter");
        java.io.File source = CommunityAudioStore.prepare(context, track);
        selected = file;
        return selected.open(spec.buildUpon().setUri(Uri.fromFile(source)).build());
    }
    @Override public int read(byte[] buffer, int offset, int length) throws IOException { return selected.read(buffer, offset, length); }
    @Override public Uri getUri() { return selected == null ? null : selected.getUri(); }
    @Override public Map<String, List<String>> getResponseHeaders() { return selected == null ? Collections.emptyMap() : selected.getResponseHeaders(); }
    @Override public void close() throws IOException { if (selected != null) selected.close(); selected = null; }
}
