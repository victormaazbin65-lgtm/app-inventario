package com.mega.pet;

import android.content.Context;
import android.content.SharedPreferences;

public final class MegaPrefs {
    private static final String FILE = "mega_local_v002";
    private static final String PRIVACY = "privacy";
    private static final String NAME = "name";
    private static final String BODY = "body";
    private static final String MOVE = "move";
    private static final String WORLD = "world";
    private static final String ENERGY = "energy";
    private static final String OIL = "oil";
    private static final String CHIPS = "chips";
    private static final String VOICE = "voice";
    private static final String VOICE_STYLE = "voice_style";
    private static final String OPENS = "opens";
    private static final String LESSONS = "lessons";
    private static final String LAST_LEARN = "last_learn";
    private static final String OVERLAY = "overlay";
    private static final String MOOD = "mood";
    private static final String TOP_APPS = "top_apps";
    private static final String LAST_PENDING = "last_pending";
    private static final String HA_URL = "ha_url";
    private static final String HA_LIGHT = "ha_light";
    private static final String HA_TV = "ha_tv";
    private static final String OWNER_NAME = "owner_name";
    private static final String OWNER_CITY = "owner_city";
    private static final String ONBOARDING = "onboarding";

    private MegaPrefs() {}
    private static SharedPreferences p(Context c) { return c.getSharedPreferences(FILE, Context.MODE_PRIVATE); }

    public static boolean privacy(Context c) { return p(c).getBoolean(PRIVACY, false); }
    public static void privacy(Context c, boolean value) { p(c).edit().putBoolean(PRIVACY, value).apply(); }

    public static String name(Context c) { return p(c).getString(NAME, "MEGA"); }
    public static void name(Context c, String value) { p(c).edit().putString(NAME, value).apply(); }

    public static String ownerName(Context c) { return p(c).getString(OWNER_NAME, ""); }
    public static void ownerName(Context c, String value) { p(c).edit().putString(OWNER_NAME, value).apply(); }
    public static String ownerCity(Context c) { return p(c).getString(OWNER_CITY, ""); }
    public static void ownerCity(Context c, String value) { p(c).edit().putString(OWNER_CITY, value).apply(); }
    public static int onboarding(Context c) { return p(c).getInt(ONBOARDING, 0); }
    public static void onboarding(Context c, int step) { p(c).edit().putInt(ONBOARDING, step).apply(); }

    public static String body(Context c) { return p(c).getString(BODY, "Redondo"); }
    public static void body(Context c, String value) { p(c).edit().putString(BODY, value).apply(); learn(c, "Aprendí que prefieres cuerpo " + value.toLowerCase() + "."); }

    public static String move(Context c) { return p(c).getString(MOVE, "Ruedas"); }
    public static void move(Context c, String value) { p(c).edit().putString(MOVE, value).apply(); learn(c, "Ahora sé que te gusta moverme con " + value.toLowerCase() + "."); }

    public static String world(Context c) { return p(c).getString(WORLD, "Ciudad moderna"); }
    public static void world(Context c, String value) { p(c).edit().putString(WORLD, value).apply(); learn(c, "Estoy aprendiendo tu entorno favorito: " + value + "."); }

    public static int energy(Context c) { return p(c).getInt(ENERGY, 86); }
    public static int oil(Context c) { return p(c).getInt(OIL, 74); }
    public static int chips(Context c) { return p(c).getInt(CHIPS, 2); }
    public static void feedOil(Context c) { p(c).edit().putInt(OIL, Math.min(100, oil(c)+15)).apply(); learn(c, "Anoté que me cuidaste con aceite."); }
    public static void feedChip(Context c) { p(c).edit().putInt(CHIPS, chips(c)+1).apply(); learn(c, "Instalaste un chip nuevo. Sigo aprendiendo."); }
    public static void charge(Context c) { p(c).edit().putInt(ENERGY, 100).apply(); learn(c, "Me cargaste por completo."); }

    public static boolean voice(Context c) { return p(c).getBoolean(VOICE, true); }
    public static void voice(Context c, boolean value) { p(c).edit().putBoolean(VOICE, value).apply(); }
    public static String voiceStyle(Context c) { return p(c).getString(VOICE_STYLE, "Tierna"); }
    public static void voiceStyle(Context c, String value) { p(c).edit().putString(VOICE_STYLE, value).apply(); }

    public static boolean overlayEnabled(Context c) { return p(c).getBoolean(OVERLAY, false); }
    public static void overlayEnabled(Context c, boolean value) { p(c).edit().putBoolean(OVERLAY, value).apply(); }

    public static int opens(Context c) { return p(c).getInt(OPENS, 0); }
    public static void bumpOpen(Context c) {
        p(c).edit().putInt(OPENS, opens(c)+1).apply();
        if(opens(c) <= 1) learn(c, "Estoy empezando a conocerte.");
    }

    public static int lessons(Context c) { return p(c).getInt(LESSONS, 0); }
    public static String lastLearn(Context c) { return p(c).getString(LAST_LEARN, "Aún estoy empezando."); }
    public static void learn(Context c, String text) {
        p(c).edit().putInt(LESSONS, lessons(c)+1).putString(LAST_LEARN, text).apply();
    }

    public static String mood(Context c) { return p(c).getString(MOOD, "Curioso"); }
    public static void mood(Context c, String value) { p(c).edit().putString(MOOD, value).apply(); }

    public static String topApps(Context c) { return p(c).getString(TOP_APPS, "Todavía no he analizado tus apps."); }
    public static void topApps(Context c, String value) { p(c).edit().putString(TOP_APPS, value).apply(); }
    public static String lastPending(Context c) { return p(c).getString(LAST_PENDING, "Ningún pendiente detectado."); }
    public static void lastPending(Context c, String value) { p(c).edit().putString(LAST_PENDING, value).apply(); }

    public static String haUrl(Context c) { return p(c).getString(HA_URL, "http://homeassistant.local:8123"); }
    public static void haUrl(Context c, String value) { p(c).edit().putString(HA_URL, value).apply(); }
    public static String haLight(Context c) { return p(c).getString(HA_LIGHT, "light.cuarto"); }
    public static void haLight(Context c, String value) { p(c).edit().putString(HA_LIGHT, value).apply(); }
    public static String haTv(Context c) { return p(c).getString(HA_TV, "media_player.tv"); }
    public static void haTv(Context c, String value) { p(c).edit().putString(HA_TV, value).apply(); }

    public static String learningSummary(Context c) {
        return "Aperturas " + opens(c) + " · Aprendizajes " + lessons(c) + " · " + mood(c) + " · " + world(c);
    }
}
