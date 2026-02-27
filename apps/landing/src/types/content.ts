/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export type Locale = 'en' | 'zh-CN';

export type CapabilityIcon = 'shield' | 'monitor' | 'automation' | 'bridge';

export interface NavItem {
  href: string;
  label: string;
}

export interface HeroAction {
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
}

export interface HeaderContent {
  primaryAction: HeroAction;
}

export interface HeroContent {
  badge: string;
  title: string;
  description: string;
  actions: ReadonlyArray<HeroAction>;
  trustChips: ReadonlyArray<string>;
}

export interface DemoContent {
  title: string;
  description: string;
  imageAlt: string;
}

export interface CapabilityItem {
  icon: CapabilityIcon;
  title: string;
  description: string;
}

export interface ArchitectureStep {
  title: string;
  description: string;
}

export interface QuickStartStep {
  title: string;
  command: string;
  note?: string;
}

export interface RoadmapGroup {
  title: string;
  items: ReadonlyArray<string>;
}

export interface CommunityLink {
  label: string;
  href: string;
}

export interface SiteContent {
  localeButton: string;
  header: HeaderContent;
  nav: ReadonlyArray<NavItem>;
  hero: HeroContent;
  demo: DemoContent;
  capabilities: {
    title: string;
    description: string;
    items: ReadonlyArray<CapabilityItem>;
  };
  architecture: {
    title: string;
    description: string;
    steps: ReadonlyArray<ArchitectureStep>;
  };
  quickStart: {
    title: string;
    description: string;
    steps: ReadonlyArray<QuickStartStep>;
  };
  roadmap: {
    title: string;
    description: string;
    groups: ReadonlyArray<RoadmapGroup>;
  };
  community: {
    title: string;
    description: string;
    links: ReadonlyArray<CommunityLink>;
  };
  footer: string;
}
