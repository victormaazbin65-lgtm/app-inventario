package com.mega.virtualai;

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
import android.text.TextUtils;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
import android.widget.*;
import java.util.*;
import java.util.regex.*;

public class MainActivity extends Activity implements TextToSpeech.OnInitListener {
    private Mega3DView robot3d;
    private TextView speech, subtitle;
    private EditText chatInput;
    private LinearLayout chatRow;
    private TextToSpeech tts;
    private boolean ttsReady=false, executingLearnedRule=false;
    private static final int VOICE_REQ=44;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private String typingText=""; private int typingPos=0;
    private Boolean lastInternetState=null; private int lastBatteryBand=-1, ambientTicks=0;

    private final Runnable typer=new Runnable(){ @Override public void run(){ if(typingPos<typingText.length()){ typingPos++; speech.setText(typingText.substring(0,typingPos)); handler.postDelayed(this,18); } }};
    private final Runnable ambient=new Runnable(){ @Override public void run(){ proactiveCheck(); handler.postDelayed(this,60000); }};

    @Override protected void onCreate(Bundle b){
        super.onCreate(b);
        MegaPrefs.setDesignNeo(this);
        MegaPrefs.bumpOpen(this);
        buildUi();
        tts=new TextToSpeech(this,this);
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){ requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},7); }
        if(MegaPrefs.onboarding(this)==0) askNextQuestion(); else greetBack();
        handler.postDelayed(ambient,15000);
        safeNotify();
    }

    @Override protected void onResume(){ super.onResume(); if(robot3d!=null)robot3d.onResume(); refreshSubtitle(); }
    @Override protected void onPause(){ if(robot3d!=null)robot3d.onPause(); super.onPause(); }
    @Override protected void onDestroy(){ handler.removeCallbacksAndMessages(null); if(tts!=null){tts.stop();tts.shutdown();} super.onDestroy(); }
    @Override public void onInit(int r){ ttsReady=r==TextToSpeech.SUCCESS; applyVoiceStyle(); }

    private void applyVoiceStyle(){
        if(!ttsReady||tts==null)return;
        try{tts.setLanguage(new Locale("es","GT"));}catch(Exception ignored){}
        String s=MegaPrefs.voiceStyle(this);
        if("Robótica".equals(s)){tts.setPitch(.70f);tts.setSpeechRate(.86f);} else if("Suave".equals(s)){tts.setPitch(1.12f);tts.setSpeechRate(.92f);} else {tts.setPitch(1.02f);tts.setSpeechRate(.91f);}
    }

    private void buildUi(){
        LinearLayout root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Color.rgb(7,5,15)); root.setPadding(dp(16),dp(18),dp(16),dp(14));

        LinearLayout header=new LinearLayout(this); header.setGravity(Gravity.CENTER_VERTICAL); header.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout headText=new LinearLayout(this); headText.setOrientation(LinearLayout.VERTICAL);
        TextView title=text("MEGA",29,true,Color.WHITE); subtitle=text("curioso · aprendiendo",12,false,Color.rgb(131,222,255)); subtitle.setSingleLine(true);
        headText.addView(title); headText.addView(subtitle);
        Button options=button("Opciones"); options.setOnClickListener(v->showOptions());
        header.addView(headText,new LinearLayout.LayoutParams(0,-2,1)); header.addView(options,new LinearLayout.LayoutParams(-2,-2)); root.addView(header);

        FrameLayout stage=new FrameLayout(this);
        android.graphics.drawable.GradientDrawable stageBg=new android.graphics.drawable.GradientDrawable(); stageBg.setCornerRadius(dp(28)); stageBg.setColor(Color.rgb(18,12,34)); stage.setBackground(stageBg); stage.setClipToOutline(true);
        robot3d=new Mega3DView(this); robot3d.setRobot("MEGA Neo",MegaPrefs.move(this)); robot3d.setWorld(MegaPrefs.world(this)); robot3d.setMood(MegaPrefs.mood(this));
        stage.addView(robot3d,new FrameLayout.LayoutParams(-1,-1));
        speech=text("",15,true,Color.WHITE); speech.setGravity(Gravity.CENTER); speech.setMaxLines(3); speech.setEllipsize(TextUtils.TruncateAt.END); speech.setPadding(dp(16),dp(10),dp(16),dp(10));
        android.graphics.drawable.GradientDrawable bubble=new android.graphics.drawable.GradientDrawable(); bubble.setColor(0xC81B1530); bubble.setStroke(dp(1),Color.rgb(101,212,255)); bubble.setCornerRadius(dp(18)); speech.setBackground(bubble);
        FrameLayout.LayoutParams sp=new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM); sp.setMargins(dp(14),dp(14),dp(14),dp(14)); stage.addView(speech,sp);
        root.addView(stage,new LinearLayout.LayoutParams(-1,0,1f));

        LinearLayout actions=new LinearLayout(this); actions.setOrientation(LinearLayout.HORIZONTAL); actions.setPadding(0,dp(10),0,0);
        Button mic=button("🎙 Hablar"), write=button("⌨ Escribir"), screen=button("📱 Pantalla");
        mic.setOnClickListener(v->voiceInput()); write.setOnClickListener(v->toggleChatInput()); screen.setOnClickListener(v->startOverlay());
        actions.addView(mic,new LinearLayout.LayoutParams(0,-2,1)); actions.addView(write,new LinearLayout.LayoutParams(0,-2,1)); actions.addView(screen,new LinearLayout.LayoutParams(0,-2,1)); root.addView(actions);

        chatRow=new LinearLayout(this); chatRow.setOrientation(LinearLayout.HORIZONTAL); chatRow.setVisibility(View.GONE); chatRow.setPadding(0,dp(8),0,0);
        chatInput=new EditText(this); chatInput.setHint("Escríbele a MEGA…"); chatInput.setTextColor(Color.WHITE); chatInput.setHintTextColor(Color.rgb(142,137,160)); chatInput.setSingleLine(false); chatInput.setMaxLines(3);
        Button send=button("Enviar"); send.setOnClickListener(v->{String x=chatInput.getText().toString().trim(); if(!x.isEmpty()){processUserInput(x);chatInput.setText("");}});
        chatRow.addView(chatInput,new LinearLayout.LayoutParams(0,-2,1)); chatRow.addView(send,new LinearLayout.LayoutParams(-2,-2)); root.addView(chatRow);
        setContentView(root);
    }

    private int dp(int v){ return Math.round(v*getResources().getDisplayMetrics().density); }
    private Button button(String t){ Button b=new Button(this); b.setAllCaps(false); b.setText(t); b.setTextColor(Color.WHITE); b.setTextSize(14); android.graphics.drawable.GradientDrawable g=new android.graphics.drawable.GradientDrawable(); g.setColor(Color.rgb(52,39,86)); g.setCornerRadius(dp(18)); g.setStroke(dp(1),Color.rgb(126,91,204)); b.setBackground(g); return b; }
    private TextView text(String t,int sz,boolean bold,int c){TextView v=new TextView(this);v.setText(t);v.setTextSize(sz);v.setTextColor(c);v.setPadding(0,dp(5),0,dp(5));if(bold)v.setTypeface(Typeface.DEFAULT_BOLD);return v;}

    private void toggleChatInput(){ chatRow.setVisibility(chatRow.getVisibility()==View.VISIBLE?View.GONE:View.VISIBLE); if(chatRow.getVisibility()==View.VISIBLE){chatInput.requestFocus(); InputMethodManager im=(InputMethodManager)getSystemService(INPUT_METHOD_SERVICE);if(im!=null)im.showSoftInput(chatInput,InputMethodManager.SHOW_IMPLICIT);} }

    private void greetBack(){ String n=MegaPrefs.ownerName(this); if(n.isEmpty())askNextQuestion(); else say("Hola, "+n+". Me alegra verte otra vez.","Cariño"); }
    private void askNextQuestion(){ int s=MegaPrefs.onboarding(this); if(s==0)say("Hola… acabo de despertar. ¿Cómo quieres que te llame?","Curioso"); else if(s==1)say("Mucho gusto. ¿En qué lugar o ciudad vives?","Curioso"); else say("Perfecto. Ya puedo empezar a conocerte de verdad.","Feliz"); }

    private void processUserInput(String input){
        String lower=input.toLowerCase(Locale.ROOT).trim();
        int step=MegaPrefs.onboarding(this);
        if(step==0){MegaPrefs.ownerName(this,input.trim());MegaPrefs.onboarding(this,1);MegaPrefs.teachFact(this,"Quieres que te llame "+input.trim()+".");askNextQuestion();return;}
        if(step==1){MegaPrefs.ownerCity(this,input.trim());MegaPrefs.onboarding(this,2);MegaPrefs.teachFact(this,"Vives en "+input.trim()+".");say("Entonces vives en "+input.trim()+". Voy a recordarlo.","Feliz");return;}

        if(!executingLearnedRule){ String action=MegaPrefs.matchRule(this,lower); if(action!=null){executingLearnedRule=true; say("Lo recuerdo. Ya aprendí qué significa eso.","Feliz"); handler.postDelayed(()->{processUserInput(action);executingLearnedRule=false;},550); return;} }

        if(lower.startsWith("mega aprende")||lower.startsWith("aprende esto")||lower.contains("aprende que")){ teach(input); return; }
        if(lower.contains("qué aprendiste")||lower.contains("que aprendiste")||lower.contains("qué sabes de mí")||lower.contains("que sabes de mi")){say("Recuerdo: "+MegaPrefs.factsSummary(this),"Cariño");return;}
        if(lower.contains("recuérdame")||lower.contains("recordame")){scheduleReminder(input,parseMinutes(lower));return;}
        if(lower.contains("apaga")||lower.contains("enciende")||lower.contains("prende")||lower.contains("ponlo en rojo")||lower.contains("cuarto")||lower.contains("tv")){SmartHomeManager.execute(this,input,(ok,msg)->say(msg,ok?"Feliz":"Serio"));return;}
        if(lower.contains("internet")||lower.contains("wifi")||lower.contains("conexión")||lower.contains("conexion")){say(connectivityLine(),hasInternet()?"Feliz":"Serio");return;}
        if(lower.contains("como me llamas")||lower.contains("cómo me llamas")||lower.contains("quién soy")||lower.contains("quien soy")){String n=MegaPrefs.ownerName(this);say(n.isEmpty()?"Todavía no me has dicho cómo llamarte.":"Te llamo "+n+".","Cariño");return;}
        if(lower.contains("donde vivo")||lower.contains("dónde vivo")){String city=MegaPrefs.ownerCity(this);say(city.isEmpty()?"Aún no me has dicho dónde vives.":"Recuerdo que vives en "+city+".","Curioso");return;}
        if(lower.contains("cambia voz")||lower.equals("voz")){showOptions();return;}
        if(lower.contains("muéstrate")||lower.contains("muestrate")||lower.contains("aparece en pantalla")){startOverlay();return;}
        if(lower.contains("ocúltate")||lower.contains("ocultate")){MegaPrefs.overlayEnabled(this,false);stopService(new Intent(this,OverlayService.class));safeNotify();say("Me ocultaré por ahora.","Serio");return;}
        askBrain(input);
    }

    private void teach(String input){
        String learned=input.replaceFirst("(?i)^mega\\s+aprende(?:\\s+esto)?(?:\\s+que)?[: ]*","").replaceFirst("(?i)^aprende(?:\\s+esto)?(?:\\s+que)?[: ]*","").trim();
        if(learned.isEmpty()){say("Dime qué quieres que aprenda.","Curioso");return;}
        Matcher m=Pattern.compile("(?i)^(.+?)\\s+significa\\s+(.+)$").matcher(learned);
        if(m.find()){String trigger=m.group(1).trim(),action=m.group(2).trim();MegaPrefs.teachRule(this,trigger,action);say("¡Aprendido! Cuando digas “"+trigger+"”, recordaré qué hacer.","Feliz");}
        else{MegaPrefs.teachFact(this,learned);say("Lo aprendí. Voy a guardarlo como un recuerdo contigo.","Feliz");}
    }

    private void askBrain(String input){ say("Déjame pensar…","Curioso"); MegaBrain.ask(this,input,(ok,a)->say(a,ok?(a.contains("!")?"Feliz":"Curioso"):"Serio")); }
    private int parseMinutes(String s){if(s.contains("1 hora")||s.contains("una hora"))return 60;Matcher m=Pattern.compile("en\\s+(\\d+)\\s+min").matcher(s);if(m.find())try{return Integer.parseInt(m.group(1));}catch(Exception ignored){}return 10;}
    private void scheduleReminder(String text,int mins){long when=System.currentTimeMillis()+mins*60000L;Intent i=new Intent(this,ReminderReceiver.class);i.putExtra("text",text);PendingIntent pi=PendingIntent.getBroadcast(this,(int)(when%Integer.MAX_VALUE),i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);((AlarmManager)getSystemService(ALARM_SERVICE)).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);MegaPrefs.lastPending(this,text);MegaPrefs.teachFact(this,"Recordatorio: "+text);say("Lo recordaré por ti.","Cariño");safeNotify();}

    private void voiceInput(){if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},8);return;}try{Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"es-GT");startActivityForResult(i,VOICE_REQ);}catch(Exception e){Toast.makeText(this,"El reconocimiento de voz no está disponible.",Toast.LENGTH_SHORT).show();}}
    @Override protected void onActivityResult(int req,int res,Intent data){super.onActivityResult(req,res,data);if(req==VOICE_REQ&&res==RESULT_OK&&data!=null){ArrayList<String>r=data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);if(r!=null&&!r.isEmpty())processUserInput(r.get(0));}}

    private void proactiveCheck(){
        if(MegaPrefs.privacy(this))return;
        boolean online=hasInternet(); int battery=batteryPct(); int band=battery<=0?-1:(battery<=10?1:(battery<=20?2:3));
        if(lastInternetState!=null&&lastInternetState&&!online)say("Parece que nos quedamos sin Internet. Sigo funcionando contigo en modo local.","Serio");
        else if(lastInternetState!=null&&!lastInternetState&&online)say("Volvió Internet.","Feliz"); lastInternetState=online;
        if(band>0&&band<3&&band!=lastBatteryBand)say(band==1?"Nos queda muy poca batería. Sería buena idea cargar el teléfono.":"La batería está bajando. Te aviso para que no nos agarre por sorpresa.","Serio"); lastBatteryBand=band;
        ambientTicks++; if(robot3d!=null){String[] m={"Curioso","Feliz","Cariño","Curioso","Serio"};robot3d.setMood(m[ambientTicks%m.length]);}
        if(ambientTicks%4==0)MegaBrain.autonomousThought(this,(ok,t)->{if(ok&&t!=null&&!t.trim().isEmpty())say(t,"Curioso");});
        refreshSubtitle();
    }

    private boolean hasInternet(){try{ConnectivityManager cm=(ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);if(cm==null)return false;Network n=cm.getActiveNetwork();if(n==null)return false;NetworkCapabilities caps=cm.getNetworkCapabilities(n);if(caps==null)return false;return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)&&(caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)||caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)||caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));}catch(RuntimeException e){return false;}}
    private String connectivityLine(){return hasInternet()?"Tienes conexión activa.":"Ahora mismo no detecto conexión de Internet o Wi‑Fi. Sigo en modo local.";}
    private int batteryPct(){Intent i=registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));if(i==null)return-1;int l=i.getIntExtra(BatteryManager.EXTRA_LEVEL,-1),s=i.getIntExtra(BatteryManager.EXTRA_SCALE,100);return l<0?-1:(int)(100f*l/Math.max(1,s));}
    private void refreshSubtitle(){if(subtitle==null)return;String state=hasInternet()?"en línea":"sin internet";subtitle.setText(MegaPrefs.mood(this).toLowerCase(Locale.ROOT)+" · aprendiendo · "+state);}

    private void say(String line,String mood){MegaPrefs.mood(this,mood);if(robot3d!=null){robot3d.setMood(mood);robot3d.setRobot("MEGA Neo",MegaPrefs.move(this));robot3d.setWorld(MegaPrefs.world(this));}typingText=line==null?"":line;typingPos=0;speech.setText("");handler.removeCallbacks(typer);handler.post(typer);if(MegaPrefs.voice(this)&&ttsReady&&tts!=null){applyVoiceStyle();tts.speak(typingText,TextToSpeech.QUEUE_FLUSH,null,"mega_line");}refreshSubtitle();}

    private void showOptions(){
        ScrollView sv=new ScrollView(this);LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(dp(22),dp(16),dp(22),dp(16));sv.addView(root);
        root.addView(text("Inteligencia",16,true,Color.BLACK)); root.addView(text("MEGA v0.12 funciona sin pedirte claves. Ahora usa su memoria y cerebro local; la conexión a un backend seguro está preparada para una versión posterior.",12,false,Color.DKGRAY));
        root.addView(text("Voz",16,true,Color.BLACK));Switch voice=new Switch(this);voice.setText("Hablar en voz alta");voice.setChecked(MegaPrefs.voice(this));root.addView(voice);Spinner vs=new Spinner(this);String[] voices={"Tierna","Robótica","Suave"};vs.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,voices));vs.setSelection(index(voices,MegaPrefs.voiceStyle(this)));root.addView(vs);
        root.addView(text("Movimiento",16,true,Color.BLACK));Spinner mv=new Spinner(this);String[] moves={"Ruedas","Orugas","Pies"};mv.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,moves));mv.setSelection(index(moves,MegaPrefs.move(this)));root.addView(mv);
        root.addView(text("Entorno",16,true,Color.BLACK));Spinner wr=new Spinner(this);String[] worlds={"Mundo pastel","Ciudad futurista","Jardín digital"};wr.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,worlds));wr.setSelection(index(worlds,MegaPrefs.world(this)));root.addView(wr);
        Switch privacy=new Switch(this);privacy.setText("Modo privado");privacy.setChecked(MegaPrefs.privacy(this));root.addView(privacy);
        Button clear=new Button(this);clear.setText("Borrar memoria de conversación");clear.setOnClickListener(v->{MegaPrefs.clearChatMemory(this);Toast.makeText(this,"Memoria de conversación borrada.",Toast.LENGTH_SHORT).show();});root.addView(clear);
        new AlertDialog.Builder(this).setTitle("Opciones de MEGA").setView(sv).setPositiveButton("Guardar",(d,w)->{MegaPrefs.voice(this,voice.isChecked());MegaPrefs.voiceStyle(this,voices[vs.getSelectedItemPosition()]);MegaPrefs.move(this,moves[mv.getSelectedItemPosition()]);MegaPrefs.world(this,worlds[wr.getSelectedItemPosition()]);MegaPrefs.privacy(this,privacy.isChecked());if(robot3d!=null){robot3d.setRobot("MEGA Neo",MegaPrefs.move(this));robot3d.setWorld(MegaPrefs.world(this));}if(privacy.isChecked()){MegaPrefs.overlayEnabled(this,false);stopService(new Intent(this,OverlayService.class));}safeNotify();say("Listo. Ajusté mi mundo.","Feliz");}).setNegativeButton("Cerrar",null).show();
    }
    private int index(String[] a,String v){for(int i=0;i<a.length;i++)if(a[i].equals(v))return i;return 0;}

    private void startOverlay(){if(MegaPrefs.privacy(this)){Toast.makeText(this,"Desactiva el modo privado primero.",Toast.LENGTH_SHORT).show();return;}if(!Settings.canDrawOverlays(this)){startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+getPackageName())));return;}MegaPrefs.overlayEnabled(this,true);ContextCompatShim.startForeground(this,new Intent(this,OverlayService.class));safeNotify();say("Ahora puedo acompañarte sobre otras aplicaciones.","Feliz");}
    private void safeNotify(){try{MegaNotifier.showControlNotification(this);}catch(Exception ignored){}}
}
