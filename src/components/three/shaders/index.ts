// =============================================================================
// GLSL Shader Utilities for Club BZR
// =============================================================================

/**
 * Simplex noise function (2D)
 * Inline version for use in shader strings
 */
export const simplexNoise2D = /* glsl */ `
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0+h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

/**
 * Simplex noise function (3D)
 */
export const simplexNoise3D = /* glsl */ `
vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

/**
 * Curl noise for fluid-like motion
 */
export const curlNoise = /* glsl */ `
vec3 curlNoise(vec3 p) {
  const float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);

  float n1 = snoise(p + dy) - snoise(p - dy);
  float n2 = snoise(p + dz) - snoise(p - dz);
  float n3 = snoise(p + dz) - snoise(p - dz);
  float n4 = snoise(p + dx) - snoise(p - dx);
  float n5 = snoise(p + dx) - snoise(p - dx);
  float n6 = snoise(p + dy) - snoise(p - dy);

  return normalize(vec3(n1 - n2, n3 - n4, n5 - n6));
}
`;

/**
 * Fractal Brownian Motion
 */
export const fbm = /* glsl */ `
float fbm(vec2 p, int octaves, float persistence) {
  float value = 0.0;
  float amplitude = 1.0;
  float frequency = 1.0;
  float maxValue = 0.0;

  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2.0;
  }

  return value / maxValue;
}
`;

/**
 * SDF shape functions
 */
export const sdfShapes = /* glsl */ `
float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdSquare(vec2 p, float s) {
  vec2 d = abs(p) - vec2(s);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdTriangle(vec2 p, float r) {
  const float k = sqrt(3.0);
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

float sdRing(vec2 p, float r, float w) {
  return abs(length(p) - r) - w;
}
`;

/**
 * RGB shift / chromatic aberration
 */
export const rgbShift = /* glsl */ `
vec4 rgbShift(sampler2D tex, vec2 uv, vec2 direction, float strength) {
  float r = texture2D(tex, uv + direction * strength).r;
  float g = texture2D(tex, uv).g;
  float b = texture2D(tex, uv - direction * strength).b;
  float a = texture2D(tex, uv).a;
  return vec4(r, g, b, a);
}
`;

/**
 * Distortion effects
 */
export const distortionEffects = /* glsl */ `
// Ripple effect from point
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
`;

/**
 * Vignette effect
 */
export const vignette = /* glsl */ `
float vignette(vec2 uv, float intensity, float smoothness) {
  vec2 center = vec2(0.5);
  float dist = length(uv - center);
  return 1.0 - smoothstep(smoothness, 1.0, dist * intensity);
}
`;

/**
 * Color utilities
 */
export const colorUtils = /* glsl */ `
// Convert RGB to HSV
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// Convert HSV to RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Blend modes
vec3 blendMultiply(vec3 base, vec3 blend) {
  return base * blend;
}

vec3 blendScreen(vec3 base, vec3 blend) {
  return 1.0 - (1.0 - base) * (1.0 - blend);
}

vec3 blendOverlay(vec3 base, vec3 blend) {
  return mix(
    2.0 * base * blend,
    1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
    step(0.5, base)
  );
}
`;

// =============================================================================
// Shader builder utilities
// =============================================================================

/**
 * Combine shader chunks
 */
export const combineShaderChunks = (...chunks: string[]): string => {
  return chunks.join('\n\n');
};

/**
 * Create basic vertex shader
 */
export const createBasicVertexShader = (
  additionalCode: string = ''
): string => /* glsl */ `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  ${additionalCode}
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Create basic fragment shader with noise
 */
export const createNoiseFragmentShader = (
  mainFunction: string
): string => /* glsl */ `
precision highp float;

${simplexNoise2D}

uniform float uTime;
varying vec2 vUv;
varying vec3 vPosition;

${mainFunction}
`;
