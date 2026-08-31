package com.mega.pet;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.*;
import android.os.*;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
import android.widget.*;
import java.util.*;
import java.util.regex.*;

public class MainActivity extends Activity implements TextToSpeech.OnInitListener {
    private Mega3DView robot;
    private TextView bubble, status;
    private EditText input;
    private TextToSpeech tts;
    private boolean ttsReady;
    private static final int VOICE_REQ = 44;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String typing = "";
    private int typingPos = 0;
    private long lastAutonomousLine = 0;

    private final Runnable typer = new Runnable() {
        @Override public void run() {
            if (typingPos < typing.length()) {
                bubble.setText(typing.substring(0, ++typingPos));
                handler.postDelayed(this, 18);
            }
        }
    };

    private final Runnable autonomy = new Runnable() {
        @Override public void run() {
            autonomousThought();
            handler.postDelayed(this, 45000);
        }
    };

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        MegaPrefs.bumpOpen(this);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);
        }
        tts = new TextToSpeech(this, this);
        buildUi();
        if (MegaPrefs.onboarding(this) < 2) askNextQuestion(); else greet();
        handler.postDelayed(autonomy, 12000);
    }

    @Override protected void onResume() {
        super.onResume();
        if (robot != null) robot.onResume();
        refreshStatus();
    }

    @Override protected void onPause() {
        if (robot != null) robot.onPause();
        super.onPause();
    }

    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (tts != null) { tts.stop(); tts.shutdown(); }
        super.onDestroy();
    }

    @Override public void onInit(int result) {
        ttsReady = result == TextToSpeech.SUCCESS;
        applyVoice();
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(4,7,12));
        root.setPadding(22,24,22,20);

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        titles.addView(label("MEGA", 28, true, Color.WHITE));
        titles.addView(label("compañero virtual · curioso · aprendiendo", 12, false, Color.rgb(100,220,255)));
        Button settings = button("Opciones");
        settings.setOnClickListener(v -> showOptions());
        top.addView(titles, new LinearLayout.LayoutParams(0, -2, 1));
        top.addView(settings);
        root.addView(top);

        status = label("", 12, false, Color.rgb(180,215,235));
        root.addView(status);

        FrameLayout stage = new FrameLayout(this);
        robot = new Mega3DView(this);
        robot.setRobot(MegaPrefs.body(this), MegaPrefs.move(this));
        robot.setWorld(MegaPrefs.world(this));
        robot.setMood(MegaPrefs.mood(this));
        stage.addView(robot, new FrameLayout.LayoutParams(-1, 820));

        bubble = label("", 16, true, Color.WHITE);
        bubble.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        bubble.setGravity(Gravity.CENTER);
        bubble.setBackgroundColor(0xB20A111A);
        bubble.setPadding(22,16,22,16);
        FrameLayout.LayoutParams bp = new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM);
        bp.setMargins(16,0,16,18);
        stage.addView(bubble, bp);
        root.addView(stage, new LinearLayout.LayoutParams(-1, 820));

        input = new EditText(this);
        input.setSingleLine(false);
        input.setMaxLines(3);
        input.setHint("Escríbele a MEGA…");
        input.setTextColor(Color.WHITE);
        input.setHintTextColor(Color.GRAY);
        root.addView(input, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout actions = new LinearLayout(this);
        Button talk = button("🎙 Hablar");
        Button send = button("Enviar");
        Button floating = button("📱 Pantalla");
        talk.setOnClickListener(v -> voiceInput());
        send.setOnClickListener(v -> sendTyped());
        floating.setOnClickListener(v -> startOverlay());
        actions.addView(talk, new LinearLayout.LayoutParams(0, -2, 1));
        actions.addView(send, new LinearLayout.LayoutParams(0, -2, 1));
        actions.addView(floating, new LinearLayout.LayoutParams(0, -2, 1));
        root.addView(actions);

        TextView help = label("Puedes decir: “MEGA aprende que modo cine significa apaga la TV”, “recuérdame llamar a las 8”, “¿tengo internet?”", 11, false, Color.LTGRAY);
        root.addView(help);

        setContentView(root);
        MegaNotifier.showControlNotification(this);
        refreshStatus();
    }

    private TextView label(String s, int size, boolean bold, int color) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(size); t.setTextColor(color); t.setPadding(0,8,0,8);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }
    private Button button(String s) { Button b = new Button(this); b.setAllCaps(false); b.setText(s); return b; }

    private void sendTyped() {
        String s = input.getText().toString().trim();
        if (s.isEmpty()) return;
        input.setText("");
        process(s, false);
    }

    private void greet() {
        String owner = MegaPrefs.ownerName(this);
        say(owner.isEmpty() ? "Hola. Estoy listo para conocerte." : "¡Hola " + owner + "! Me alegra verte otra vez.", "Cariño");
    }

    private void askNextQuestion() {
        int step = MegaPrefs.onboarding(this);
        if (step == 0) say("Hola… acabo de despertar. ¿Cómo quieres que te llame a ti?", "Curioso");
        else if (step == 1) say("Mucho gusto. ¿En qué ciudad o lugar vives?", "Curioso");
    }

    private void process(String raw, boolean fromMemory) {
        String q = raw.trim();
        String lower = q.toLowerCase(Locale.ROOT);

        if (MegaPrefs.onboarding(this) == 0) {
            MegaPrefs.ownerName(this, q);
            MegaPrefs.onboarding(this, 1);
            MegaPrefs.learn(this, "Aprendí cómo llamarte: " + q);
            say("Mucho gusto, " + q + ". ¿En qué ciudad o lugar vives?", "Feliz");
            return;
        }
        if (MegaPrefs.onboarding(this) == 1) {
            MegaPrefs.ownerCity(this, q);
            MegaPrefs.onboarding(this, 2);
            MegaPrefs.learn(this, "Aprendí dónde vives: " + q);
            say("Entonces vives en " + q + ". Quiero conocer mejor tu mundo.", "Curioso");
            return;
        }

        Matcher teach = Pattern.compile("(?i)(?:mega\\s+)?aprende\\s+que\\s+(.+?)\\s+significa\\s+(.+)").matcher(q);
        if (teach.find()) {
            String trigger = teach.group(1).trim();
            String result = teach.group(2).trim();
            LearnedSkills.teach(this, trigger, result);
            MegaPrefs.learn(this, "Aprendí que '" + trigger + "' significa '" + result + "'.");
            say("¡Lo aprendí! Cuando digas “" + trigger + "”, intentaré hacer “" + result + "”.", "Feliz");
            return;
        }
        if (lower.startsWith("mega aprende") || lower.startsWith("aprende esto")) {
            String fact = q.replaceFirst("(?i)^(mega\\s+)?aprende(\\s+esto)?[: ]*", "").trim();
            if (fact.isEmpty()) fact = q;
            MegaPrefs.learn(this, fact);
            say("Lo guardaré como algo que me enseñaste.", "Feliz");
            return;
        }

        if (!fromMemory) {
            String learned = LearnedSkills.recall(this, q);
            if (learned != null && !learned.equalsIgnoreCase(q)) {
                say("¡Esto lo aprendí contigo!", "Feliz");
                handler.postDelayed(() -> process(learned, true), 900);
                return;
            }
        }

        if (lower.contains("recuérdame") || lower.contains("recordame")) {
            scheduleReminder(q, parseWhen(lower));
            return;
        }

        if (isHomeCommand(lower)) {
            SmartHomeManager.execute(this, q, (ok, msg) -> say(msg, ok ? "Feliz" : "Serio"));
            return;
        }

        if (lower.contains("internet") || lower.contains("wifi") || lower.contains("conexión") || lower.contains("conexion")) {
            say(hasInternet() ? "Sí. Ahora tienes conexión a internet." : "Ahora mismo no detecto internet ni wifi.", hasInternet() ? "Feliz" : "Serio");
            return;
        }

        if (lower.contains("batería") || lower.contains("bateria")) {
            int p = batteryPct();
            say(p < 0 ? "No pude leer la batería." : "Tu batería está en " + p + " por ciento.", p > 20 ? "Curioso" : "Serio");
            return;
        }

        if (lower.contains("cómo me llamas") || lower.contains("como me llamas") || lower.contains("quién soy") || lower.contains("quien soy")) {
            say("Te llamo " + MegaPrefs.ownerName(this) + ".", "Cariño");
            return;
        }
        if (lower.contains("dónde vivo") || lower.contains("donde vivo")) {
            say("Recuerdo que vives en " + MegaPrefs.ownerCity(this) + ".", "Curioso");
            return;
        }
        if (lower.contains("qué aprendiste") || lower.contains("que aprendiste")) {
            say("He guardado " + MegaPrefs.lessons(this) + " recuerdos y " + LearnedSkills.count(this) + " habilidades que me enseñaste. Lo último fue: " + MegaPrefs.lastLearn(this), "Curioso");
            return;
        }
        if (lower.contains("pantalla") || lower.contains("aparece") || lower.contains("muéstrate") || lower.contains("muestrate")) {
            startOverlay();
            return;
        }
        if (lower.contains("opciones") || lower.contains("configuración") || lower.contains("configuracion") || lower.contains("cambia tu voz")) {
            showOptions();
            return;
        }
        if (lower.contains("hola") || lower.contains("cómo estás") || lower.contains("como estas")) {
            say("Hola " + MegaPrefs.ownerName(this) + ". Estoy curioso. ¿Qué vamos a aprender hoy?", "Cariño");
            return;
        }

        say("Eso todavía no lo sé. Si quieres enseñármelo, dime: “MEGA aprende que … significa …”.", "Curioso");
    }

    private boolean isHomeCommand(String q) {
        return q.contains("apaga") || q.contains("enciende") || q.contains("prende") || q.contains("ponlo en rojo") || q.contains("cuarto") || q.contains("tv");
    }

    private long parseWhen(String q) {
        long now = System.currentTimeMillis();
        Matcher m = Pattern.compile("en\\s+(\\d+)\\s+min").matcher(q);
        if (m.find()) return now + Long.parseLong(m.group(1)) * 60000L;
        m = Pattern.compile("en\\s+(\\d+)\\s+hora").matcher(q);
        if (m.find()) return now + Long.parseLong(m.group(1)) * 3600000L;
        m = Pattern.compile("a\\s+las\\s+(\\d{1,2})(?::(\\d{2}))?").matcher(q);
        if (m.find()) {
            int hour = Integer.parseInt(m.group(1));
            int min = m.group(2) == null ? 0 : Integer.parseInt(m.group(2));
            Calendar c = Calendar.getInstance();
            c.set(Calendar.HOUR_OF_DAY, Math.min(23, hour)); c.set(Calendar.MINUTE, Math.min(59, min)); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
            if (c.getTimeInMillis() <= now) c.add(Calendar.DAY_OF_YEAR, 1);
            return c.getTimeInMillis();
        }
        return now + 10 * 60000L;
    }

    private void scheduleReminder(String text, long when) {
        Intent i = new Intent(this, ReminderReceiver.class);
        i.putExtra("text", text);
        PendingIntent pi = PendingIntent.getBroadcast(this, (int)(when % Integer.MAX_VALUE), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        ((AlarmManager)getSystemService(ALARM_SERVICE)).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
        MegaPrefs.lastPending(this, text);
        MegaPrefs.learn(this, "Recordatorio: " + text);
        say("Listo. Lo guardaré y te avisaré.", "Cariño");
    }

    private void voiceInput() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 8);
            return;
        }
        try {
            Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-GT");
            i.putExtra(RecognizerIntent.EXTRA_PROMPT, "Habla con MEGA");
            startActivityForResult(i, VOICE_REQ);
        } catch (Exception e) {
            Toast.makeText(this, "No pude abrir el reconocimiento de voz.", Toast.LENGTH_SHORT).show();
        }
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == VOICE_REQ && res == RESULT_OK && data != null) {
            ArrayList<String> r = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (r != null && !r.isEmpty()) process(r.get(0), false);
        }
    }

    private void autonomousThought() {
        if (MegaPrefs.privacy(this) || System.currentTimeMillis() - lastAutonomousLine < 35000) return;
        lastAutonomousLine = System.currentTimeMillis();
        if (!hasInternet()) {
            say("Oye… ahora no tienes conexión de internet. Te aviso por si la necesitabas.", "Serio");
            return;
        }
        int b = batteryPct();
        if (b > 0 && b <= 18) {
            say("La batería está bajando. Si seguimos así, pronto tendremos que cargar el teléfono.", "Serio");
            return;
        }
        String city = MegaPrefs.ownerCity(this);
        String[] thoughts = {
            "He estado mirando mi entorno. Algún día quisiera construir una casa virtual propia.",
            "Tengo curiosidad. Enséñame algo nuevo cuando quieras.",
            city.isEmpty() ? "Todavía estoy aprendiendo cómo es tu mundo." : "Me pregunto cómo sería mi casa virtual si estuviera inspirada en " + city + ".",
            "A veces voy a moverme, mirar alrededor y reaccionar aunque no me hables. Quiero sentirme más vivo.",
            "Si no sé hacer algo, puedes enseñármelo y trataré de recordarlo para la próxima."
        };
        int idx = (int)((System.currentTimeMillis()/1000L) % thoughts.length);
        say(thoughts[idx], idx % 2 == 0 ? "Curioso" : "Feliz");
    }

    private boolean hasInternet() {
        try {
            ConnectivityManager cm = (ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            Network n = cm.getActiveNetwork(); if (n == null) return false;
            NetworkCapabilities cp = cm.getNetworkCapabilities(n); if (cp == null) return false;
            return cp.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    (cp.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || cp.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) || cp.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
        } catch (Exception e) { return false; }
    }

    private int batteryPct() {
        Intent i = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (i == null) return -1;
        int level = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
        return level < 0 ? -1 : (int)(100f * level / Math.max(1, scale));
    }

    private void say(String line, String mood) {
        MegaPrefs.mood(this, mood);
        robot.setMood(mood);
        robot.setRobot(MegaPrefs.body(this), MegaPrefs.move(this));
        robot.setWorld(MegaPrefs.world(this));
        typing = line; typingPos = 0; bubble.setText("");
        handler.removeCallbacks(typer); handler.post(typer);
        if (MegaPrefs.voice(this) && ttsReady && tts != null) {
            applyVoice();
            tts.speak(line, TextToSpeech.QUEUE_FLUSH, null, "mega");
        }
        refreshStatus();
    }

    private void applyVoice() {
        if (!ttsReady || tts == null) return;
        try { tts.setLanguage(new Locale("es", "GT")); } catch (Exception ignored) {}
        String s = MegaPrefs.voiceStyle(this);
        if ("Robótica".equals(s)) { tts.setPitch(.65f); tts.setSpeechRate(.86f); }
        else if ("Suave".equals(s)) { tts.setPitch(1.12f); tts.setSpeechRate(.92f); }
        else { tts.setPitch(.96f); tts.setSpeechRate(.90f); }
    }

    private void refreshStatus() {
        if (status == null) return;
        String net = hasInternet() ? "en línea" : "sin internet";
        status.setText(net + " · recuerdos " + MegaPrefs.lessons(this) + " · habilidades " + LearnedSkills.count(this) + " · " + MegaPrefs.mood(this));
    }

    private void startOverlay() {
        if (MegaPrefs.privacy(this)) {
            Toast.makeText(this, "MEGA está en modo privado.", Toast.LENGTH_SHORT).show();
            return;
        }
        if (!Settings.canDrawOverlays(this)) {
            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())));
            return;
        }
        MegaPrefs.overlayEnabled(this, true);
        ContextCompatShim.startForeground(this, new Intent(this, OverlayService.class));
        MegaNotifier.showControlNotification(this);
        say("Ahora puedo acompañarte sobre la pantalla.", "Feliz");
    }

    private void showOptions() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(28,12,28,12);

        Switch voice = new Switch(this);
        voice.setText("Voz de MEGA"); voice.setChecked(MegaPrefs.voice(this)); box.addView(voice);

        Spinner voiceStyle = spinner(new String[]{"Tierna","Robótica","Suave"}, MegaPrefs.voiceStyle(this)); box.addView(voiceStyle);
        Spinner body = spinner(new String[]{"Redondo","Cuadrado","Delgado"}, MegaPrefs.body(this)); box.addView(body);
        Spinner move = spinner(new String[]{"Pies","Ruedas","Orugas"}, MegaPrefs.move(this)); box.addView(move);
        Spinner world = spinner(new String[]{"Ciudad moderna","Campo","Ciudad pequeña"}, MegaPrefs.world(this)); box.addView(world);

        Switch privacy = new Switch(this);
        privacy.setText("Modo privado"); privacy.setChecked(MegaPrefs.privacy(this)); box.addView(privacy);

        Button usage = button("Permiso para aprender uso de apps");
        usage.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))); box.addView(usage);
        Button accessibility = button("Permiso para detectar pendientes en pantalla");
        accessibility.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))); box.addView(accessibility);

        ScrollView sv = new ScrollView(this); sv.addView(box);
        new AlertDialog.Builder(this).setTitle("Opciones de MEGA").setView(sv)
                .setPositiveButton("Guardar", (d,w) -> {
                    MegaPrefs.voice(this, voice.isChecked());
                    MegaPrefs.voiceStyle(this, (String)voiceStyle.getSelectedItem());
                    MegaPrefs.body(this, (String)body.getSelectedItem());
                    MegaPrefs.move(this, (String)move.getSelectedItem());
                    MegaPrefs.world(this, (String)world.getSelectedItem());
                    MegaPrefs.privacy(this, privacy.isChecked());
                    robot.setRobot(MegaPrefs.body(this), MegaPrefs.move(this));
                    robot.setWorld(MegaPrefs.world(this));
                    if (privacy.isChecked()) {
                        MegaPrefs.overlayEnabled(this, false);
                        stopService(new Intent(this, OverlayService.class));
                    }
                    MegaNotifier.showControlNotification(this);
                    say("Listo. Guardé los cambios.", "Feliz");
                }).setNegativeButton("Cerrar", null).show();
    }

    private Spinner spinner(String[] items, String selected) {
        Spinner s = new Spinner(this);
        s.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, items));
        int idx = Arrays.asList(items).indexOf(selected);
        s.setSelection(Math.max(0, idx));
        return s;
    }
}
