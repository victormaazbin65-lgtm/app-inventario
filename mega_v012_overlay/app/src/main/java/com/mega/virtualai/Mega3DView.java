package com.mega.virtualai;

import android.content.Context;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import android.view.MotionEvent;
import java.nio.*;
import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

public class Mega3DView extends GLSurfaceView {
    private final RobotRenderer renderer;
    private float downX, lastX;

    public Mega3DView(Context c){
        super(c); setEGLContextClientVersion(2); renderer=new RobotRenderer(); setRenderer(renderer); setRenderMode(RENDERMODE_CONTINUOUSLY); setPreserveEGLContextOnPause(true);
    }
    public void setRobot(String body,String move){queueEvent(()->{renderer.body=body;renderer.move=move;});}
    public void setWorld(String world){queueEvent(()->renderer.world=world);}
    public void setMood(String mood){queueEvent(()->renderer.mood=mood);}

    @Override public boolean onTouchEvent(MotionEvent e){
        switch(e.getActionMasked()){
            case MotionEvent.ACTION_DOWN: downX=lastX=e.getX(); return true;
            case MotionEvent.ACTION_MOVE: float dx=e.getX()-lastX; lastX=e.getX(); queueEvent(()->renderer.userTurn=Math.max(-36f,Math.min(36f,renderer.userTurn+dx*.18f))); return true;
            case MotionEvent.ACTION_UP: if(Math.abs(e.getX()-downX)<18){queueEvent(()->renderer.interactUntil=System.currentTimeMillis()+1800);} return true;
        } return true;
    }

    private static class RobotRenderer implements Renderer {
        private int program,aPos,uMvp,uColor; private final float[] projection=new float[16],view=new float[16],model=new float[16],mvp=new float[16],pv=new float[16]; private Mesh cube,sphere;
        volatile String body="MEGA Neo",move="Ruedas",world="Mundo pastel",mood="Curioso"; volatile float userTurn=0; volatile long interactUntil=0; private long start=System.currentTimeMillis();
        private static final String VS="uniform mat4 uMVP;attribute vec3 aPos;void main(){gl_Position=uMVP*vec4(aPos,1.0);}";
        private static final String FS="precision mediump float;uniform vec4 uColor;void main(){gl_FragColor=uColor;}";

        @Override public void onSurfaceCreated(GL10 gl,EGLConfig cfg){GLES20.glEnable(GLES20.GL_DEPTH_TEST);GLES20.glEnable(GLES20.GL_CULL_FACE);program=link(VS,FS);aPos=GLES20.glGetAttribLocation(program,"aPos");uMvp=GLES20.glGetUniformLocation(program,"uMVP");uColor=GLES20.glGetUniformLocation(program,"uColor");cube=Mesh.cube();sphere=Mesh.sphere(24,24);}
        @Override public void onSurfaceChanged(GL10 gl,int w,int h){GLES20.glViewport(0,0,w,h);float ratio=(float)w/Math.max(1,h);Matrix.perspectiveM(projection,0,39f,ratio,.1f,100f);Matrix.setLookAtM(view,0,0,2.0f,8.7f,0,.65f,0,0,1,0);Matrix.multiplyMM(pv,0,projection,0,view,0);}
        @Override public void onDrawFrame(GL10 gl){setSky();GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT|GLES20.GL_DEPTH_BUFFER_BIT);GLES20.glUseProgram(program);float t=(System.currentTimeMillis()-start)/1000f;drawWorld(t);drawRobot(t);}

        private void setSky(){
            if("Jardín digital".equals(world)||"Campo".equals(world)) GLES20.glClearColor(.18f,.13f,.28f,1);
            else if("Ciudad futurista".equals(world)||"Ciudad moderna".equals(world)) GLES20.glClearColor(.07f,.08f,.20f,1);
            else GLES20.glClearColor(.21f,.12f,.34f,1);
        }

