package app.englishspell.game;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;

import java.util.Map;
import java.util.regex.Pattern;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * English Spell (admin 5935/5949): the whole game is bundled in the APK (tools/build_android.sh) and served from
 * https://localhost with the live site paths; only the API is remote (https://bingual.app/runecast-api).
 * Fullscreen (immersive), portrait (manifest), sound without a tap, the hardware back button goes
 * through the game's window.__esBack() first, and englishspell://login?code=... signs the app in.
 */
public class MainActivity extends BridgeActivity {

    /** The hero page shares these folders with the wardrobe; the APK keeps one copy (/runecast-wardrobe/...). */
    static final Pattern SHARED = Pattern.compile("^/runecast-hero/(baked|light|light_f08|fabric|hdri|wands|eyes|mouth)/");

    /** 0.2.1 (admin 5999): the page draws edge to edge (no purple band in the cutout); the cutout size is handed to
     *  the page as --safe-top/left/right/bottom (CSS px), which the app already uses for its safe areas. */
    private String safeCss = "";

    private void pushSafe(WebView wv) {
        if (safeCss.isEmpty()) return;
        wv.evaluateJavascript("(function(){var s=document.documentElement&&document.documentElement.style;if(!s)return;" + safeCss + "})()", null);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30
                ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String path = u.getPath();
                if (path != null && "localhost".equals(u.getHost()) && SHARED.matcher(path).find()) {
                    final Uri to = u.buildUpon().path(path.replaceFirst("^/runecast-hero/", "/runecast-wardrobe/")).build();
                    return super.shouldInterceptRequest(view, new WebResourceRequest() {
                        public Uri getUrl() { return to; }
                        public boolean isForMainFrame() { return req.isForMainFrame(); }
                        public boolean isRedirect() { return android.os.Build.VERSION.SDK_INT >= 24 && req.isRedirect(); }
                        public boolean hasGesture() { return req.hasGesture(); }
                        public String getMethod() { return req.getMethod(); }
                        public Map<String, String> getRequestHeaders() { return req.getRequestHeaders(); }
                    });
                }
                return super.shouldInterceptRequest(view, req);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                pushSafe(view);
            }
        });
        WebView wv = getBridge().getWebView();
        WebSettings ws = wv.getSettings();
        ws.setMediaPlaybackRequiresUserGesture(false);
        // admin 5999: the phone's font size setting must not scale the game's text (it broke ribbons and reward cards)
        ws.setTextZoom(100);
        final float dp = getResources().getDisplayMetrics().density;
        ViewCompat.setOnApplyWindowInsetsListener(wv, (v, insets) -> {
            Insets c = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            safeCss = "s.setProperty('--safe-top','" + Math.round(c.top / dp) + "px');s.setProperty('--safe-bottom','" + Math.round(c.bottom / dp)
                + "px');s.setProperty('--safe-left','" + Math.round(c.left / dp) + "px');s.setProperty('--safe-right','" + Math.round(c.right / dp) + "px');";
            pushSafe(wv);
            return insets;
        });
        immersive();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                onBack();
            }
        });
        openLogin(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openLogin(intent);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    private void immersive() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }

    /** englishspell://login?code=<single-use code> -> https://bingual.app/runecast/?login=<code> */
    private void openLogin(Intent intent) {
        if (intent == null) return;
        Uri u = intent.getData();
        if (u == null || !"englishspell".equals(u.getScheme()) || !"login".equals(u.getHost())) return;
        String code = u.getQueryParameter("code");
        if (code == null || !code.matches("[A-Za-z0-9_-]{16,128}")) return;
        final String url = getBridge().getLocalUrl() + "/runecast/index.html?login=" + code;
        final WebView wv = getBridge().getWebView();
        wv.post(() -> wv.loadUrl(url));
    }

    private void onBack() {
        final WebView wv = getBridge().getWebView();
        wv.evaluateJavascript("(function(){try{return window.__esBack&&window.__esBack()?1:0}catch(e){return 0}})()", v -> {
            if ("1".equals(v)) return;
            if (wv.canGoBack()) wv.goBack();
            else finish();
        });
    }
}
