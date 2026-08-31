package com.mega.virtualai;

import android.content.Context;
import android.graphics.*;
import android.os.Handler;
import android.os.Looper;
import android.view.View;

public class MegaRobotView extends View {
    private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String targetMessage = "Hola. Soy MEGA.";
    private String displayMessage = "Hola. Soy MEGA.";
    private String body = "MEGA Neo";
    private String move = "Ruedas";
    private String world = "Mundo pastel";
    private String mood = "Curioso";
    private boolean overlayMode = false;
    private int letterIndex = 0;
    private final Runnable typer = new Runnable() {
        @Override public void run() {
            if (letterIndex < targetMessage.length()) {
                letterIndex++;
                displayMessage = targetMessage.substring(0, letterIndex);
                invalidate();
                handler.postDelayed(this, 26);
            }
        }
    };

    public MegaRobotView(Context c) { super(c); setLayerType(View.LAYER_TYPE_SOFTWARE, null); }
    public void setRobot(String body, String move) { this.body = body; this.move = move; invalidate(); }
    public void setWorld(String world) { this.world = world; invalidate(); }
    public void setMood(String mood) { this.mood = mood; invalidate(); }
    public void setOverlayMode(boolean value) { this.overlayMode = value; invalidate(); }
    public void setMessage(String m) { targetMessage=m==null?"":m; displayMessage=""; letterIndex=0; handler.removeCallbacks(typer); handler.post(typer); }
    @Override protected void onDetachedFromWindow() { handler.removeCallbacksAndMessages(null); super.onDetachedFromWindow(); }

    @Override protected void onDraw(Canvas c) {
        super.onDraw(c); float w=getWidth(),h=getHeight(); if(!overlayMode)drawWorld(c,w,h); drawRobot(c,w,h); if(!overlayMode||(displayMessage!=null&&!displayMessage.isEmpty()))drawBubble(c,w,h);
    }

    private void drawWorld(Canvas c,float w,float h){
        Paint bg=new Paint(Paint.ANTI_ALIAS_FLAG);
        if("Jardín digital".equals(world)||"Campo".equals(world)){
            bg.setShader(new LinearGradient(0,0,0,h,Color.rgb(83,61,133),Color.rgb(156,213,249),Shader.TileMode.CLAMP));c.drawRect(0,0,w,h,bg);
            bg.setShader(new LinearGradient(0,h*.56f,0,h,Color.rgb(102,183,119),Color.rgb(61,112,77),Shader.TileMode.CLAMP));c.drawRect(0,h*.59f,w,h,bg);
            p.setColor(Color.rgb(255,210,117));c.drawCircle(w*.82f,h*.17f,38,p);
            for(int i=0;i<5;i++){float x=w*(.12f+i*.19f);p.setColor(Color.rgb(99,183,126));c.drawCircle(x,h*.56f,28,p);p.setColor(Color.rgb(117,82,91));c.drawRect(x-6,h*.56f,x+6,h*.67f,p);}
        }else if("Mundo pastel".equals(world)){
            bg.setShader(new LinearGradient(0,0,0,h,Color.rgb(109,71,171),Color.rgb(255,168,190),Shader.TileMode.CLAMP));c.drawRect(0,0,w,h,bg);
            p.setColor(Color.rgb(158,118,225));c.drawRoundRect(new RectF(w*.04f,h*.47f,w*.96f,h*.77f),45,45,p);
            p.setColor(Color.rgb(90,222,255));p.setStrokeWidth(7);p.setStyle(Paint.Style.STROKE);c.drawArc(new RectF(w*.07f,h*.53f,w*.93f,h*.78f),180,170,false,p);p.setStyle(Paint.Style.FILL);
            p.setColor(Color.rgb(255,220,101));c.drawCircle(w*.20f,h*.19f,17,p);p.setColor(Color.rgb(105,229,255));c.drawCircle(w*.79f,h*.27f,11,p);p.setColor(Color.rgb(246,139,220));c.drawCircle(w*.67f,h*.13f,9,p);
        }else{
            bg.setShader(new LinearGradient(0,0,0,h,Color.rgb(35,31,93),Color.rgb(92,98,203),Shader.TileMode.CLAMP));c.drawRect(0,0,w,h,bg);
            bg.setShader(new LinearGradient(0,h*.58f,0,h,Color.rgb(30,24,57),Color.rgb(11,10,24),Shader.TileMode.CLAMP));c.drawRect(0,h*.6f,w,h,bg);
            for(int i=0;i<6;i++){float left=16+i*(w/6.1f);float top=h*(.25f+(i%3)*.06f);p.setColor(Color.rgb(69+i*8,58+i*6,116+i*9));c.drawRoundRect(new RectF(left,top,left+55,h*.6f),8,8,p);p.setColor(Color.rgb(88,226,255));for(int y=0;y<4;y++){c.drawRoundRect(new RectF(left+10,top+12+y*21,left+18,top+19+y*21),3,3,p);c.drawRoundRect(new RectF(left+34,top+12+y*21,left+42,top+19+y*21),3,3,p);}}
        }
        p.setColor(0x33000000);c.drawOval(new RectF(w*.18f,h*.72f,w*.82f,h*.92f),p);
    }

