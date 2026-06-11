'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

// =============================================================================
// Types
// =============================================================================

export type DistortionEffect = 'ripple' | 'wave' | 'displacement' | 'none';

export interface ImagePlaneProps {
  /** Image URL or path */
  src: string;
  /** Position in 3D space */
  position?: [number, number, number];
  /** Rotation in radians */
  rotation?: [number, number, number];
  /** Scale multiplier */
  scale?: number;
  /** Width of the plane (height is calculated from aspect ratio) */
  width?: number;
  /** Distortion effect type */
  effect?: DistortionEffect;
  /** Distortion intensity */
  distortionStrength?: number;
  /** Enable hover effects */
  hoverEnabled?: boolean;
  /** Hover scale factor */
  hoverScale?: number;
  /** Transition duration in seconds */
  transitionDuration?: number;
  /** Click handler */
  onClick?: () => void;
  /** Hover start handler */
  onHoverStart?: () => void;
  /** Hover end handler */
  onHoverEnd?: () => void;
  /** Depth amount for parallax */
  depth?: number;
  /** Enable chromatic aberration on hover */
  chromaticAberration?: boolean;
}

// =============================================================================
// Shader Code
// =============================================================================

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPosition;

  uniform float uTime;
  uniform float uHover;
  uniform float uDepth;

  void main() {
    vUv = uv;
    vPosition = position;

    vec3 pos = position;

    // Add subtle depth displacement
    pos.z += sin(uv.x * 3.14159) * sin(uv.y * 3.14159) * uDepth * uHover;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uHover;
  uniform float uDistortionStrength;
  uniform int uEffectType;
  uniform float uChromaticAberration;

  varying vec2 vUv;
  varying vec3 vPosition;

  // Simplex noise
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

  // Ripple effect
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

  // Noise displacement
  vec2 displacementEffect(vec2 uv, float strength, float time) {
    float noiseX = snoise(uv * 3.0 + time * 0.5);
    float noiseY = snoise(uv * 3.0 + time * 0.5 + 100.0);
    return uv + vec2(noiseX, noiseY) * strength;
  }

  // RGB shift
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
    } else if (uEffectType == 2) {
      // Noise displacement
      uv = displacementEffect(uv, effectStrength * 0.03, uTime);
    }
    // Type 3 = none, no distortion

    // Chromatic aberration
    vec4 color;
    if (uChromaticAberration > 0.0) {
      vec2 center = vec2(0.5);
      vec2 direction = normalize(uv - center);
      float aberrationStrength = uChromaticAberration * uHover * 0.005;
      color = rgbShift(uTexture, uv, direction, aberrationStrength);
    } else {
      color = texture2D(uTexture, uv);
    }

    // Add subtle vignette on hover
    float vignette = 1.0 - smoothstep(0.4, 0.9, length(vUv - 0.5) * 1.5);
    color.rgb *= mix(1.0, vignette, uHover * 0.2);

    // Brightness boost on hover
    color.rgb *= 1.0 + uHover * 0.1;

    gl_FragColor = color;
  }
`;

// =============================================================================
// Effect type mapping
// =============================================================================

const effectToUniform: Record<DistortionEffect, number> = {
  ripple: 0,
  wave: 1,
  displacement: 2,
  none: 3,
};

// =============================================================================
// ImagePlane Component
// =============================================================================

export const ImagePlane: React.FC<ImagePlaneProps> = ({
  src,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  width = 2,
  effect = 'ripple',
  distortionStrength = 1,
  hoverEnabled = true,
  hoverScale = 1.05,
  transitionDuration = 0.3,
  onClick,
  onHoverStart,
  onHoverEnd,
  depth = 0.1,
  chromaticAberration = true,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [localMouse, setLocalMouse] = useState(new THREE.Vector2(0.5, 0.5));
  const targetScale = useRef(scale);
  const currentScale = useRef(scale);
  const hoverProgress = useRef(0);

  const { size } = useThree();

  // Load texture
  const texture = useTexture(src);

  // Calculate aspect ratio and dimensions
  const { planeWidth, planeHeight } = useMemo(() => {
    const aspectRatio = texture.image
      ? (texture.image as HTMLImageElement).width / (texture.image as HTMLImageElement).height
      : 16 / 9;
    return {
      planeWidth: width,
      planeHeight: width / aspectRatio,
    };
  }, [texture, width]);

  // Create uniforms
  const uniforms = useMemo(
    () => ({
      uTexture: { value: texture },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uHover: { value: 0 },
      uDistortionStrength: { value: distortionStrength },
      uEffectType: { value: effectToUniform[effect] },
      uDepth: { value: depth },
      uChromaticAberration: { value: chromaticAberration ? 1 : 0 },
    }),
    [texture, distortionStrength, effect, depth, chromaticAberration]
  );

  // Update target scale on hover
  useEffect(() => {
    if (hoverEnabled) {
      targetScale.current = isHovered ? scale * hoverScale : scale;
    }
  }, [isHovered, scale, hoverScale, hoverEnabled]);

  // Animation frame
  useFrame(({ clock }) => {
    if (materialRef.current) {
      // Update time
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();

      // Update mouse position
      materialRef.current.uniforms.uMouse.value = localMouse;

      // Animate hover progress
      const targetHover = isHovered ? 1 : 0;
      hoverProgress.current = THREE.MathUtils.lerp(
        hoverProgress.current,
        targetHover,
        transitionDuration > 0 ? 0.1 / transitionDuration : 0.1
      );
      materialRef.current.uniforms.uHover.value = hoverProgress.current;
    }

    // Animate scale
    if (meshRef.current) {
      currentScale.current = THREE.MathUtils.lerp(
        currentScale.current,
        targetScale.current,
        0.1
      );
      meshRef.current.scale.setScalar(currentScale.current);
    }
  });

  // Handle pointer move for local mouse position
  const handlePointerMove = (e: any) => {
    if (!meshRef.current || !e.uv) return;
    setLocalMouse(new THREE.Vector2(e.uv.x, e.uv.y));
  };

  // Handle hover events
  const handlePointerEnter = () => {
    if (!hoverEnabled) return;
    setIsHovered(true);
    onHoverStart?.();
    document.body.style.cursor = 'pointer';
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    onHoverEnd?.();
    document.body.style.cursor = 'auto';
    setLocalMouse(new THREE.Vector2(0.5, 0.5));
  };

  // Handle click
  const handleClick = () => {
    onClick?.();
  };

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
    >
      <planeGeometry args={[planeWidth, planeHeight, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
};

// =============================================================================
// ImagePlane Gallery Variant (multiple images in a row)
// =============================================================================

export interface ImageGalleryProps {
  images: Array<{
    src: string;
    onClick?: () => void;
  }>;
  spacing?: number;
  imageWidth?: number;
  effect?: DistortionEffect;
  position?: [number, number, number];
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  spacing = 0.3,
  imageWidth = 2,
  effect = 'ripple',
  position = [0, 0, 0],
}) => {
  const totalWidth = images.length * imageWidth + (images.length - 1) * spacing;
  const startX = -totalWidth / 2 + imageWidth / 2;

  return (
    <group position={position}>
      {images.map((image, index) => (
        <ImagePlane
          key={index}
          src={image.src}
          position={[startX + index * (imageWidth + spacing), 0, 0]}
          width={imageWidth}
          effect={effect}
          onClick={image.onClick}
        />
      ))}
    </group>
  );
};

export default ImagePlane;