        private void drawWorld(float t){
            float[] ground=("Jardín digital".equals(world)||"Campo".equals(world))?color(.23f,.46f,.32f):("Ciudad futurista".equals(world)||"Ciudad moderna".equals(world))?color(.13f,.12f,.26f):color(.39f,.28f,.58f);
            draw(cube,0,-1.22f,0,5.4f,.08f,5.4f,0,0,0,ground);
            draw(cube,0,-1.14f,.5f,1.7f,.025f,4.7f,0,0,0,color(.34f,.75f,.92f));
            if("Jardín digital".equals(world)||"Campo".equals(world)){
                for(int i=-3;i<=3;i+=2){float x=i*1.05f;draw(cube,x,-.62f,-2.2f,.13f,.95f,.13f,0,0,0,color(.37f,.24f,.28f));draw(sphere,x,.15f,-2.2f,.72f,.72f,.72f,0,0,0,color(.35f,.78f,.49f));}
                for(int i=-2;i<=2;i++){draw(sphere,i*.9f,-.98f,-.4f,.12f,.12f,.12f,0,0,0,color(.95f,.62f,.85f));}
            }else{
                for(int i=-4;i<=4;i++){float hh=1.5f+((i+4)%4)*.42f;float z=-2.55f-((i&1)*.32f);float r=.24f+.035f*((i+4)%3),g=.22f+.03f*((i+5)%4),b=.46f+.045f*((i+2)%3);draw(cube,i*.9f,-1.1f+hh/2,z,.62f,hh,.62f,0,0,0,color(r,g,b));for(int y=0;y<3;y++)draw(cube,i*.9f,-.55f+y*.38f,z+.33f,.24f,.07f,.03f,0,0,0,color(.22f,.87f,1f));}
            }
            float bob=.15f*(float)Math.sin(t*.8f);
            draw(sphere,-2.8f,1.8f,-1.2f,.22f,.22f,.22f,0,0,0,color(1f,.72f,.30f));
            draw(sphere,2.65f,1.25f+bob,-1.6f,.18f,.18f,.18f,0,0,0,color(.44f,.92f,1f));
            draw(sphere,1.95f,2.2f,-2f,.12f,.12f,.12f,0,0,0,color(.95f,.47f,.76f));
        }

