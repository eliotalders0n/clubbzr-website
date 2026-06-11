'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// =============================================================================
// Types
// =============================================================================

export type ParticleShape = 'circle' | 'square' | 'triangle' | 'blob' | 'ring';
export type InteractionMode = 'repel' | 'attract' | 'follow' | 'none';

export interface ParticleFieldProps {
  count?: number;
  colors?: string[];
  size?: number | [number, number];
  shape?: ParticleShape;
  interactionMode?: InteractionMode;
  mouseRadius?: number;
  spread?: [number, number, number];
  noiseScale?: number;
  noiseSpeed?: number;
  noiseStrength?: number;
  opacity?: number;
  glow?: number;
  softness?: number;
  depthWrite?: boolean;
}

// =============================================================================
// Shader Code
// =============================================================================

const vertexShader = /* glsl */ `
  attribute float aScale;
  attribute vec3 aColor;
  attribute float aRandomSeed;

  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uMouseRadius;
  uniform int uInteractionMode;
  uniform float uNoiseScale;
  uniform float uNoiseSpeed;
  uniform float uNoiseStrength;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vDepth;

  // Simplex noise
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

  // Curl noise for smooth movement
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

  void main() {
    vec3 pos = position;

    // Add noise-based movement
    float timeOffset = aRandomSeed * 100.0;
    vec3 noisePos = pos * uNoiseScale + vec3(uTime * uNoiseSpeed + timeOffset);
    vec3 curl = curlNoise(noisePos);
    pos += curl * uNoiseStrength;

    // Add gentle floating motion
    pos.y += sin(uTime * 0.5 + aRandomSeed * 6.28) * 0.1;
    pos.x += cos(uTime * 0.3 + aRandomSeed * 6.28) * 0.05;

    // Mouse interaction
    if (uInteractionMode != 3) { // 3 = none
      vec3 mousePos = vec3(uMouse, 0.0);
      vec3 toMouse = mousePos - pos;
      float dist = length(toMouse.xy);

      if (dist < uMouseRadius) {
        float strength = 1.0 - (dist / uMouseRadius);
        strength = strength * strength;
        vec3 direction = normalize(toMouse + vec3(0.001));

        if (uInteractionMode == 0) {
          pos -= direction * strength * 0.5;
        } else if (uInteractionMode == 1) {
          pos += direction * strength * 0.3;
        } else if (uInteractionMode == 2) {
          float angle = atan(toMouse.y, toMouse.x) + uTime * 2.0;
          pos.xy = mousePos.xy + vec2(cos(angle), sin(angle)) * dist * (1.0 - strength * 0.5);
        }
      }
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aScale * 50.0 * (1.0 / -mvPosition.z);

    vColor = aColor;
    vAlpha = 1.0 - smoothstep(0.0, 15.0, -mvPosition.z);
    vDepth = -mvPosition.z;
  }
`;

