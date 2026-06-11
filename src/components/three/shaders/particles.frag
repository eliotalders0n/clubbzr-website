// Custom particle fragment shader
// Renders particles with various shapes and effects

precision highp float;

uniform int uShape; // 0: circle, 1: square, 2: triangle, 3: organic blob, 4: ring
uniform float uTime;
uniform float uGlow;
uniform float uSoftness;

varying vec3 vColor;
varying float vAlpha;
varying float vDepth;

// Simplex noise for organic shapes
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
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

// SDF functions
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

// Organic blob using noise-deformed circle
float sdBlob(vec2 p, float r, float time) {
  float angle = atan(p.y, p.x);
  float noise = snoise(vec2(angle * 2.0, time * 0.5)) * 0.3;
  float deformedR = r * (1.0 + noise);
  return length(p) - deformedR;
}

void main() {
  // Center UV coordinates
  vec2 uv = gl_PointCoord * 2.0 - 1.0;

  float dist;

  // Select shape
  if (uShape == 0) {
    // Circle
    dist = sdCircle(uv, 0.8);
  } else if (uShape == 1) {
    // Square (rotated 45 degrees for diamond)
    float angle = 0.785398; // 45 degrees
    vec2 rotated = vec2(
      uv.x * cos(angle) - uv.y * sin(angle),
      uv.x * sin(angle) + uv.y * cos(angle)
    );
    dist = sdSquare(rotated, 0.5);
  } else if (uShape == 2) {
    // Triangle
    dist = sdTriangle(uv, 0.7);
  } else if (uShape == 3) {
    // Organic blob
    dist = sdBlob(uv, 0.6, uTime + vDepth);
  } else {
    // Ring
    dist = sdRing(uv, 0.5, 0.15);
  }

  // Apply softness to edge
  float alpha = 1.0 - smoothstep(-uSoftness, uSoftness, dist);

  // Discard fully transparent pixels
  if (alpha < 0.01) discard;

  // Apply glow effect
  float glow = exp(-dist * 3.0) * uGlow;

  // Final color with glow
  vec3 finalColor = vColor + vColor * glow;

  // Apply depth-based alpha
  alpha *= vAlpha;

  // Add subtle gradient from center
  float centerGradient = 1.0 - length(uv) * 0.3;
  finalColor *= centerGradient;

  gl_FragColor = vec4(finalColor, alpha);
}
