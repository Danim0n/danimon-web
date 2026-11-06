precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_horizontalScale;
uniform vec2 u_mouse;
varying vec2 v_texCoord;
const bool cursorGlowEnabled = false;

// Simplex noise / procedural fluid wave
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec2 mouse = u_mouse / u_resolution.xy;
    if(length(u_mouse) < 1.0) {
        mouse = vec2(0.5, 0.5);
    }
    st.x = (st.x - 0.5) * u_horizontalScale + 0.5;
    mouse.x = (mouse.x - 0.5) * u_horizontalScale + 0.5;
    
    // Distance distortion from mouse
    float dist = distance(st, mouse);
    vec2 uv = st;
    float influence = (1.0 - smoothstep(0.0, 0.5, dist));
    uv += (st - mouse) * influence * 0.12 * sin(u_time * 2.0 + dist * 10.0);

    float t = u_time * 0.25;
    
    // Layered fbm noise
    float n1 = snoise(uv * 2.0 + vec2(t * 0.4, -t * 0.3));
    float n2 = snoise(uv * 4.5 - vec2(n1 * 0.5, t * 0.5));
    float n3 = snoise(uv * 8.0 + vec2(n2 * 0.3, n1 * 0.3));

    float fluid = n1 * 0.5 + n2 * 0.35 + n3 * 0.15;
    
    // Deep obsidian background colors
    vec3 cBg = vec3(0.02, 0.02, 0.035);
    vec3 cCyan = vec3(0.0, 0.96, 0.83); // #00f5d4
    vec3 cPurple = vec3(0.47, 0.16, 0.79); // #7928ca
    vec3 cPink = vec3(1.0, 0.0, 0.48); // #ff007a

    vec3 col = cBg;
    
    // Energy currents
    float wave1 = smoothstep(0.1, 0.5, fluid);
    float wave2 = smoothstep(-0.2, 0.3, fluid * n2);
    
    col = mix(col, cPurple * 0.4, wave1 * 0.8);
    col = mix(col, cCyan * 0.8, wave2 * 0.65);
    
    // Interactive mouse glow pulse
    if (cursorGlowEnabled) {
        float mouseGlow = exp(-dist * 4.5);
        col += cCyan * mouseGlow * 0.55;
        col += cPink * mouseGlow * 0.35 * (0.5 + 0.5 * sin(u_time * 3.0));
    }

    // Vignette
    float vig = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
    col *= clamp(14.0 * vig, 0.15, 1.0);

    gl_FragColor = vec4(col, 1.0);
}
