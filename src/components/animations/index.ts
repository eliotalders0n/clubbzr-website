// Custom Cursor
export {
  CursorProvider,
  useCursor,
  CursorContext,
} from './CustomCursor';
export type {
  CursorContextType,
  CursorState,
  CursorShape,
} from './CustomCursor';

// Page Transitions
export {
  PageTransitionProvider,
  usePageTransition,
  PageWrapper,
  StaggerContainer,
  StaggerItem,
  PageTransitionContext,
} from './PageTransition';
export type {
  PageTransitionContextType,
  TransitionDirection,
  TransitionType,
} from './PageTransition';

// Scroll Animations
export {
  ScrollAnimationProvider,
  useScrollContext,
  Parallax,
  ScrollReveal,
  ScrollProgress,
  GSAPScrollTrigger,
  HorizontalScroll,
  ScrollContext,
} from './ScrollAnimations';
export type { ScrollContextType, RevealType } from './ScrollAnimations';

// Text Reveal
export {
  CharReveal,
  WordReveal,
  LineReveal,
  Typewriter,
  WaveText,
  GSAPTextReveal,
  ScrambleText,
  RotatingWords,
  useSplitText,
} from './TextReveal';
export type { TextAnimationType, TextRevealBaseProps } from './TextReveal';

// Magnetic Button
export {
  MagneticButton,
  MagneticText,
  MagneticContainer,
  RepelButton,
  ElasticButton,
} from './MagneticButton';
export type { MagneticButtonProps, MagneticButtonRef } from './MagneticButton';

// Image Reveal
export {
  ImageReveal,
  DistortionImage,
  ParallaxImageContainer,
  ImageSequence,
  LazyImage,
} from './ImageReveal';
export type { ImageRevealType, ImageRevealProps } from './ImageReveal';

// Smooth Scroll
export {
  SmoothScrollProvider,
  useSmoothScroll,
  ScrollProgressBar,
  ScrollIndicator,
  ScrollToTopButton,
  useSectionDetection,
  HorizontalScrollContainer,
  SmoothScrollContext,
} from './SmoothScroll';
export type { SmoothScrollContextType, LenisOptions } from './SmoothScroll';
