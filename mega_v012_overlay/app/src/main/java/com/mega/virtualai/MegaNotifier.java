package com.mega.virtualai;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;

public final class MegaNotifier {
    public static final String CHANNEL="mega_controls";
    private MegaNotifier(){}
    public static void ensureChannel(Context c){
        try{
            if(Build.VERSION.SDK_INT>=26){
                NotificationChannel ch=new NotificationChannel(CHANNEL,"MEGA controles",NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Controles rápidos de MEGA");
                NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
                if(nm!=null)nm.createNotificationChannel(ch);
            }
        }catch(Exception ignored){}
    }
    public static Notification build(Context c){
        ensureChannel(c);
        Intent open=new Intent(c,MainActivity.class);
        PendingIntent pi=PendingIntent.getActivity(c,1,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent toggle=PendingIntent.getBroadcast(c,20,new Intent(c,MegaControlReceiver.class).setAction(MegaControlReceiver.ACTION_TOGGLE),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent privacy=PendingIntent.getBroadcast(c,21,new Intent(c,MegaControlReceiver.class).setAction(MegaControlReceiver.ACTION_PRIVACY),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stop=PendingIntent.getBroadcast(c,22,new Intent(c,MegaControlReceiver.class).setAction(MegaControlReceiver.ACTION_STOP),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        String state=MegaPrefs.overlayEnabled(c)?"acompañándote":"en su mundo";
        return new Notification.Builder(c,CHANNEL)
                .setSmallIcon(R.drawable.ic_mega_robot)
                .setContentTitle("MEGA · "+state)
                .setContentText("Compañero virtual")
                .setContentIntent(pi)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(null,MegaPrefs.overlayEnabled(c)?"Ocultar":"Pantalla",toggle).build())
                .addAction(new Notification.Action.Builder(null,MegaPrefs.privacy(c)?"Salir privado":"Privado",privacy).build())
                .addAction(new Notification.Action.Builder(null,"Cerrar",stop).build())
                .build();
    }
    public static void showControlNotification(Context c){
        try{
            if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
            ensureChannel(c);
            NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
            if(nm!=null)nm.notify(700,build(c));
        }catch(Exception ignored){}
    }
}
