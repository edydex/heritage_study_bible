package faith.heritage.app;

import android.content.Context;
import android.util.AttributeSet;
import android.view.inputmethod.BaseInputConnection;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;

import com.getcapacitor.CapacitorWebView;

public class HeritageWebView extends CapacitorWebView {
    private BaseInputConnection searchInputConnection;

    public HeritageWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    public InputConnection onCreateInputConnection(EditorInfo outAttrs) {
        if (HeritageControlsPlugin.isSearchKeyboardCaptureInputEnabled()) {
            if (searchInputConnection == null) {
                searchInputConnection = new BaseInputConnection(this, false);
            }
            return searchInputConnection;
        }

        return super.onCreateInputConnection(outAttrs);
    }
}
