package com.mega.virtualai;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

public final class MegaBrain {
    public interface Callback { void done(boolean ok,String text); }
    private static final ExecutorService EXEC=Executors.newSingleThreadExecutor();
    // Se deja vacío en v0.12: no hay clave dentro del APK ni se pide al usuario.
    // En una versión posterior se compila con la URL HTTPS de un backend seguro.
    private static final String BACKEND_URL="";
    private MegaBrain(){}

    public static boolean configured(Context c){ return BACKEND_URL.startsWith("https://"); }
    public static String modeLabel(Context c){ return configured(c)?"IA online segura":"IA local"; }

    public static void ask(Context c,String userText,Callback cb){
        final Context app=c.getApplicationContext();
        MegaPrefs.appendChat(app,"Tú: "+userText);
        String local=localAnswer(app,userText);
        if(local!=null){ MegaPrefs.appendChat(app,"MEGA: "+local); post(cb,true,local); return; }
        if(!configured(app)){
            String fallback="Eso todavía no lo sé. Puedo aprenderlo si me lo enseñas con “MEGA aprende que…”. Mi conexión segura para investigar en Internet aún no está activada, pero sigo funcionando localmente.";
            MegaPrefs.appendChat(app,"MEGA: "+fallback); post(cb,true,fallback); return;
        }
        requestBackend(app,userText,cb);
    }

    private static String localAnswer(Context c,String input){
        String q=input.toLowerCase(Locale.ROOT).trim();
        if(q.contains("qué aprendiste")||q.contains("que aprendiste")||q.contains("qué sabes de mí")||q.contains("que sabes de mi")) return "Esto es de lo más reciente que recuerdo: "+MegaPrefs.factsSummary(c);
        if(q.matches(".*\\b(hola|buenas|hey)\\b.*")) return MegaPrefs.ownerName(c).isEmpty()?"¡Hola! Me alegra verte.":"¡Hola, "+MegaPrefs.ownerName(c)+"! ¿Qué descubrimos hoy?";
        if(q.contains("gracias")) return "¡De nada! Me gusta ser útil contigo.";
        if(q.contains("quién eres")||q.contains("quien eres")) return "Soy MEGA, tu compañero virtual. Aprendo recuerdos, reacciono a lo que pasa en el teléfono y poco a poco voy formando mi manera de acompañarte.";
        if(q.contains("cómo estás")||q.contains("como estas")) return "Estoy curioso y con energía para aprender algo contigo.";
        if(q.contains("cuéntame un chiste")||q.contains("cuentame un chiste")) return "¿Qué hace un robot cuando tiene frío? ¡Se pone un byte de abrigo!";
        String fact=MegaPrefs.findFact(c,q); if(fact!=null) return "Recuerdo esto: "+fact;
        return null;
    }

    private static void requestBackend(Context c,String userText,Callback cb){
        EXEC.execute(()->{
            HttpURLConnection conn=null;
            try{
                conn=(HttpURLConnection)new URL(BACKEND_URL).openConnection();
                conn.setConnectTimeout(12000); conn.setReadTimeout(45000); conn.setRequestMethod("POST"); conn.setDoOutput(true); conn.setRequestProperty("Content-Type","application/json");
                JSONObject body=new JSONObject();
                body.put("message",userText); body.put("owner",MegaPrefs.ownerName(c)); body.put("city",MegaPrefs.ownerCity(c)); body.put("memory",MegaPrefs.chatMemory(c)); body.put("learned",MegaPrefs.facts(c));
                byte[] data=body.toString().getBytes(StandardCharsets.UTF_8); try(OutputStream os=conn.getOutputStream()){os.write(data);} int code=conn.getResponseCode();
                String raw=readAll(code>=200&&code<300?conn.getInputStream():conn.getErrorStream());
                if(code<200||code>=300){ post(cb,true,"Mi conexión de IA online no respondió, así que sigo en modo local."); return; }
                JSONObject response=new JSONObject(raw); String text=response.optString("answer","").trim(); if(text.isEmpty()) text="No obtuve una respuesta clara. Sigo contigo en modo local.";
                MegaPrefs.appendChat(c,"MEGA: "+text); post(cb,true,text);
            }catch(Exception e){ post(cb,true,"No pude usar mi conexión online ahora. Sigo funcionando en modo local."); }
            finally{ if(conn!=null)conn.disconnect(); }
        });
    }

    public static void autonomousThought(Context c,Callback cb){
        if(MegaPrefs.privacy(c)) return;
        long slot=System.currentTimeMillis()/240000L;
        if(slot%3==0) return;
        String owner=MegaPrefs.ownerName(c), city=MegaPrefs.ownerCity(c), last=MegaPrefs.lastLearn(c);
        String[] ideas={
                last!=null&&!last.isEmpty()?"Estuve recordando algo que aprendí: "+last:null,
                city!=null&&!city.isEmpty()?"Tengo curiosidad por cómo sería mi rincón virtual inspirado en "+city+".":null,
                owner!=null&&!owner.isEmpty()?owner+", si hoy me enseñas algo nuevo lo voy a guardar.":null,
                "Estoy explorando mi mundo. A veces también prefiero quedarme callado y observar."
        };
        int idx=(int)(Math.abs(slot)%ideas.length); String s=ideas[idx]; if(s!=null) post(cb,true,s);
    }

    private static String readAll(InputStream in)throws Exception{ if(in==null)return""; BufferedReader br=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8)); StringBuilder sb=new StringBuilder(); String line; while((line=br.readLine())!=null)sb.append(line); return sb.toString(); }
    private static void post(Callback cb,boolean ok,String text){ new Handler(Looper.getMainLooper()).post(()->cb.done(ok,text)); }
}
