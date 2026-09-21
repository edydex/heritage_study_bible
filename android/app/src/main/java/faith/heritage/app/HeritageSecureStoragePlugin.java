package faith.heritage.app;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "HeritageSecureStorage")
public class HeritageSecureStoragePlugin extends Plugin {
    private static final String KEY_ALIAS = "heritage-secure-storage-v1";
    private static final String PREFERENCES = "heritage_secure_storage";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }

    private String requiredKey(PluginCall call) {
        String key = call.getString("key", "");
        if (!key.matches("[A-Za-z0-9._:-]{1,160}")) {
            call.reject("Invalid secure-storage key.");
            return null;
        }
        return key;
    }

    @PluginMethod
    public void get(PluginCall call) {
        String key = requiredKey(call);
        if (key == null) return;
        String encoded = preferences().getString(key, null);
        JSObject result = new JSObject();
        if (encoded == null) {
            result.put("value", (String) null);
            call.resolve(result);
            return;
        }
        try {
            String[] parts = encoded.split("\\.", 2);
            if (parts.length != 2) throw new IllegalArgumentException("Invalid stored value");
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP | Base64.URL_SAFE);
            byte[] ciphertext = Base64.decode(parts[1], Base64.NO_WRAP | Base64.URL_SAFE);
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
            cipher.updateAAD(key.getBytes(StandardCharsets.UTF_8));
            result.put("value", new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception error) {
            preferences().edit().remove(key).apply();
            call.reject("Secure storage could not be read.");
        }
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = requiredKey(call);
        if (key == null) return;
        String value = call.getString("value");
        if (value == null) {
            call.reject("Secure-storage value is required.");
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            cipher.updateAAD(key.getBytes(StandardCharsets.UTF_8));
            byte[] ciphertext = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            String encoded = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP | Base64.URL_SAFE)
                    + "." + Base64.encodeToString(ciphertext, Base64.NO_WRAP | Base64.URL_SAFE);
            preferences().edit().putString(key, encoded).apply();
            call.resolve();
        } catch (Exception error) {
            call.reject("Secure storage could not be written.");
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = requiredKey(call);
        if (key == null) return;
        preferences().edit().remove(key).apply();
        call.resolve();
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        KeyguardManager manager = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        if (manager == null || !manager.isDeviceSecure()) {
            JSObject result = new JSObject();
            result.put("supported", false);
            result.put("authenticated", true);
            call.resolve(result);
            return;
        }
        Intent intent = manager.createConfirmDeviceCredentialIntent(
                "Confirm it is you",
                call.getString("reason", "Confirm this account change"));
        if (intent == null) {
            call.reject("Device authentication is unavailable.");
            return;
        }
        startActivityForResult(call, intent, "deviceAuthenticationResult");
    }

    @ActivityCallback
    private void deviceAuthenticationResult(PluginCall call, ActivityResult result) {
        JSObject response = new JSObject();
        response.put("supported", true);
        response.put("authenticated", result.getResultCode() == android.app.Activity.RESULT_OK);
        call.resolve(response);
    }
}