    private void drawRobot(Canvas c,float w,float h){
        float cx=w/2f,top=h*(overlayMode?.10f:.16f);float headW=w*(overlayMode?.72f:.58f),headH=h*(overlayMode?.34f:.26f);
        Paint shadow=new Paint(Paint.ANTI_ALIAS_FLAG);shadow.setColor(0x44000000);c.drawRoundRect(new RectF(cx-headW/2+7,top+10,cx+headW/2+7,top+headH+10),headH*.45f,headH*.45f,shadow);
        Paint shell=new Paint(Paint.ANTI_ALIAS_FLAG);shell.setShader(new LinearGradient(cx-headW/2,top,cx+headW/2,top+headH,Color.rgb(250,247,255),Color.rgb(211,195,247),Shader.TileMode.CLAMP));RectF head=new RectF(cx-headW/2,top,cx+headW/2,top+headH);c.drawRoundRect(head,headH*.46f,headH*.46f,shell);
        Paint gold=new Paint(Paint.ANTI_ALIAS_FLAG);gold.setColor(Color.rgb(255,174,92));RectF rim=new RectF(head.left+12,head.top+13,head.right-12,head.bottom-13);c.drawRoundRect(rim,headH*.37f,headH*.37f,gold);
        Paint faceP=new Paint(Paint.ANTI_ALIAS_FLAG);faceP.setColor(Color.rgb(8,10,28));RectF face=new RectF(rim.left+8,rim.top+8,rim.right-8,rim.bottom-8);c.drawRoundRect(face,headH*.32f,headH*.32f,faceP);

        float eyeY=face.centerY()-3,eyeR=overlayMode?10:17;boolean sleepy="Dormir".equals(mood),serious="Serio".equals(mood);Paint glow=new Paint(Paint.ANTI_ALIAS_FLAG);glow.setColor(Color.rgb(58,229,255));glow.setShadowLayer(18,0,0,Color.rgb(58,229,255));
        if(sleepy||serious){c.drawRoundRect(new RectF(face.left+face.width()*.22f,eyeY-3,face.left+face.width()*.36f,eyeY+3),6,6,glow);c.drawRoundRect(new RectF(face.right-face.width()*.36f,eyeY-3,face.right-face.width()*.22f,eyeY+3),6,6,glow);}else{c.drawCircle(face.left+face.width()*.29f,eyeY,eyeR,glow);c.drawCircle(face.right-face.width()*.29f,eyeY,eyeR,glow);p.setColor(Color.WHITE);c.drawCircle(face.left+face.width()*.31f,eyeY-eyeR*.25f,eyeR*.23f,p);c.drawCircle(face.right-face.width()*.27f,eyeY-eyeR*.25f,eyeR*.23f,p);}glow.clearShadowLayer();
        Paint blush=new Paint(Paint.ANTI_ALIAS_FLAG);blush.setColor(Color.rgb(255,80,151));c.drawRoundRect(new RectF(face.left+face.width()*.14f,face.bottom-face.height()*.24f,face.left+face.width()*.25f,face.bottom-face.height()*.19f),6,6,blush);c.drawRoundRect(new RectF(face.right-face.width()*.25f,face.bottom-face.height()*.24f,face.right-face.width()*.14f,face.bottom-face.height()*.19f),6,6,blush);
        p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(4);p.setColor(Color.rgb(72,221,255));RectF smile=new RectF(face.centerX()-25,face.centerY()+7,face.centerX()+25,face.bottom-5);c.drawArc(smile,12,156,false,p);p.setStyle(Paint.Style.FILL);
        p.setColor(Color.rgb(112,76,190));p.setStrokeWidth(7);c.drawLine(cx+headW*.16f,head.top+3,cx+headW*.22f,head.top-headH*.22f,p);p.setColor(Color.rgb(255,196,96));c.drawCircle(cx+headW*.22f,head.top-headH*.22f,overlayMode?11:17,p);
        p.setColor(Color.rgb(132,93,207));c.drawCircle(head.left-4,face.centerY(),overlayMode?15:22,p);c.drawCircle(head.right+4,face.centerY(),overlayMode?15:22,p);p.setColor(Color.rgb(65,224,255));c.drawCircle(head.left-4,face.centerY(),overlayMode?8:12,p);p.setColor(Color.rgb(255,179,91));c.drawCircle(head.right+4,face.centerY(),overlayMode?8:12,p);

        float torsoTop=head.bottom+8,torsoH=h*(overlayMode?.23f:.25f),torsoW=w*(overlayMode?.42f:.35f);RectF torso=new RectF(cx-torsoW/2,torsoTop,cx+torsoW/2,torsoTop+torsoH);Paint torsoP=new Paint(Paint.ANTI_ALIAS_FLAG);torsoP.setShader(new LinearGradient(torso.left,torso.top,torso.right,torso.bottom,Color.rgb(249,245,255),Color.rgb(198,181,238),Shader.TileMode.CLAMP));c.drawRoundRect(torso,torsoW*.32f,torsoW*.32f,torsoP);
        RectF chest=new RectF(cx-torsoW*.31f,torso.top+torsoH*.24f,cx+torsoW*.31f,torso.top+torsoH*.52f);p.setColor(Color.rgb(8,20,47));c.drawRoundRect(chest,14,14,p);p.setColor(Color.rgb(64,229,255));p.setTextAlign(Paint.Align.CENTER);p.setTypeface(Typeface.DEFAULT_BOLD);p.setTextSize(overlayMode?13:20);c.drawText("MEGA",cx,chest.centerY()+7,p);
        p.setColor(Color.rgb(255,178,92));c.drawCircle(torso.left,torso.top+torsoH*.31f,overlayMode?10:16,p);c.drawCircle(torso.right,torso.top+torsoH*.31f,overlayMode?10:16,p);
        Paint arm=new Paint(Paint.ANTI_ALIAS_FLAG);arm.setColor(Color.rgb(161,121,225));arm.setStrokeWidth(overlayMode?9:14);arm.setStrokeCap(Paint.Cap.ROUND);float ay=torso.top+torsoH*.34f;c.drawLine(torso.left,ay,torso.left-torsoW*.35f,ay+torsoH*.24f,arm);c.drawLine(torso.right,ay,torso.right+torsoW*.35f,ay+torsoH*.24f,arm);p.setColor(Color.rgb(247,244,252));c.drawCircle(torso.left-torsoW*.38f,ay+torsoH*.27f,overlayMode?11:17,p);c.drawCircle(torso.right+torsoW*.38f,ay+torsoH*.27f,overlayMode?11:17,p);
        p.setColor(Color.rgb(65,228,255));c.drawCircle(torso.left-torsoW*.38f,ay+torsoH*.27f,overlayMode?4:7,p);

        float moveY=torso.bottom+12;
        if("Orugas".equals(move)){p.setColor(Color.rgb(119,81,190));c.drawRoundRect(new RectF(cx-torsoW*.65f,moveY,cx+torsoW*.65f,moveY+(overlayMode?28:44)),18,18,p);p.setColor(Color.rgb(58,224,255));c.drawRoundRect(new RectF(cx-torsoW*.42f,moveY+8,cx+torsoW*.42f,moveY+(overlayMode?20:31)),10,10,p);}
        else if("Pies".equals(move)){p.setColor(Color.rgb(231,226,247));c.drawRoundRect(new RectF(cx-torsoW*.38f,moveY,cx-torsoW*.05f,moveY+(overlayMode?22:36)),14,14,p);c.drawRoundRect(new RectF(cx+torsoW*.05f,moveY,cx+torsoW*.38f,moveY+(overlayMode?22:36)),14,14,p);}
        else{drawWheel(c,cx-torsoW*.34f,moveY+(overlayMode?18:28));drawWheel(c,cx+torsoW*.34f,moveY+(overlayMode?18:28));}
    }

