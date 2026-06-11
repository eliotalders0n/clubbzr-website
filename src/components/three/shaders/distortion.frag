// Image distortion fragment shader
// Supports ripple, wave, and displacement effects

precision highp float;

uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uMouse;
uniform float uHover;
uniform float uDistortionStrength;
uniform int uEffectType; // 0: ripple, 1: wave, 2: displacement

varying vec2 vUv;

// Simplex noise function
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0+h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Ripple effect from mouse position
vec2 rippleEffect(vec2 uv, vec2 center, float strength, float time) {
  vec2 delta = uv - center;
  float dist = length(delta);
  float wave = sin(dist * 30.0 - time * 5.0) * exp(-dist * 3.0);
  return uv + normalize(delta + 0.001) * wave * strength;
}

// Wave distortion
vec2 waveEffect(vec2 uv, float strength, float time) {
  float waveX = sin(uv.y * 10.0 + time * 2.0) * strength;
  float waveY = cos(uv.x * 10.0 + time * 2.0) * strength;
  return uv + vec2(waveX, waveY);
}

// Noise-based displacement
vec2 displacementEffect(vec2 uv, float strength, float time) {
  float noiseX = snoise(uv * 3.0 + time * 0.5);
  float noiseY = snoise(uv * 3.0 + time * 0.5 + 100.0);
  return uv + vec2(noiseX, noiseY) * strength;
}

// RGB shift for chromatic aberration
vec4 rgbShift(sampler2D tex, vec2 uv, vec2 direction, float strength) {
  float r = texture2D(tex, uv + direction * strength).r;
  float g = texture2D(tex, uv).g;
  float b = texture2D(tex, uv - direction * strength).b;
  float a = texture2D(tex, uv).a;
  return vec4(r, g, b, a);
}

void main() {
  vec2 uv = vUv;
  float effectStrength = uDistortionStrength * uHover;

  // Apply effect based on type
  if (uEffectType == 0) {
    // Ripple from mouse
    uv = rippleEffect(uv, uMouse, effectStrength * 0.02, uTime);
  } else if (uEffectType == 1) {
    // Wave distortion
    uv = waveEffect(uv, effectStrength * 0.02, uTime);
  } else {
    // Noise displacement
    uv = displacementEffect(uv, effectStrength * 0.03, uTime);
  }

  // Add subtle chromatic aberration on hover
  vec2 center = vec2(0.5);
  vec2 direction = normalize(uv - center);
  float aberrationStrength = effectStrength * 0.003;

  vec4 color = rgbShift(uTexture, uv, direction, aberrationStrength);

  // Add subtle vignette
  float vignette = 1.0 - smoothstep(0.4, 0.8, length(vUv - 0.5));
  color.rgb *= mix(1.0, vignette, 0.2);

  gl_FragColor = color;
}
