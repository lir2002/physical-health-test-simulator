package com.physicalhealth.testsim;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(name = "NativeSpeech")
public class NativeSpeechPlugin extends Plugin implements TextToSpeech.OnInitListener {
    private static final String TAG = "NativeSpeech";

    private TextToSpeech textToSpeech;
    private boolean ready = false;
    private boolean hasEngine = false;
    private PluginCall pendingSpeakCall;
    private String pendingText;
    private float pendingRate = 1.0f;

    @Override
    public void load() {
        hasEngine = hasTextToSpeechEngine();
        if (!hasEngine) {
            Log.w(TAG, "No Android TextToSpeech engine is installed");
            return;
        }

        textToSpeech = new TextToSpeech(getContext(), this);
    }

    @Override
    public void onInit(int status) {
        ready = status == TextToSpeech.SUCCESS;
        if (ready) {
            int languageResult = textToSpeech.setLanguage(Locale.CHINA);
            if (languageResult == TextToSpeech.LANG_MISSING_DATA
                    || languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                Log.w(TAG, "zh-CN TTS data missing or unsupported, trying default Chinese locale");
                languageResult = textToSpeech.setLanguage(Locale.CHINESE);
            }

            if (languageResult == TextToSpeech.LANG_MISSING_DATA
                    || languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                Log.w(TAG, "Chinese TTS data missing or unsupported, falling back to system default locale");
                textToSpeech.setLanguage(Locale.getDefault());
            }
        } else {
            Log.e(TAG, "TextToSpeech initialization failed with status " + status);
        }

        if (pendingSpeakCall != null) {
            PluginCall call = pendingSpeakCall;
            String text = pendingText;
            float rate = pendingRate;
            pendingSpeakCall = null;
            pendingText = null;

            if (ready) {
                speakNow(call, text, rate);
            } else {
                call.reject("Android TextToSpeech initialization failed");
            }
        }
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        Double requestedRate = call.getDouble("rate", 1.0);
        float rate = requestedRate == null ? 1.0f : requestedRate.floatValue();

        if (text == null || text.trim().isEmpty()) {
            call.resolve();
            return;
        }

        if (!hasEngine) {
            call.reject("No Android TextToSpeech engine is installed");
            return;
        }

        if (textToSpeech == null) {
            pendingSpeakCall = call;
            pendingText = text;
            pendingRate = rate;
            textToSpeech = new TextToSpeech(getContext(), this);
            return;
        }

        if (!ready) {
            if (pendingSpeakCall != null) {
                pendingSpeakCall.reject("Replaced by a newer speech request");
            }
            pendingSpeakCall = call;
            pendingText = text;
            pendingRate = rate;
            return;
        }

        speakNow(call, text, rate);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (textToSpeech != null) {
            textToSpeech.stop();
        }
        call.resolve();
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", hasTextToSpeechEngine());
        ret.put("ready", ready);
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent("com.android.settings.TTS_SETTINGS");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            intent = new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        }

        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            intent = new Intent(Settings.ACTION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        }

        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Unable to open TextToSpeech settings", e);
        }
    }

    private void speakNow(PluginCall call, String text, float rate) {
        textToSpeech.stop();
        textToSpeech.setSpeechRate(Math.max(0.5f, Math.min(rate, 2.0f)));
        textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, UUID.randomUUID().toString());
        call.resolve();
    }

    private boolean hasTextToSpeechEngine() {
        Intent intent = new Intent(TextToSpeech.Engine.INTENT_ACTION_TTS_SERVICE);
        PackageManager packageManager = getContext().getPackageManager();
        List<ResolveInfo> services = packageManager.queryIntentServices(intent, PackageManager.MATCH_DEFAULT_ONLY);
        return services != null && !services.isEmpty();
    }

    @Override
    protected void handleOnDestroy() {
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
        super.handleOnDestroy();
    }
}