const fragmentShader = /* glsl */ `
  uniform int uShape;
  uniform float uTime;
  uniform float uGlow;
  uniform float uSoftness;
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vDepth;

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

  float sdCircle(vec2 p, float r) { return length(p) - r; }

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

  float sdRing(vec2 p, float r, float w) { return abs(length(p) - r) - w; }

  float sdBlob(vec2 p, float r, float time) {
    float angle = atan(p.y, p.x);
    float noise = snoise(vec2(angle * 2.0, time * 0.5)) * 0.3;
    float deformedR = r * (1.0 + noise);
    return length(p) - deformedR;
  }

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float dist;

    if (uShape == 0) {
      dist = sdCircle(uv, 0.8);
    } else if (uShape == 1) {
      float angle = 0.785398;
      vec2 rotated = vec2(
        uv.x * cos(angle) - uv.y * sin(angle),
        uv.x * sin(angle) + uv.y * cos(angle)
      );
      dist = sdSquare(rotated, 0.5);
    } else if (uShape == 2) {
      dist = sdTriangle(uv, 0.7);
    } else if (uShape == 3) {
      dist = sdBlob(uv, 0.6, uTime + vDepth);
    } else {
      dist = sdRing(uv, 0.5, 0.15);
    }

    float alpha = 1.0 - smoothstep(-uSoftness, uSoftness, dist);
    if (alpha < 0.01) discard;

    float glow = exp(-dist * 3.0) * uGlow;
    vec3 finalColor = vColor + vColor * glow;

    alpha *= vAlpha * uOpacity;
    float centerGradient = 1.0 - length(uv) * 0.3;
    finalColor *= centerGradient;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// =============================================================================
// Shape to uniform mapping
// =============================================================================

const shapeToUniform: Record<ParticleShape, number> = {
  circle: 0,
  square: 1,
  triangle: 2,
  blob: 3,
  ring: 4,
};

const interactionToUniform: Record<InteractionMode, number> = {
  repel: 0,
  attract: 1,
  follow: 2,
  none: 3,
};

// =============================================================================
// ParticleField Component
// =============================================================================

export const ParticleField: React.FC<ParticleFieldProps> = ({
  count = 1000,
  colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7'],
  size = [0.02, 0.08],
  shape = 'circle',
  interactionMode = 'repel',
  mouseRadius = 2,
  spread = [10, 10, 5],
  noiseScale = 0.5,
  noiseSpeed = 0.2,
  noiseStrength = 0.5,
  opacity = 1,
  glow = 0.3,
  softness = 0.1,
  depthWrite = false,
}) => {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2(0, 0));
  const { viewport, size: canvasSize } = useThree();

  // Parse colors to THREE.Color
  const parsedColors = useMemo(
    () => colors.map((c) => new THREE.Color(c)),
    [colors]
  );

  // Generate particle attributes
  const { positions, scales, colorAttributes, randomSeeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const colorAttributes = new Float32Array(count * 3);
    const randomSeeds = new Float32Array(count);

    const [minSize, maxSize] = Array.isArray(size) ? size : [size, size];

    for (let i = 0; i < count; i++) {
      // Position
      positions[i * 3] = (Math.random() - 0.5) * spread[0];
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread[1];
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread[2];

      // Scale
      scales[i] = minSize + Math.random() * (maxSize - minSize);

      // Color
      const color = parsedColors[Math.floor(Math.random() * parsedColors.length)];
      colorAttributes[i * 3] = color.r;
      colorAttributes[i * 3 + 1] = color.g;
      colorAttributes[i * 3 + 2] = color.b;

      // Random seed for noise offset
      randomSeeds[i] = Math.random();
    }

    return { positions, scales, colorAttributes, randomSeeds };
  }, [count, size, spread, parsedColors]);

  // Mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Convert screen coordinates to normalized device coordinates
      const x = (e.clientX / canvasSize.width) * 2 - 1;
      const y = -(e.clientY / canvasSize.height) * 2 + 1;

      // Convert to world coordinates
      mouseRef.current.set(x * viewport.width * 0.5, y * viewport.height * 0.5);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [viewport, canvasSize]);

  // Animation loop
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
      materialRef.current.uniforms.uMouse.value = mouseRef.current;
    }
  });

  // Uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uMouseRadius: { value: mouseRadius },
      uInteractionMode: { value: interactionToUniform[interactionMode] },
      uNoiseScale: { value: noiseScale },
      uNoiseSpeed: { value: noiseSpeed },
      uNoiseStrength: { value: noiseStrength },
      uShape: { value: shapeToUniform[shape] },
      uGlow: { value: glow },
      uSoftness: { value: softness },
      uOpacity: { value: opacity },
    }),
    [
      mouseRadius,
      interactionMode,
      noiseScale,
      noiseSpeed,
      noiseStrength,
      shape,
      glow,
      softness,
      opacity,
    ]
  );

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aScale"
          count={count}
          array={scales}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aColor"
          count={count}
          array={colorAttributes}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandomSeed"
          count={count}
          array={randomSeeds}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={depthWrite}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

export default ParticleField;
