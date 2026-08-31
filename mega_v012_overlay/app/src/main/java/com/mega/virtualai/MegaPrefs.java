package com.mega.virtualai;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.*;

public final class MegaPrefs {
    private static final String FILE = "mega_local_v005";
    private static final String PRIVACY="privacy", NAME="name", BODY="body", MOVE="move", WORLD="world", ENERGY="energy", OIL="oil", CHIPS="chips", VOICE="voice", VOICE_STYLE="voice_style", OPENS="opens", LESSONS="lessons", LAST_LEARN="last_learn", OVERLAY="overlay", MOOD="mood", TOP_APPS="top_apps", LAST_PENDING="last_pending", HA_URL="ha_url", HA_LIGHT="ha_light", HA_TV="ha_tv", OWNER_NAME="owner_name", OWNER_CITY="owner_city", ONBOARDING="onboarding", CHAT_MEMORY="chat_memory", FACTS="learned_facts", RULES="learned_rules";
    private MegaPrefs() {}
    private static SharedPreferences p(Context c){ return c.getSharedPreferences(FILE, Context.MODE_PRIVATE); }

    public static boolean privacy(Context c){ return p(c).getBoolean(PRIVACY,false); }
    public static void privacy(Context c,boolean v){ p(c).edit().putBoolean(PRIVACY,v).apply(); }
    public static String name(Context c){ return p(c).getString(NAME,"MEGA"); }
    public static void name(Context c,String v){ p(c).edit().putString(NAME,v).apply(); }
    public static String ownerName(Context c){ return p(c).getString(OWNER_NAME,""); }
    public static void ownerName(Context c,String v){ p(c).edit().putString(OWNER_NAME,v).apply(); }
    public static String ownerCity(Context c){ return p(c).getString(OWNER_CITY,""); }
    public static void ownerCity(Context c,String v){ p(c).edit().putString(OWNER_CITY,v).apply(); }
    public static int onboarding(Context c){ return p(c).getInt(ONBOARDING,0); }
    public static void onboarding(Context c,int v){ p(c).edit().putInt(ONBOARDING,v).apply(); }

    public static String body(Context c){ return p(c).getString(BODY,"MEGA Neo"); }
    public static void setDesignNeo(Context c){ p(c).edit().putString(BODY,"MEGA Neo").apply(); }
    public static String move(Context c){ return p(c).getString(MOVE,"Ruedas"); }
    public static void move(Context c,String v){ p(c).edit().putString(MOVE,v).apply(); learn(c,"Ahora sé que prefieres moverme con "+v.toLowerCase()+"."); }
    public static String world(Context c){ return p(c).getString(WORLD,"Mundo pastel"); }
    public static void world(Context c,String v){ p(c).edit().putString(WORLD,v).apply(); learn(c,"Mi entorno favorito contigo ahora es "+v+"."); }

    public static int energy(Context c){ return p(c).getInt(ENERGY,86); }
    public static int oil(Context c){ return p(c).getInt(OIL,74); }
    public static int chips(Context c){ return p(c).getInt(CHIPS,2); }
    public static void feedOil(Context c){ p(c).edit().putInt(OIL,Math.min(100,oil(c)+15)).apply(); learn(c,"Me cuidaste con aceite."); }
    public static void feedChip(Context c){ p(c).edit().putInt(CHIPS,chips(c)+1).apply(); learn(c,"Me instalaste un chip nuevo."); }
    public static void charge(Context c){ p(c).edit().putInt(ENERGY,100).apply(); }

    public static boolean voice(Context c){ return p(c).getBoolean(VOICE,true); }
    public static void voice(Context c,boolean v){ p(c).edit().putBoolean(VOICE,v).apply(); }
    public static String voiceStyle(Context c){ return p(c).getString(VOICE_STYLE,"Tierna"); }
    public static void voiceStyle(Context c,String v){ p(c).edit().putString(VOICE_STYLE,v).apply(); }
    public static boolean overlayEnabled(Context c){ return p(c).getBoolean(OVERLAY,false); }
    public static void overlayEnabled(Context c,boolean v){ p(c).edit().putBoolean(OVERLAY,v).apply(); }

    public static int opens(Context c){ return p(c).getInt(OPENS,0); }
    public static void bumpOpen(Context c){ int n=opens(c)+1; p(c).edit().putInt(OPENS,n).apply(); if(n==1) learn(c,"Estoy empezando a conocerte."); }
    public static int lessons(Context c){ return p(c).getInt(LESSONS,0); }
    public static String lastLearn(Context c){ return p(c).getString(LAST_LEARN,"Aún estoy empezando."); }
    public static void learn(Context c,String text){ p(c).edit().putInt(LESSONS,lessons(c)+1).putString(LAST_LEARN,text).apply(); }
    public static String mood(Context c){ return p(c).getString(MOOD,"Curioso"); }
    public static void mood(Context c,String v){ p(c).edit().putString(MOOD,v).apply(); }
    public static String topApps(Context c){ return p(c).getString(TOP_APPS,"Todavía no he analizado tus apps."); }
    public static void topApps(Context c,String v){ p(c).edit().putString(TOP_APPS,v).apply(); }
    public static String lastPending(Context c){ return p(c).getString(LAST_PENDING,"Ningún pendiente detectado."); }
    public static void lastPending(Context c,String v){ p(c).edit().putString(LAST_PENDING,v).apply(); }

