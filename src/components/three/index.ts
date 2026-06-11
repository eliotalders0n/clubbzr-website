// =============================================================================
// Three.js / React Three Fiber Components for Club BZR
// =============================================================================

// Scene wrapper with performance monitoring and error boundaries
export { SceneWrapper, useDevicePerformance, useResponsiveDpr } from './SceneWrapper';
export type { default as SceneWrapperComponent } from './SceneWrapper';

// Hero background with floating particles
export { HeroBackground } from './HeroBackground';
export type { HeroBackgroundProps } from './HeroBackground';

// Configurable particle system
export { ParticleField } from './ParticleField';
export type {
  ParticleFieldProps,
  ParticleShape,
  InteractionMode,
} from './ParticleField';

// Floating glass shapes
export {
  FloatingShapes,
  FloatingShapesPresets,
} from './FloatingShapes';
export type {
  FloatingShapesProps,
  FloatingShapeConfig,
  ShapeType,
} from './FloatingShapes';

// Interactive image planes with distortion effects
export { ImagePlane, ImageGallery } from './ImagePlane';
export type {
  ImagePlaneProps,
  ImageGalleryProps,
  DistortionEffect,
} from './ImagePlane';

// Virtual gallery scene
export { GalleryScene } from './GalleryScene';
export type {
  GallerySceneProps,
  Artwork,
  GalleryLayout,
} from './GalleryScene';

// Interactive art map
export { ArtMapGlobe } from './ArtMapGlobe';
export type {
  ArtMapGlobeProps,
  Venue,
  VenueConnection,
} from './ArtMapGlobe';

// =============================================================================
// Shaders
// =============================================================================

// Note: Shaders are in the ./shaders directory as .glsl, .vert, and .frag files
// They can be imported using raw-loader or vite's ?raw query
//
// Available shaders:
// - noise.glsl: Perlin/Simplex noise functions
// - distortion.frag: Image distortion effects
// - particles.vert/frag: Custom particle rendering
// - gradient.frag: Animated gradient backgrounds
