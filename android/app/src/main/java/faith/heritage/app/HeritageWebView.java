package faith.heritage.app;

import android.content.Context;
import android.os.Build;
import android.util.AttributeSet;
import android.view.ActionMode;
import android.view.Menu;
import android.view.MenuItem;
import android.view.inputmethod.BaseInputConnection;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.webkit.WebSettings;

import com.getcapacitor.CapacitorWebView;

public class HeritageWebView extends CapacitorWebView {
    private static volatile boolean textSelectionMenuSuppressed = false;
    private BaseInputConnection searchInputConnection;

    public HeritageWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    public static void setTextSelectionMenuSuppressed(boolean suppressed) {
        textSelectionMenuSuppressed = suppressed;
    }

    public void applyTextSelectionMenuSuppressed(boolean suppressed) {
        setTextSelectionMenuSuppressed(suppressed);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            int disabledItems = suppressed
                ? WebSettings.MENU_ITEM_SHARE | WebSettings.MENU_ITEM_WEB_SEARCH | WebSettings.MENU_ITEM_PROCESS_TEXT
                : WebSettings.MENU_ITEM_NONE;
            getSettings().setDisabledActionModeMenuItems(disabledItems);
        }
    }

    private ActionMode.Callback suppressingSelectionCallback(ActionMode.Callback callback) {
        if (!textSelectionMenuSuppressed || callback instanceof SuppressingSelectionCallback) {
            return callback;
        }
        return new SuppressingSelectionCallback(callback);
    }

    @Override
    public ActionMode startActionMode(ActionMode.Callback callback) {
        return super.startActionMode(suppressingSelectionCallback(callback));
    }

    @Override
    public ActionMode startActionMode(ActionMode.Callback callback, int type) {
        return super.startActionMode(suppressingSelectionCallback(callback), type);
    }

    private static class SuppressingSelectionCallback implements ActionMode.Callback {
        private final ActionMode.Callback delegate;

        SuppressingSelectionCallback(ActionMode.Callback delegate) {
            this.delegate = delegate;
        }

        private void removeSystemActions(Menu menu) {
            if (menu != null) menu.clear();
        }

        @Override
        public boolean onCreateActionMode(ActionMode mode, Menu menu) {
            boolean created = delegate.onCreateActionMode(mode, menu);
            removeSystemActions(menu);
            return created;
        }

        @Override
        public boolean onPrepareActionMode(ActionMode mode, Menu menu) {
            delegate.onPrepareActionMode(mode, menu);
            removeSystemActions(menu);
            return true;
        }

        @Override
        public boolean onActionItemClicked(ActionMode mode, MenuItem item) {
            return delegate.onActionItemClicked(mode, item);
        }

        @Override
        public void onDestroyActionMode(ActionMode mode) {
            delegate.onDestroyActionMode(mode);
        }
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
