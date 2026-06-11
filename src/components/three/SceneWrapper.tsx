'use client';

import React, {
  Suspense,
  useEffect,
  useState,
  useRef,
  ReactNode,
  ErrorInfo,
} from 'react';
import { Canvas, RootState } from '@react-three/fiber';
import { Preload, PerformanceMonitor, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei';
import * as THREE from 'three';

// =============================================================================
// Types
// =============================================================================

interface SceneWrapperProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  camera?: {
    position?: [number, number, number];
    fov?: number;
    near?: number;
    far?: number;
  };
  shadows?: boolean;
  dpr?: number | [number, number];
  performance?: {
    min?: number;
    max?: number;
    current?: number;
  };
  gl?: Partial<THREE.WebGLRendererParameters>;
  flat?: boolean;
  linear?: boolean;
  onCreated?: (state: RootState) => void;
  fallback?: ReactNode;
  loadingComponent?: ReactNode;
  enablePerformanceMonitor?: boolean;
  adaptiveDpr?: boolean;
  adaptiveEvents?: boolean;
}

interface PerformanceState {
  fps: number;
  factor: number;
  refreshrate: number;
}

// =============================================================================
// Error Boundary
// =============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class SceneErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('WebGL Scene Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="webgl-error">
            <p>Unable to load 3D content</p>
            <small>Your browser may not support WebGL</small>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// Loading Component
// =============================================================================

const DefaultLoadingComponent: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    }}
  >
    <div
      style={{
        width: 40,
        height: 40,
        border: '2px solid rgba(255, 255, 255, 0.1)',
        borderTopColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// =============================================================================
// WebGL Compatibility Check
// =============================================================================

const checkWebGLSupport = (): { supported: boolean; version: number } => {
  if (typeof window === 'undefined') {
    return { supported: false, version: 0 };
  }

  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    if (gl2) {
      return { supported: true, version: 2 };
    }

    const gl1 =
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (gl1) {
      return { supported: true, version: 1 };
    }

    return { supported: false, version: 0 };
  } catch {
    return { supported: false, version: 0 };
  }
};

// =============================================================================
// Performance Monitor Component
// =============================================================================

const PerformanceMonitorDisplay: React.FC<{
  onPerformanceChange?: (state: PerformanceState) => void;
}> = ({ onPerformanceChange }) => {
  return (
    <PerformanceMonitor
      onIncline={() => {
        onPerformanceChange?.({
          fps: 60,
          factor: 1,
          refreshrate: 60,
        });
      }}
      onDecline={() => {
        onPerformanceChange?.({
          fps: 30,
          factor: 0.5,
          refreshrate: 60,
        });
      }}
      onChange={({ fps, factor, refreshrate }) => {
        onPerformanceChange?.({ fps, factor, refreshrate });
      }}
    />
  );
};

// =============================================================================
// Scene Wrapper Component
// =============================================================================

export const SceneWrapper: React.FC<SceneWrapperProps> = ({
  children,
  className = '',
  style,
  camera = {
    position: [0, 0, 5],
    fov: 75,
    near: 0.1,
    far: 1000,
  },
  shadows = false,
  dpr,
  performance = { min: 0.5, max: 2 },
  gl,
  flat = false,
  linear = false,
  onCreated,
  fallback,
  loadingComponent,
  enablePerformanceMonitor = false,
  adaptiveDpr = true,
  adaptiveEvents = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [webglSupport, setWebglSupport] = useState<{
    supported: boolean;
    version: number;
  }>({ supported: true, version: 2 });
  const [performanceState, setPerformanceState] = useState<PerformanceState>({
    fps: 60,
    factor: 1,
    refreshrate: 60,
  });

  // Client-side hydration check
  useEffect(() => {
    setIsClient(true);
    setWebglSupport(checkWebGLSupport());
  }, []);

  // Don't render anything on server
  if (!isClient) {
    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          ...style,
        }}
      >
        {loadingComponent || <DefaultLoadingComponent />}
      </div>
    );
  }

  // WebGL not supported fallback
  if (!webglSupport.supported) {
    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          ...style,
        }}
      >
        {fallback || (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'rgba(255, 255, 255, 0.6)',
              textAlign: 'center',
              padding: 20,
            }}
          >
            <div>
              <p style={{ marginBottom: 8 }}>3D content unavailable</p>
              <small>Please enable WebGL in your browser settings</small>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Calculate DPR based on performance
  const calculatedDpr = dpr || [performance.min || 0.5, performance.max || 2];

  return (
    <SceneErrorBoundary fallback={fallback}>
      <div
        ref={containerRef}
        className={className}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          ...style,
        }}
      >
        <Canvas
          camera={{
            position: camera.position,
            fov: camera.fov,
            near: camera.near,
            far: camera.far,
          }}
          shadows={shadows}
          dpr={calculatedDpr}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
            ...gl,
          }}
          flat={flat}
          linear={linear}
          onCreated={(state) => {
            // Enable shadow map if shadows are enabled
            if (shadows) {
              state.gl.shadowMap.enabled = true;
              state.gl.shadowMap.type = THREE.PCFSoftShadowMap;
            }
            // Set tone mapping
            state.gl.toneMapping = THREE.ACESFilmicToneMapping;
            state.gl.toneMappingExposure = 1;
            // Call user callback
            onCreated?.(state);
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {/* Performance optimization components */}
          {enablePerformanceMonitor && (
            <PerformanceMonitorDisplay
              onPerformanceChange={setPerformanceState}
            />
          )}
          {adaptiveDpr && <AdaptiveDpr pixelated />}
          {adaptiveEvents && <AdaptiveEvents />}

          {/* Suspense for async loading */}
          <Suspense fallback={null}>
            {children}
            <Preload all />
          </Suspense>
        </Canvas>

        {/* Loading overlay */}
        <Suspense fallback={loadingComponent || <DefaultLoadingComponent />}>
          {null}
        </Suspense>

        {/* Debug info (only in development) */}
        {import.meta.env.DEV && enablePerformanceMonitor && (
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              padding: '4px 8px',
              background: 'rgba(0, 0, 0, 0.7)',
              color: '#fff',
              fontSize: 10,
              fontFamily: 'monospace',
              borderRadius: 4,
              pointerEvents: 'none',
            }}
          >
            FPS: {Math.round(performanceState.fps)} | Factor:{' '}
            {performanceState.factor.toFixed(2)} | WebGL{webglSupport.version}
          </div>
        )}
      </div>
    </SceneErrorBoundary>
  );
};

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Hook to detect low-performance devices
 */
export const useDevicePerformance = () => {
  const [isLowPerformance, setIsLowPerformance] = useState(false);

  useEffect(() => {
    // Check for mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    // Check hardware concurrency
    const lowCores = navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency < 4
      : false;

    // Check device memory (if available)
    const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory;
    const lowMemory = deviceMemory ? deviceMemory < 4 : false;

    setIsLowPerformance(
      isMobile || prefersReducedMotion || lowCores || lowMemory
    );
  }, []);

  return isLowPerformance;
};

/**
 * Hook to get responsive pixel ratio
 */
export const useResponsiveDpr = (min = 0.5, max = 2) => {
  const [dpr, setDpr] = useState(1);
  const isLowPerformance = useDevicePerformance();

  useEffect(() => {
    const deviceDpr = Math.min(window.devicePixelRatio || 1, max);
    setDpr(isLowPerformance ? Math.max(deviceDpr * 0.5, min) : deviceDpr);
  }, [isLowPerformance, min, max]);

  return dpr;
};

export default SceneWrapper;