        private void drawRobot(float t){
            boolean touched=System.currentTimeMillis()<interactUntil;
            float bob=.055f*(float)Math.sin(t*2.1f)+(touched?.11f*Math.abs((float)Math.sin(t*7f)):0);
            if("Reír".equals(mood))bob+=.09f*Math.abs((float)Math.sin(t*6f)); if("Dormir".equals(mood))bob=-.08f+.018f*(float)Math.sin(t);
            float turn=userTurn+7f*(float)Math.sin(t*.42f); float bodyY=-.12f+bob;
            float[] white=color(.92f,.91f,.98f), lavender=color(.55f,.40f,.88f), purple=color(.40f,.25f,.72f), gold=color(1f,.63f,.28f), cyan=color(.18f,.91f,1f), dark=color(.018f,.023f,.055f), pink=color(1f,.30f,.62f);

            draw(sphere,0,-.78f,0,1.15f,.46f,.78f,0,turn,0,white);
            float spin=(t*110f)%360f;
            if("Ruedas".equals(move)){
                draw(sphere,-.67f,-1.02f,.04f,.62f,.62f,.29f,spin,turn,0,lavender); draw(sphere,.67f,-1.02f,.04f,.62f,.62f,.29f,spin,turn,0,lavender);
                draw(sphere,-.67f,-1.02f,.32f,.29f,.29f,.05f,0,turn,0,gold); draw(sphere,.67f,-1.02f,.32f,.29f,.29f,.05f,0,turn,0,gold);
                draw(sphere,-.67f,-1.02f,.39f,.17f,.17f,.03f,0,turn,0,cyan); draw(sphere,.67f,-1.02f,.39f,.17f,.17f,.03f,0,turn,0,cyan);
            }else if("Orugas".equals(move)){
                draw(cube,-.68f,-1.02f,0,.54f,.62f,.85f,0,turn,0,purple);draw(cube,.68f,-1.02f,0,.54f,.62f,.85f,0,turn,0,purple);for(int j=-1;j<=1;j++){draw(sphere,-.68f,-1.02f,.45f+j*.08f,.17f,.17f,.04f,0,turn,0,cyan);draw(sphere,.68f,-1.02f,.45f+j*.08f,.17f,.17f,.04f,0,turn,0,cyan);}
            }else{
                float step=.10f*(float)Math.sin(t*2.4f);draw(cube,-.42f,-.95f+step,0,.26f,.62f,.30f,0,turn,0,white);draw(cube,.42f,-.95f-step,0,.26f,.62f,.30f,0,turn,0,white);draw(sphere,-.42f,-1.23f+step,.18f,.50f,.18f,.42f,0,turn,0,lavender);draw(sphere,.42f,-1.23f-step,.18f,.50f,.18f,.42f,0,turn,0,lavender);
            }

            draw(sphere,0,bodyY,0,1.12f,1.25f,.78f,0,turn,0,white);
            draw(sphere,0,bodyY+.08f,.72f,.75f,.46f,.08f,0,turn,0,gold);
            draw(cube,0,bodyY+.08f,.79f,1.05f,.50f,.055f,0,turn,0,dark);
            draw(cube,0,bodyY+.08f,.855f,.68f,.22f,.025f,0,turn,0,cyan);
            draw(sphere,0,bodyY-.58f,.69f,.27f,.12f,.05f,0,turn,0,cyan);
            draw(sphere,0,bodyY+.83f,0,.36f,.25f,.34f,0,turn,0,purple);

            draw(sphere,0,bodyY+1.72f,0,1.48f,1.02f,.86f,0,turn,0,white);
            draw(cube,0,bodyY+1.72f,.77f,1.58f,.69f,.06f,0,turn,0,gold);
            draw(cube,0,bodyY+1.72f,.845f,1.43f,.59f,.055f,0,turn,0,dark);
            draw(sphere,-1.33f,bodyY+1.72f,0,.30f,.43f,.34f,0,turn,0,lavender);draw(sphere,1.33f,bodyY+1.72f,0,.30f,.43f,.34f,0,turn,0,lavender);
            draw(sphere,-1.42f,bodyY+1.72f,.10f,.18f,.25f,.18f,0,turn,0,cyan);draw(sphere,1.42f,bodyY+1.72f,.10f,.18f,.25f,.18f,0,turn,0,gold);
            draw(cube,.46f,bodyY+2.58f,0,.12f,.42f,.12f,0,turn,-10f,purple);draw(sphere,.53f,bodyY+2.90f,0,.35f,.35f,.35f,0,turn,0,gold);

            float blink=(float)Math.abs(Math.sin(t*.83f));boolean closed=blink>.986f;float eyeH=.23f,eyeW=.22f;
            if("Serio".equals(mood)){eyeH=.10f;eyeW=.25f;} if("Dormir".equals(mood))eyeH=.035f; if("Sorpresa".equals(mood)){eyeH=.28f;eyeW=.26f;} if("Reír".equals(mood))eyeH=.09f; if(closed&&!"Dormir".equals(mood))eyeH=.025f;
            draw(sphere,-.43f,bodyY+1.82f,.91f,eyeW,eyeH,.055f,0,turn,0,cyan);draw(sphere,.43f,bodyY+1.82f,.91f,eyeW,eyeH,.055f,0,turn,0,cyan);
            if(eyeH>.08f){draw(sphere,-.36f,bodyY+1.91f,.95f,.055f,.055f,.025f,0,turn,0,white);draw(sphere,.50f,bodyY+1.91f,.95f,.055f,.055f,.025f,0,turn,0,white);}
            draw(cube,-.86f,bodyY+1.52f,.91f,.22f,.055f,.035f,0,turn,0,pink);draw(cube,.86f,bodyY+1.52f,.91f,.22f,.055f,.035f,0,turn,0,pink);
            if("Sorpresa".equals(mood))draw(sphere,0,bodyY+1.47f,.92f,.14f,.18f,.04f,0,turn,0,cyan); else if("Serio".equals(mood))draw(cube,0,bodyY+1.46f,.92f,.36f,.035f,.035f,0,turn,0,cyan); else draw(sphere,0,bodyY+1.47f,.92f,.30f,.13f,.035f,0,turn,0,cyan);

            float wave=("Feliz".equals(mood)||"Cariño".equals(mood)||touched)?28f*(float)Math.sin(t*5f):7f*(float)Math.sin(t*1.8f);
            draw(sphere,-1.00f,bodyY+.38f,0,.38f,.38f,.38f,0,turn,0,gold);draw(sphere,1.00f,bodyY+.38f,0,.38f,.38f,.38f,0,turn,0,gold);
            draw(cube,-1.15f,bodyY+.06f,0,.25f,.62f,.25f,0,turn,-16f-wave,lavender);draw(cube,1.15f,bodyY+.06f,0,.25f,.62f,.25f,0,turn,16f+wave*.25f,lavender);
            draw(cube,-1.27f,bodyY-.38f,.03f,.22f,.48f,.22f,0,turn,-8f-wave*.6f,white);draw(cube,1.27f,bodyY-.38f,.03f,.22f,.48f,.22f,0,turn,8f+wave*.15f,white);
            drawHand(-1.38f,bodyY-.70f,.12f,turn,white,cyan);drawHand(1.38f,bodyY-.70f,.12f,turn,white,gold);
        }

