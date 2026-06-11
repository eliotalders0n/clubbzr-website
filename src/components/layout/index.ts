// Layout Components - Club BZR
// Barrel export for all layout components

// Header
export { Header } from './Header';
export type { HeaderProps } from './Header';

// Re-export NavLink from Navigation
export type { NavLink } from './Navigation';

// Footer
export { Footer } from './Footer';

// Navigation
export { Navigation, MobileNavigation } from './Navigation';
export type { NavigationProps, MobileNavigationProps } from './Navigation';

// Sidebar
export { Sidebar, MobileSidebar } from './Sidebar';
export type {
  SidebarProps,
  MobileSidebarProps,
  SidebarItem,
  SidebarSection,
} from './Sidebar';

// Page Wrapper
export {
  PageWrapper,
  SimplePageWrapper,
  DashboardLayout,
} from './PageWrapper';
export type {
  PageWrapperProps,
  SimplePageWrapperProps,
  DashboardLayoutProps,
  TransitionType,
} from './PageWrapper';

// Section
export { Section, HeroSection, SplitSection } from './Section';
export type {
  SectionProps,
  HeroSectionProps,
  SplitSectionProps,
  SectionVariant,
  PaddingSize as SectionPaddingSize,
  BackgroundStyle,
} from './Section';

// Grid
export { Grid, GridItem, MasonryGrid, AutoGrid } from './Grid';
export type {
  GridProps,
  GridItemProps,
  MasonryGridProps,
  AutoGridProps,
  ColumnCount,
  GapSize,
} from './Grid';

// Container
export { Container, FluidContainer } from './Container';
export type {
  ContainerProps,
  ContainerSize,
  PaddingSize as ContainerPaddingSize,
  FluidContainerProps,
} from './Container';
