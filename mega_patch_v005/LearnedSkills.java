package com.mega.pet;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public final class LearnedSkills {
    private static final String FILE = "mega_learned_skills";
    private static final String SET = "skills";
    private LearnedSkills() {}

    private static String enc(String s) {
        return Base64.encodeToString(s.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
    }
    private static String dec(String s) {
        return new String(Base64.decode(s, Base64.NO_WRAP), StandardCharsets.UTF_8);
    }

    public static void teach(Context c, String trigger, String response) {
        trigger = normalize(trigger);
        response = response == null ? "" : response.trim();
        if (trigger.isEmpty() || response.isEmpty()) return;
        SharedPreferences p = c.getSharedPreferences(FILE, Context.MODE_PRIVATE);
        Set<String> copy = new HashSet<>(p.getStringSet(SET, new HashSet<>()));
        String prefix = enc(trigger) + "|";
        copy.removeIf(v -> v.startsWith(prefix));
        copy.add(prefix + enc(response));
        p.edit().putStringSet(SET, copy).apply();
    }

    public static String recall(Context c, String input) {
        String q = normalize(input);
        if (q.isEmpty()) return null;
        Set<String> all = c.getSharedPreferences(FILE, Context.MODE_PRIVATE).getStringSet(SET, new HashSet<>());
        String best = null;
        int bestLen = -1;
        for (String item : all) {
            int cut = item.indexOf('|');
            if (cut <= 0) continue;
            try {
                String trigger = dec(item.substring(0, cut));
                if ((q.equals(trigger) || q.contains(trigger)) && trigger.length() > bestLen) {
                    best = dec(item.substring(cut + 1));
                    bestLen = trigger.length();
                }
            } catch (Exception ignored) {}
        }
        return best;
    }

    public static int count(Context c) {
        return c.getSharedPreferences(FILE, Context.MODE_PRIVATE).getStringSet(SET, new HashSet<>()).size();
    }

    private static String normalize(String s) {
        if (s == null) return "";
        return s.toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
    }
}
