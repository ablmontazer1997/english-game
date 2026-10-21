package app.englishspell.game;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Matrix;
import android.graphics.drawable.Drawable;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.widget.FrameLayout;
import android.widget.ImageView;
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
    private int cutTopPx = 0;

    /** admin 6082: the S2 splash (picture + title ribbon) stays on top as a native view, placed exactly like the web
     *  splash (cover, focus 15% 40%; ribbon min(86vw, 380dp) wide at safe-top + max(22dp, 4.5vh)), until the page calls
     *  window.ESNative.splashUp() (0.2.6: the identical web splash is painted) or ready() (first screen painted, images
     *  decoded) or 25 s pass; then it fades out in 200 ms. */
    private FrameLayout boot;
    private ImageView bootArt, bootTitle;
    private boolean bootGone = false;

    private void showBoot(WebView wv) {
        boot = new FrameLayout(this);
        boot.setClickable(true);
        bootArt = new ImageView(this);
        bootArt.setImageResource(R.drawable.es_s2_art);
        bootArt.setScaleType(ImageView.ScaleType.MATRIX);
        bootTitle = new ImageView(this);
        bootTitle.setImageResource(R.drawable.es_s2_title);
        bootTitle.setScaleType(ImageView.ScaleType.FIT_XY);
        boot.addView(bootArt, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        boot.addView(bootTitle, new FrameLayout.LayoutParams(1, 1));
        boot.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> { if (r - l != or - ol || b - t != ob - ot) placeBoot(); });
        addContentView(boot, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        wv.addJavascriptInterface(new Object() {
            @JavascriptInterface public void ready() { runOnUiThread(() -> hideBoot()); }
            /** admin 6264 (0.2.6): the identical web splash (same picture + ribbon, plus the ring, progress bar and tips)
             *  is painted; it now holds until Home's 3D hero is fully shown, so the native picture hands over to it. */
            @JavascriptInterface public void splashUp() { runOnUiThread(() -> hideBoot()); }
        }, "ESNative");
        // safety only: the web splash goes by itself after 20 s at most; the native picture must never drop before it
        new Handler(Looper.getMainLooper()).postDelayed(this::hideBoot, 25000);
    }

    private void placeBoot() {
        if (boot == null || bootGone) return;
        int w = boot.getWidth(), h = boot.getHeight();
        if (w <= 0 || h <= 0) return;
        Drawable d = bootArt.getDrawable();
        float dw = d.getIntrinsicWidth(), dh = d.getIntrinsicHeight();
        float sc = Math.max(w / dw, h / dh);
        Matrix m = new Matrix();
        m.setScale(sc, sc);
        m.postTranslate((w - dw * sc) * 0.15f, (h - dh * sc) * 0.40f);
        bootArt.setImageMatrix(m);
        float dp = getResources().getDisplayMetrics().density;
        float tw = Math.min(0.86f * w, 380f * dp);          // the ribbon element's width (px)
        float s = tw / 380f;                                // the picture holds the 380-wide element + 30 px glow margin
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(Math.round(440f * s), Math.round(186f * s));
        lp.leftMargin = Math.round((w - tw) / 2f - 30f * s);
        lp.topMargin = Math.round(cutTopPx + Math.max(22f * dp, 0.045f * h) - 30f * s);
        bootTitle.setLayoutParams(lp);
    }

    private void hideBoot() {
        if (boot == null || bootGone) return;
        bootGone = true;
        final View b = boot;
        b.animate().alpha(0f).setDuration(200).withEndAction(() -> { ViewGroup p = (ViewGroup) b.getParent(); if (p != null) p.removeView(b); }).start();
    }

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
        // no white flash between the native splash and the first page paint: the WebView starts in the splash colour
        wv.setBackgroundColor(0xFF2B1166);
        WebSettings ws = wv.getSettings();
        ws.setMediaPlaybackRequiresUserGesture(false);
        // admin 5999: the phone's font size setting must not scale the game's text (it broke ribbons and reward cards)
        ws.setTextZoom(100);
        final float dp = getResources().getDisplayMetrics().density;
        ViewCompat.setOnApplyWindowInsetsListener(wv, (v, insets) -> {
            Insets c = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            if (c.top != cutTopPx) { cutTopPx = c.top; placeBoot(); }
            safeCss = "s.setProperty('--safe-top','" + Math.round(c.top / dp) + "px');s.setProperty('--safe-bottom','" + Math.round(c.bottom / dp)
                + "px');s.setProperty('--safe-left','" + Math.round(c.left / dp) + "px');s.setProperty('--safe-right','" + Math.round(c.right / dp) + "px');";
            pushSafe(wv);
            return insets;
        });
        immersive();
        showBoot(wv);
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
