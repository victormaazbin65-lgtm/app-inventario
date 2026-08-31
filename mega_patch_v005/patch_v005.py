from pathlib import Path

root = Path('MEGA_v0.01')

# Upgrade the 3D robot: blinking, curious expression, visible hands and more animated movement.
p = root / 'app/src/main/java/com/mega/pet/Mega3DView.java'
s = p.read_text()
s = s.replace(
'''            float eyeH=.13f, eyeW=.10f;
            if ("Serio".equals(mood)) { eyeH=.06f; eyeW=.15f; }
            if ("Dormir".equals(mood)) eyeH=.025f;
            if ("Sorpresa".equals(mood)) { eyeH=.19f; eyeW=.15f; }
            if ("Reír".equals(mood)) eyeH=.08f;
''',
'''            float blink = (float)Math.abs(Math.sin(t*0.82f));
            boolean closed = blink > 0.985f;
            float eyeH=.13f, eyeW=.10f;
            if ("Serio".equals(mood)) { eyeH=.06f; eyeW=.15f; }
            if ("Dormir".equals(mood)) eyeH=.025f;
            if ("Sorpresa".equals(mood)) { eyeH=.19f; eyeW=.15f; }
            if ("Reír".equals(mood)) eyeH=.08f;
            if ("Curioso".equals(mood)) { eyeH=.16f; eyeW=.11f; }
            if ("Cariño".equals(mood)) { eyeH=.11f; eyeW=.10f; }
            if (closed && !"Dormir".equals(mood)) eyeH=.018f;
''')
s = s.replace(
'''            if ("Feliz".equals(mood) || "Reír".equals(mood) || "Cariño".equals(mood))
''',
'''            if ("Feliz".equals(mood) || "Reír".equals(mood) || "Cariño".equals(mood) || "Curioso".equals(mood))
''')
s = s.replace(
'''            draw(cube,-1.02f,bodyY+.15f,0,.20f,.90f,.20f,0,0,-8f+armSwing,color(.22f,.28f,.36f));
            draw(cube,1.02f,bodyY+.15f,0,.20f,.90f,.20f,0,0,8f-armSwing,color(.22f,.28f,.36f));
''',
'''            draw(cube,-1.02f,bodyY+.15f,0,.20f,.90f,.20f,0,0,-8f+armSwing,color(.22f,.28f,.36f));
            draw(cube,1.02f,bodyY+.15f,0,.20f,.90f,.20f,0,0,8f-armSwing,color(.22f,.28f,.36f));
            // hands
            draw(sphere,-1.18f,bodyY-.22f,.03f,.15f,.15f,.15f,0,0,0,color(.72f,.80f,.88f));
            draw(sphere,1.18f,bodyY-.22f,.03f,.15f,.15f,.15f,0,0,0,color(.72f,.80f,.88f));
''')
s = s.replace(
'''            float turn = 5f*(float)Math.sin(t*.6f);
''',
'''            float turn = 7f*(float)Math.sin(t*.55f);
            if ("Curioso".equals(mood)) turn += 7f*(float)Math.sin(t*1.25f);
''')
p.write_text(s)

# Upgrade overlay intelligence: connectivity awareness + autonomous little comments.
p = root / 'app/src/main/java/com/mega/pet/OverlayService.java'
s = p.read_text()
if 'import android.net.*;' not in s:
    s = s.replace('import android.graphics.PixelFormat;\n', 'import android.graphics.PixelFormat;\nimport android.net.*;\n')
s = s.replace('h.postDelayed(this, 15*60*1000L);', '''
                try {
                    ConnectivityManager cm=(ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);
                    boolean online=false;
                    if(cm!=null){
                        Network n=cm.getActiveNetwork();
                        NetworkCapabilities cp=n==null?null:cm.getNetworkCapabilities(n);
                        online=cp!=null && cp.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
                    }
                    if(!online && bubble!=null){
                        bubble.setMood("Serio");
                        bubble.setMessage("No tenemos internet ahora mismo.");
                    } else if(bubble!=null && System.currentTimeMillis()%3==0){
                        bubble.setMood("Curioso");
                        bubble.setMessage("Estoy mirando tu pantalla… ¿qué aprenderemos hoy?");
                    }
                } catch(Exception ignored) {}
                h.postDelayed(this, 5*60*1000L);''')
p.write_text(s)
