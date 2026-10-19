package app.englishspell.game;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;

import java.util.Map;
import java.util.regex.Pattern;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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
        });
        WebView wv = getBridge().getWebView();
        WebSettings ws = wv.getSettings();
        ws.setMediaPlaybackRequiresUserGesture(false);
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
