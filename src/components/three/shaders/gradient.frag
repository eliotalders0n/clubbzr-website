// Animated gradient background fragment shader
// Creates flowing, organic gradient backgrounds

precision highp float;

uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uSpeed;
uniform float uComplexity;
uniform int uPattern; // 0: flow, 1: radial, 2: mesh, 3: aurora

varying vec2 vUv;

// Simplex noise
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

// Fractal Brownian Motion
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value;
}

// Flow pattern - organic flowing gradients
vec3 flowPattern(vec2 uv, float time) {
  // Create flowing distortion
  vec2 distortion = vec2(
    fbm(uv * uComplexity + vec2(time * uSpeed, 0.0), 4),
    fbm(uv * uComplexity + vec2(0.0, time * uSpeed), 4)
  );

  vec2 distortedUv = uv + distortion * 0.3;

  // Create color mixing
  float n1 = fbm(distortedUv * 2.0 + time * uSpeed * 0.5, 4) * 0.5 + 0.5;
  float n2 = fbm(distortedUv * 1.5 - time * uSpeed * 0.3, 4) * 0.5 + 0.5;

  // Four-color gradient
  vec3 col1 = mix(uColor1, uColor2, n1);
  vec3 col2 = mix(uColor3, uColor4, n2);

  return mix(col1, col2, fbm(distortedUv + time * uSpeed * 0.2, 3) * 0.5 + 0.5);
}

// Radial pattern - pulsing radial gradients
vec3 radialPattern(vec2 uv, float time) {
  vec2 center = vec2(0.5);
  float dist = length(uv - center);

  // Multiple radial waves
  float wave1 = sin(dist * 10.0 * uComplexity - time * uSpeed * 2.0) * 0.5 + 0.5;
  float wave2 = sin(dist * 15.0 * uComplexity - time * uSpeed * 1.5 + 1.57) * 0.5 + 0.5;

  // Add noise variation
  float noise = fbm(uv * 3.0 + time * uSpeed * 0.5, 3) * 0.5 + 0.5;

  // Color mixing
  vec3 col1 = mix(uColor1, uColor2, wave1);
  vec3 col2 = mix(uColor3, uColor4, wave2);

  return mix(col1, col2, noise);
}

// Mesh gradient - smooth blended areas
vec3 meshPattern(vec2 uv, float time) {
  // Define gradient centers that move over time
  vec2 c1 = vec2(0.3 + sin(time * uSpeed * 0.5) * 0.2, 0.3 + cos(time * uSpeed * 0.7) * 0.2);
  vec2 c2 = vec2(0.7 + cos(time * uSpeed * 0.6) * 0.2, 0.3 + sin(time * uSpeed * 0.4) * 0.2);
  vec2 c3 = vec2(0.5 + sin(time * uSpeed * 0.8) * 0.2, 0.7 + cos(time * uSpeed * 0.5) * 0.2);
  vec2 c4 = vec2(0.2 + cos(time * uSpeed * 0.4) * 0.2, 0.6 + sin(time * uSpeed * 0.6) * 0.2);

  // Calculate influence of each color based on distance
  float d1 = 1.0 / (length(uv - c1) + 0.1);
  float d2 = 1.0 / (length(uv - c2) + 0.1);
  float d3 = 1.0 / (length(uv - c3) + 0.1);
  float d4 = 1.0 / (length(uv - c4) + 0.1);

  float total = d1 + d2 + d3 + d4;

  // Weighted color mix
  vec3 color = (uColor1 * d1 + uColor2 * d2 + uColor3 * d3 + uColor4 * d4) / total;

  // Add subtle noise variation
  float noise = fbm(uv * uComplexity + time * uSpeed * 0.3, 2) * 0.1;
  color += noise;

  return color;
}

// Aurora pattern - flowing aurora-like bands
vec3 auroraPattern(vec2 uv, float time) {
  // Create flowing bands
  float y = uv.y;
  float x = uv.x;

  // Multiple wave layers
  float wave1 = sin(x * 3.0 * uComplexity + time * uSpeed + fbm(vec2(x, time * 0.1), 3) * 2.0);
  float wave2 = sin(x * 5.0 * uComplexity + time * uSpeed * 1.3 + fbm(vec2(x + 10.0, time * 0.15), 3) * 2.0);
  float wave3 = sin(x * 2.0 * uComplexity + time * uSpeed * 0.7 + fbm(vec2(x + 20.0, time * 0.12), 3) * 2.0);

  // Create bands based on y position
  float band1 = smoothstep(0.0, 0.1, 1.0 - abs(y - 0.3 - wave1 * 0.1));
  float band2 = smoothstep(0.0, 0.15, 1.0 - abs(y - 0.5 - wave2 * 0.15));
  float band3 = smoothstep(0.0, 0.1, 1.0 - abs(y - 0.7 - wave3 * 0.1));

  // Mix colors with bands
  vec3 color = uColor1 * 0.3; // Base dark color
  color = mix(color, uColor2, band1 * 0.6);
  color = mix(color, uColor3, band2 * 0.7);
  color = mix(color, uColor4, band3 * 0.5);

  // Add glow
  float glow = (band1 + band2 + band3) * 0.3;
  color += vec3(glow);

  return color;
}

void main() {
  vec3 color;

  if (uPattern == 0) {
    color = flowPattern(vUv, uTime);
  } else if (uPattern == 1) {
    color = radialPattern(vUv, uTime);
  } else if (uPattern == 2) {
    color = meshPattern(vUv, uTime);
  } else {
    color = auroraPattern(vUv, uTime);
  }

  // Add subtle grain for texture
  float grain = (fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.02;
  color += grain;

  // Ensure colors stay in valid range
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