    private void drawWheel(Canvas c,float x,float y){Paint wheel=new Paint(Paint.ANTI_ALIAS_FLAG);wheel.setShader(new RadialGradient(x,y,28,Color.rgb(151,112,224),Color.rgb(74,50,128),Shader.TileMode.CLAMP));c.drawCircle(x,y,28,wheel);p.setColor(Color.rgb(255,176,88));c.drawCircle(x,y,16,p);p.setColor(Color.rgb(98,216,255));c.drawCircle(x,y,9,p);}
    private void drawBubble(Canvas c,float w,float h){Paint bubble=new Paint(Paint.ANTI_ALIAS_FLAG);bubble.setColor(Color.argb(210,8,12,18));RectF card=new RectF(w*.10f,h*.75f,w*.90f,h*.93f);c.drawRoundRect(card,28,28,bubble);bubble.setStyle(Paint.Style.STROKE);bubble.setStrokeWidth(2f);bubble.setColor(Color.argb(140,96,224,255));c.drawRoundRect(card,28,28,bubble);p.setColor(Color.rgb(231,242,255));p.setTextAlign(Paint.Align.CENTER);p.setTypeface(Typeface.create(Typeface.MONOSPACE,Typeface.BOLD));p.setTextSize(28);drawMultiline(c,displayMessage,w/2f,h*.82f,p,w*.72f,34f);}
    private void drawMultiline(Canvas c,String text,float cx,float startY,Paint paint,float maxWidth,float lineHeight){if(text==null)return;String[]words=text.split(" ");StringBuilder line=new StringBuilder();float y=startY;for(String word:words){String test=line.length()==0?word:line+" "+word;if(paint.measureText(test)>maxWidth&&line.length()>0){c.drawText(line.toString(),cx,y,paint);y+=lineHeight;line=new StringBuilder(word);}else line=new StringBuilder(test);}if(line.length()>0)c.drawText(line.toString(),cx,y,paint);}
}
