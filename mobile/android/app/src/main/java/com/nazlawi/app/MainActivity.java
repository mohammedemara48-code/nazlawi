package com.nazlawi.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/**
 * Native shell for the Nazlawi web app (server URL comes from capacitor.config.ts / CAP_SERVER_URL).
 *
 * Handled by Capacitor itself (configured in capacitor.config.ts):
 *  - offline/unreachable server -> bundled assets/public/offline.html (server.errorPath)
 *  - links outside our host (wa.me / WhatsApp, maps, tel:, mailto:, other sites) -> opened with the matching app
 *    via an ACTION_VIEW intent (server.allowNavigation lists only our host)
 *  - <input type="file"> incl. capture -> system picker / camera (BridgeWebChromeClient; CAMERA permission in manifest)
 *  - splash screen, status bar, edge-to-edge insets (plugins)
 *
 * Added here: Android back button -> WebView history, pull-to-refresh, brand color behind the status bar.
 * Push notifications: see ANDROID.md ("Firebase push") — the @capacitor/push-notifications plugin is installed;
 * registration is started from the web app only when NEXT_PUBLIC_PUSH_ENABLED=1.
 */
public class MainActivity extends BridgeActivity {
    private static final int BRAND = Color.parseColor("#D4704A");
    private SwipeRefreshLayout swipe;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        final WebView webView = getBridge().getWebView();

        // Area behind the status bar (WebView is padded below it on edge-to-edge devices).
        if (webView.getParent() instanceof ViewGroup) {
            ((ViewGroup) webView.getParent()).setBackgroundColor(BRAND);
        }

        setupPullToRefresh(webView);

        // Back button: go back in the web history; at the first page, leave the app (standard Android behavior).
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });
    }

    /** Wraps the Capacitor WebView in a SwipeRefreshLayout; only triggers when the page is scrolled to the top. */
    private void setupPullToRefresh(final WebView webView) {
        ViewGroup parent = (ViewGroup) webView.getParent();
        if (parent == null) return;
        int index = parent.indexOfChild(webView);
        ViewGroup.LayoutParams params = webView.getLayoutParams();
        parent.removeView(webView);

        swipe = new SwipeRefreshLayout(this);
        swipe.setColorSchemeColors(BRAND);
        swipe.setProgressBackgroundColorSchemeColor(Color.parseColor("#FBF3EA"));
        swipe.addView(webView, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        parent.addView(swipe, index, params);

        swipe.setOnChildScrollUpCallback((p, child) -> webView.getScrollY() > 0 || webView.canScrollVertically(-1));
        swipe.setOnRefreshListener(webView::reload);
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView view) {
                if (swipe != null) swipe.setRefreshing(false);
            }
        });
    }
}
