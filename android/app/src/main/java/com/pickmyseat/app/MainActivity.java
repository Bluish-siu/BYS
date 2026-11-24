package com.pickmyseat.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

/**
 * PickMySeat for Android: the PickMySeat website in a full-screen WebView, so the app has every feature the site has
 * (3D hall, trailers, seat map, Razorpay test payments, tickets) and updates whenever the site is redeployed.
 */
public class MainActivity extends Activity {
    private static final int PAPER = Color.parseColor("#F3EEE5");
    private static final int INK = Color.parseColor("#16161A");
    private static final int BRAND = Color.parseColor("#FF5A36");

    private FrameLayout root;
    private WebView web;
    private WebView popup;          // window.open() pages, such as a bank page during a Razorpay payment
    private View offline;
    private ProgressBar progress;
    private View fullscreenView;    // a video playing full screen
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private boolean loadFailed;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        root = new FrameLayout(this);
        root.setBackgroundColor(PAPER);
        setContentView(root);
        keepClearOfSystemBars();

        web = newWebView();
        // Lets the site open Android's share sheet ("Share ticket" -> WhatsApp, Messages...). Main page only, not popups.
        web.addJavascriptInterface(new Bridge(), "PickMySeatApp");
        root.addView(web, match());

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(false);
        progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(BRAND));
        progress.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.TRANSPARENT));
        root.addView(progress, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP));

        offline = buildOfflineView();
        offline.setVisibility(View.GONE);
        root.addView(offline, match());

        if (state != null && web.restoreState(state) != null) return;
        web.loadUrl(BuildConfig.SITE_URL);
    }

    // ---------- WebView setup ----------

    @SuppressLint("SetJavaScriptEnabled")
    private WebView newWebView() {
        WebView w = new WebView(this);
        w.setBackgroundColor(PAPER);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                 // tickets and the booking are kept in localStorage
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); // trailers start on the 3D screen by themselves
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " PickMySeatApp/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(w, true); // Razorpay checkout runs in an iframe
        w.setWebViewClient(new Client());
        w.setWebChromeClient(new Chrome());
        // Any other download (for example the APK via a "download" link) goes to the phone's browser.
        w.setDownloadListener((url, ua, disposition, mime, length) -> {
            if (url.startsWith("http")) openOutside(Uri.parse(url));
            else toast("Use Save ticket to keep a copy of your ticket");
        });
        return w;
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return openOutside(request.getUrl());
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            if (view == web) loadFailed = false;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (view == web && !loadFailed) offline.setVisibility(View.GONE);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (view == web && request.isForMainFrame()) {
                loadFailed = true;
                offline.setVisibility(View.VISIBLE);
            }
        }
    }

    /** Web links stay in the app. upi:, tel:, mailto: and intent: links open the matching app (UPI apps, dialer...). */
    private boolean openOutside(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        // A new version of the app: let the phone's browser download it, so Android can install it.
        String path = uri.getPath() == null ? "" : uri.getPath().toLowerCase();
        if ((scheme.equals("https") || scheme.equals("http")) && path.endsWith(".apk")) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (ActivityNotFoundException e) { toast("No browser found to download the update"); }
            return true;
        }
        switch (scheme) {
            case "http": case "https": case "about": case "data": case "blob": case "javascript":
                return false;
        }
        try {
            Intent intent;
            if (scheme.equals("intent")) {
                intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME);
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
                intent.setComponent(null);
                intent.setSelector(null);
                try {
                    startActivity(intent);
                } catch (ActivityNotFoundException e) {
                    String fallback = intent.getStringExtra("browser_fallback_url");
                    if (fallback != null) web.loadUrl(fallback);
                    else toast("No app found to open this");
                }
                return true;
            }
            intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            toast(scheme.equals("upi") ? "No UPI app found on this phone" : "No app found to open this");
        } catch (Exception e) {
            toast("Couldn't open this link");
        }
        return true;
    }

    private class Chrome extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int p) {
            if (view != web) return;
            progress.setProgress(p);
            progress.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
        }

        // Full-screen video (the YouTube player's full-screen button)
        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            if (fullscreenView != null) { callback.onCustomViewHidden(); return; }
            fullscreenView = view;
            fullscreenCallback = callback;
            view.setBackgroundColor(Color.BLACK);
            root.addView(view, match());
            setSystemBarsHidden(true);
        }

        @Override
        public void onHideCustomView() {
            exitFullscreen();
        }

        // window.open(): shown on top of the app, closed by window.close() or Back
        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
            closePopup();
            popup = newWebView();
            root.addView(popup, match());
            ((WebView.WebViewTransport) resultMsg.obj).setWebView(popup);
            resultMsg.sendToTarget();
            return true;
        }

        @Override
        public void onCloseWindow(WebView window) {
            if (window == popup) closePopup();
        }

        // Only the camera, only for PickMySeat's own pages (the admin's ticket scanner). Everything else is refused.
        @Override
        public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> {
                Uri origin = request.getOrigin();
                String host = Uri.parse(BuildConfig.SITE_URL).getHost();
                boolean ours = origin != null && host != null && host.equals(origin.getHost());
                boolean camera = java.util.Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE);
                if (!ours || !camera) { request.deny(); return; }
                if (checkSelfPermission(android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
                } else {
                    pendingCamera = request;
                    requestPermissions(new String[] { android.Manifest.permission.CAMERA }, CAMERA_REQUEST);
                }
            });
        }
    }

    private static final int CAMERA_REQUEST = 7;
    private PermissionRequest pendingCamera;

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == STORAGE_REQUEST && pendingImage != null) {
            if (results.length > 0 && results[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) saveToGallery(pendingImage, pendingImageName);
            else toast("Allow storage to save tickets to the Gallery");
            pendingImage = null;
            return;
        }
        if (code != CAMERA_REQUEST || pendingCamera == null) return;
        if (results.length > 0 && results[0] == android.content.pm.PackageManager.PERMISSION_GRANTED)
            pendingCamera.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
        else
            pendingCamera.deny();
        pendingCamera = null;
    }

    private void exitFullscreen() {
        if (fullscreenView == null) return;
        root.removeView(fullscreenView);
        fullscreenView = null;
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null;
        setSystemBarsHidden(false);
    }

    private void closePopup() {
        if (popup == null) return;
        root.removeView(popup);
        popup.destroy();
        popup = null;
    }

    /** Called from the website as window.PickMySeatApp.share(title, text). */
    private class Bridge {
        @JavascriptInterface
        public void share(String title, String text) {
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_SUBJECT, title);
                send.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(send, "Share ticket"));
            });
        }

        /** Called as window.PickMySeatApp.saveImage(base64Png, fileName): saves a ticket to the Gallery. */
        @JavascriptInterface
        public void saveImage(String base64Png, String fileName) {
            byte[] png;
            try { png = android.util.Base64.decode(base64Png, android.util.Base64.DEFAULT); }
            catch (IllegalArgumentException e) { runOnUiThread(() -> toast("Couldn't save the ticket")); return; }
            String name = fileName.replaceAll("[^A-Za-z0-9._-]", "_");
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT < 29 && checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    pendingImage = png; pendingImageName = name;
                    requestPermissions(new String[] { android.Manifest.permission.WRITE_EXTERNAL_STORAGE }, STORAGE_REQUEST);
                } else {
                    saveToGallery(png, name);
                }
            });
        }
    }

    private static final int STORAGE_REQUEST = 8;
    private byte[] pendingImage;
    private String pendingImageName;

    /** Writes a PNG to Pictures/PickMySeat so it shows in the Gallery and opens without internet. */
    private void saveToGallery(byte[] png, String name) {
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                android.content.ContentValues v = new android.content.ContentValues();
                v.put(android.provider.MediaStore.Images.Media.DISPLAY_NAME, name);
                v.put(android.provider.MediaStore.Images.Media.MIME_TYPE, "image/png");
                v.put(android.provider.MediaStore.Images.Media.RELATIVE_PATH, "Pictures/PickMySeat");
                Uri uri = getContentResolver().insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new java.io.IOException("no gallery");
                try (java.io.OutputStream out = getContentResolver().openOutputStream(uri)) { out.write(png); }
            } else {
                java.io.File dir = new java.io.File(android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_PICTURES), "PickMySeat");
                if (!dir.exists() && !dir.mkdirs()) throw new java.io.IOException("no folder");
                java.io.File f = new java.io.File(dir, name);
                try (java.io.FileOutputStream out = new java.io.FileOutputStream(f)) { out.write(png); }
                android.media.MediaScannerConnection.scanFile(this, new String[] { f.getAbsolutePath() }, new String[] { "image/png" }, null);
            }
            toast("Ticket saved to Gallery › PickMySeat");
        } catch (Exception e) {
            toast("Couldn't save the ticket");
        }
    }

    // ---------- Screen layout ----------

    /** Android 15 draws apps under the status and navigation bars: pad the content so nothing hides behind them. */
    private void keepClearOfSystemBars() {
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int top, bottom, left, right;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                top = bars.top; left = bars.left; right = bars.right; bottom = Math.max(bars.bottom, ime.bottom);
            } else {
                top = insets.getSystemWindowInsetTop(); bottom = insets.getSystemWindowInsetBottom();
                left = insets.getSystemWindowInsetLeft(); right = insets.getSystemWindowInsetRight();
            }
            v.setPadding(left, top, right, bottom);
            return insets;
        });
    }

    @SuppressWarnings("deprecation")
    private void setSystemBarsHidden(boolean hidden) {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c == null) return;
            if (hidden) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            } else {
                c.show(WindowInsets.Type.systemBars());
            }
        } else {
            View d = getWindow().getDecorView();
            d.setSystemUiVisibility(hidden
                    ? View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
    }

    private View buildOfflineView() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(PAPER);
        box.setPadding(dp(32), dp(32), dp(32), dp(32));
        box.setClickable(true);

        TextView title = new TextView(this);
        title.setText("You're offline");
        title.setTextColor(INK);
        title.setTextSize(22);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        box.addView(title);

        TextView msg = new TextView(this);
        msg.setText("PickMySeat needs the internet to show movies, seats and payments. Check your connection and try again.");
        msg.setTextColor(Color.parseColor("#5B5A57"));
        msg.setTextSize(15);
        msg.setGravity(Gravity.CENTER);
        msg.setPadding(0, dp(10), 0, dp(22));
        box.addView(msg);

        Button retry = new Button(this);
        retry.setText("Try again");
        retry.setAllCaps(false);
        retry.setTextColor(Color.WHITE);
        retry.setTextSize(16);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(BRAND);
        bg.setCornerRadius(dp(12));
        retry.setBackground(bg);
        retry.setPadding(dp(28), 0, dp(28), 0);
        retry.setOnClickListener(v -> {
            String url = web.getUrl();
            if (url == null || url.startsWith("data:") || url.startsWith("about:")) web.loadUrl(BuildConfig.SITE_URL);
            else web.reload();
        });
        box.addView(retry, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(48)));
        return box;
    }

    // ---------- Lifecycle ----------

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (fullscreenView != null) { exitFullscreen(); return; }
        if (popup != null) {
            if (popup.canGoBack()) popup.goBack();
            else closePopup();
            return;
        }
        if (web.canGoBack()) { web.goBack(); return; }
        super.onBackPressed();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();                       // stops the trailer sound when the app goes to the background
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        closePopup();
        if (web != null) web.destroy();
        super.onDestroy();
    }

    // ---------- Helpers ----------

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private static FrameLayout.LayoutParams match() {
        return new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
    }

    private void toast(String text) {
        Toast.makeText(this, text, Toast.LENGTH_SHORT).show();
    }
}