    public static String haUrl(Context c){ return p(c).getString(HA_URL,"http://homeassistant.local:8123"); }
    public static void haUrl(Context c,String v){ p(c).edit().putString(HA_URL,v).apply(); }
    public static String haLight(Context c){ return p(c).getString(HA_LIGHT,"light.cuarto"); }
    public static void haLight(Context c,String v){ p(c).edit().putString(HA_LIGHT,v).apply(); }
    public static String haTv(Context c){ return p(c).getString(HA_TV,"media_player.tv"); }
    public static void haTv(Context c,String v){ p(c).edit().putString(HA_TV,v).apply(); }

    public static String chatMemory(Context c){ return p(c).getString(CHAT_MEMORY,""); }
    public static void appendChat(Context c,String line){ String old=chatMemory(c); String next=old.isEmpty()?line:old+"\n"+line; if(next.length()>7000) next=next.substring(next.length()-7000); p(c).edit().putString(CHAT_MEMORY,next).apply(); }
    public static void clearChatMemory(Context c){ p(c).edit().remove(CHAT_MEMORY).apply(); }

    public static void teachFact(Context c,String fact){
        fact=fact==null?"":fact.trim(); if(fact.isEmpty()) return;
        String old=p(c).getString(FACTS,"");
        LinkedHashSet<String> set=new LinkedHashSet<>();
        if(old!=null&&!old.isEmpty()) for(String s:old.split("\\n")) if(!s.trim().isEmpty()) set.add(s.trim());
        set.add(fact);
        while(set.size()>40){ Iterator<String> it=set.iterator(); it.next(); it.remove(); }
        p(c).edit().putString(FACTS,String.join("\n",set)).apply(); learn(c,fact);
    }
    public static String facts(Context c){ return p(c).getString(FACTS,""); }
    public static String factsSummary(Context c){
        String f=facts(c); if(f==null||f.trim().isEmpty()) return "Todavía no me has enseñado recuerdos adicionales.";
        String[] a=f.split("\\n"); StringBuilder s=new StringBuilder(); int start=Math.max(0,a.length-5);
        for(int i=start;i<a.length;i++){ if(s.length()>0)s.append(" · "); s.append(a[i]); }
        return s.toString();
    }
    public static String findFact(Context c,String query){
        String f=facts(c); if(f==null||f.isEmpty()) return null;
        String q=norm(query); Set<String> qw=words(q); int best=0; String hit=null;
        for(String fact:f.split("\\n")){
            int score=0; for(String w:words(norm(fact))) if(qw.contains(w)&&w.length()>3) score++;
            if(score>best){best=score; hit=fact;}
        }
        return best>=2?hit:null;
    }
    public static void teachRule(Context c,String trigger,String action){
        trigger=norm(trigger); action=action==null?"":action.trim(); if(trigger.isEmpty()||action.isEmpty()) return;
        String old=p(c).getString(RULES,""); LinkedHashMap<String,String> map=new LinkedHashMap<>();
        if(old!=null&&!old.isEmpty()) for(String line:old.split("\\n")){ int k=line.indexOf("=>"); if(k>0) map.put(line.substring(0,k),line.substring(k+2)); }
        map.put(trigger,action); while(map.size()>25){ String first=map.keySet().iterator().next(); map.remove(first); }
        StringBuilder out=new StringBuilder(); for(Map.Entry<String,String> e:map.entrySet()){ if(out.length()>0)out.append('\n'); out.append(e.getKey()).append("=>").append(e.getValue()); }
        p(c).edit().putString(RULES,out.toString()).apply(); learn(c,"Aprendí que “"+trigger+"” significa “"+action+"”.");
    }
    public static String matchRule(Context c,String input){
        String q=norm(input), old=p(c).getString(RULES,""); if(old==null||old.isEmpty()) return null;
        for(String line:old.split("\\n")){ int k=line.indexOf("=>"); if(k<=0)continue; String key=line.substring(0,k); if(q.equals(key)||q.contains(key)) return line.substring(k+2); }
        return null;
    }
    private static String norm(String s){ return s==null?"":s.toLowerCase(Locale.ROOT).trim().replaceAll("[¿?¡!.,;:]"," ").replaceAll("\\s+"," "); }
    private static Set<String> words(String s){ return new HashSet<>(Arrays.asList(s.split(" "))); }

    public static String learningSummary(Context c){ return "recuerdos "+lessons(c)+" · "+mood(c); }
}