        private void drawHand(float x,float y,float z,float turn,float[] white,float[] accent){
            draw(sphere,x,y,z,.28f,.28f,.20f,0,turn,0,white);draw(sphere,x,y,z+.18f,.12f,.12f,.04f,0,turn,0,accent);
            float dir=x<0?-1:1; for(int i=-1;i<=1;i++)draw(sphere,x+dir*.20f,y+.18f+i*.10f,z,.10f,.18f,.10f,0,turn,0,white);
        }

        private void draw(Mesh mesh,float tx,float ty,float tz,float sx,float sy,float sz,float rx,float ry,float rz,float[] color){Matrix.setIdentityM(model,0);Matrix.translateM(model,0,tx,ty,tz);Matrix.rotateM(model,0,rx,1,0,0);Matrix.rotateM(model,0,ry,0,1,0);Matrix.rotateM(model,0,rz,0,0,1);Matrix.scaleM(model,0,sx,sy,sz);Matrix.multiplyMM(mvp,0,pv,0,model,0);GLES20.glUniformMatrix4fv(uMvp,1,false,mvp,0);GLES20.glUniform4fv(uColor,1,color,0);mesh.draw(aPos);}
        private static float[] color(float r,float g,float b){return new float[]{r,g,b,1};}
        private static int compile(int type,String src){int s=GLES20.glCreateShader(type);GLES20.glShaderSource(s,src);GLES20.glCompileShader(s);return s;}
        private static int link(String vs,String fs){int p=GLES20.glCreateProgram();GLES20.glAttachShader(p,compile(GLES20.GL_VERTEX_SHADER,vs));GLES20.glAttachShader(p,compile(GLES20.GL_FRAGMENT_SHADER,fs));GLES20.glLinkProgram(p);return p;}
    }

    private static class Mesh {
        final FloatBuffer v; final ShortBuffer i; final int count;
        Mesh(float[] verts,short[] inds){v=ByteBuffer.allocateDirect(verts.length*4).order(ByteOrder.nativeOrder()).asFloatBuffer();v.put(verts).position(0);i=ByteBuffer.allocateDirect(inds.length*2).order(ByteOrder.nativeOrder()).asShortBuffer();i.put(inds).position(0);count=inds.length;}
        void draw(int aPos){GLES20.glEnableVertexAttribArray(aPos);GLES20.glVertexAttribPointer(aPos,3,GLES20.GL_FLOAT,false,12,v);GLES20.glDrawElements(GLES20.GL_TRIANGLES,count,GLES20.GL_UNSIGNED_SHORT,i);GLES20.glDisableVertexAttribArray(aPos);}
        static Mesh cube(){float[]v={-.5f,-.5f,.5f,.5f,-.5f,.5f,.5f,.5f,.5f,-.5f,.5f,.5f,-.5f,-.5f,-.5f,-.5f,.5f,-.5f,.5f,.5f,-.5f,.5f,-.5f,-.5f,-.5f,.5f,-.5f,-.5f,.5f,.5f,.5f,.5f,.5f,.5f,.5f,-.5f,-.5f,-.5f,-.5f,.5f,-.5f,.5f,.5f,-.5f,.5f,-.5f,.5f,.5f,-.5f,-.5f,.5f,.5f,-.5f,.5f,.5f,.5f,.5f,-.5f,.5f,-.5f,-.5f,-.5f,-.5f,-.5f,.5f,-.5f,.5f,.5f,-.5f};short[]idx=new short[36];int k=0;for(short f=0;f<6;f++){short b=(short)(f*4);idx[k++]=b;idx[k++]=(short)(b+1);idx[k++]=(short)(b+2);idx[k++]=b;idx[k++]=(short)(b+2);idx[k++]=(short)(b+3);}return new Mesh(v,idx);}
        static Mesh sphere(int stacks,int slices){int vc=(stacks+1)*(slices+1);float[]vv=new float[vc*3];int p=0;for(int y=0;y<=stacks;y++){float vy=(float)y/stacks;double phi=Math.PI*vy;for(int x=0;x<=slices;x++){float vx=(float)x/slices;double th=2*Math.PI*vx;vv[p++]=(float)(Math.sin(phi)*Math.cos(th))*.5f;vv[p++]=(float)Math.cos(phi)*.5f;vv[p++]=(float)(Math.sin(phi)*Math.sin(th))*.5f;}}short[]ii=new short[stacks*slices*6];p=0;for(int y=0;y<stacks;y++)for(int x=0;x<slices;x++){short a=(short)(y*(slices+1)+x),b=(short)(a+slices+1);ii[p++]=a;ii[p++]=b;ii[p++]=(short)(a+1);ii[p++]=(short)(a+1);ii[p++]=b;ii[p++]=(short)(b+1);}return new Mesh(vv,ii);}
    }
}
