package com.charpsdev.app;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Explicitly enable cookie acceptance for the WebView *before* the
        // Bridge/WebView is created (BridgeActivity's own onCreate() builds
        // the Bridge synchronously). Capacitor's Bridge.initWebView() does
        // NOT call CookieManager.setAcceptCookie()/setAcceptThirdPartyCookies()
        // itself, relying instead on Android's own WebView defaults, which
        // are inconsistent enough across OEM WebView builds/cold-launch
        // timing that this app's own login->cookie-write flow can race a
        // Next.js Link prefetch of a protected route (e.g. /services): if
        // that prefetch is evaluated by proxy.ts middleware before the
        // WebView's cookie jar has actually committed the freshly written
        // charpsdev_token cookie, it gets redirected to /login, and that
        // stale response can then surface on the user's very next real tap.
        // Explicitly forcing cookie acceptance on here removes one source of
        // that race. See also BottomNav.tsx / AppLayout.tsx's prefetch={false}
        // for the other half of the fix (avoiding the early prefetch itself).
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);

        super.onCreate(savedInstanceState);

        if (getBridge() != null && getBridge().getWebView() != null) {
            cookieManager.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
        }
    }
}
