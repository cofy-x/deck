/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState, type CSSProperties, type ElementType } from 'react';
import {
  ArrowRight,
  Bot,
  ExternalLink,
  Globe,
  Monitor,
  MoveRight,
  ShieldCheck,
  Workflow,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { SITE_CONTENT } from '@/content/site-content';
import type { CapabilityIcon, HeroAction, Locale } from '@/types/content';

const LOCALE_STORAGE_KEY = 'deck.landing.locale';
const BRAND_LOGO_PATH = '/brand/deck-logo-64.png';
const ICON_MAP: Record<CapabilityIcon, ElementType> = {
  shield: ShieldCheck,
  monitor: Monitor,
  automation: Bot,
  bridge: Workflow,
};

function detectLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'en';
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'en' || stored === 'zh-CN') {
    return stored;
  }

  const candidates = [window.navigator.language, ...window.navigator.languages];
  return candidates.some((item) => item.toLowerCase().startsWith('zh'))
    ? 'zh-CN'
    : 'en';
}

function isExternalLink(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://');
}

function sectionDelay(index: number): CSSProperties {
  return { '--stagger': `${index}` } as CSSProperties;
}

export function App() {
  const [locale, setLocale] = useState<Locale>(detectLocale);
  const content = useMemo(() => SITE_CONTENT[locale], [locale]);
  const supplementalCommunityLinks = useMemo(
    () =>
      content.community.links.filter(
        (link) => !content.hero.actions.some((action) => action.href === link.href),
      ),
    [content],
  );

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-80"
      />
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <a
            href="#hero"
            className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide"
          >
            <img
              src={BRAND_LOGO_PATH}
              alt=""
              aria-hidden
              className="size-6 rounded-md border border-white/10 shadow-[0_8px_16px_-8px_rgba(0,0,0,0.8)]"
            />
            <span className="text-base">Deck</span>
          </a>
          <nav
            aria-label="Primary"
            className="hidden min-w-0 flex-1 items-center justify-center gap-4 md:flex"
          >
            {content.nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ActionLinkButton action={content.header.primaryAction} size="sm" />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setLocale((previous) => (previous === 'en' ? 'zh-CN' : 'en'))}
              aria-label="Switch language"
            >
              <Globe className="size-4" />
              {content.localeButton}
            </Button>
          </div>
        </div>
        <nav aria-label="Primary mobile" className="border-t border-border/60 md:hidden">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="no-scrollbar flex gap-2 overflow-x-auto py-2">
              {content.nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="shrink-0 rounded-full border border-border/70 bg-card/45 px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </nav>
      </header>

      <main id="hero" className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 py-12 sm:px-6">
        <section className="animate-rise rounded-3xl border border-border/70 bg-card/70 p-7 shadow-[0_26px_140px_-90px_rgba(52,211,153,0.65)] sm:p-10">
          <Badge>{content.hero.badge}</Badge>
          <h1 className="mt-5 max-w-4xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            {content.hero.title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {content.hero.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {content.hero.actions.map((action) => (
              <ActionLinkButton key={action.href} action={action} />
            ))}
          </div>
          <ul className="mt-5 flex flex-wrap gap-2">
            {content.hero.trustChips.map((chip) => (
              <li key={chip}>
                <Badge
                  variant="secondary"
                  className="border-border/65 bg-secondary/40 normal-case tracking-normal"
                >
                  {chip}
                </Badge>
              </li>
            ))}
          </ul>
        </section>

        <section id="demo" className="animate-rise">
          <SectionHeader title={content.demo.title} description={content.demo.description} />
          <div className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-3 sm:p-4">
            <video
              className="w-full rounded-xl border border-border/60 object-cover"
              poster="/demo-poster.png"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-label={content.demo.imageAlt}
            >
              <source src="/demo.webm" type="video/webm" />
              <source src="/demo.mp4" type="video/mp4" />
              <img
                src="/demo.gif"
                alt={content.demo.imageAlt}
                className="w-full rounded-xl border border-border/60 object-cover"
                loading="lazy"
              />
            </video>
          </div>
        </section>

        <section id="capabilities" className="animate-rise">
          <SectionHeader
            title={content.capabilities.title}
            description={content.capabilities.description}
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {content.capabilities.items.map((item, index) => {
              const Icon = ICON_MAP[item.icon];
              return (
                <Card key={item.title} className="animate-stagger" style={sectionDelay(index)}>
                  <div className="inline-flex size-9 items-center justify-center rounded-md border border-primary/35 bg-primary/12 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <CardTitle className="mt-5">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </Card>
              );
            })}
          </div>
        </section>

        <section id="architecture" className="animate-rise">
          <SectionHeader
            title={content.architecture.title}
            description={content.architecture.description}
          />
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {content.architecture.steps.map((step, index) => (
              <li
                key={step.title}
                className="animate-stagger rounded-2xl border border-border/70 bg-card/75 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_20px_70px_-45px_rgba(52,211,153,0.4)]"
                style={sectionDelay(index)}
              >
                <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                  0{index + 1}
                  <MoveRight className="size-4" />
                </div>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section id="quick-start" className="animate-rise">
          <SectionHeader
            title={content.quickStart.title}
            description={content.quickStart.description}
          />
          <div className="mt-6 grid gap-4">
            {content.quickStart.steps.map((step, index) => (
              <article
                key={step.title}
                className="animate-stagger rounded-2xl border border-border/70 bg-card/75 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_20px_70px_-45px_rgba(52,211,153,0.4)]"
                style={sectionDelay(index)}
              >
                <h3 className="text-base font-semibold">{step.title}</h3>
                <pre className="mt-3 overflow-x-auto rounded-lg border border-border/60 bg-black/60 p-4 font-mono text-xs leading-6 text-slate-200">
                  <code>{step.command}</code>
                </pre>
                {step.note ? (
                  <p className="mt-3 text-sm text-muted-foreground">{step.note}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section id="roadmap" className="animate-rise">
          <SectionHeader title={content.roadmap.title} description={content.roadmap.description} />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {content.roadmap.groups.map((group, index) => (
              <Card key={group.title} className="animate-stagger" style={sectionDelay(index)}>
                <CardTitle>{group.title}</CardTitle>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="pt-1 text-primary">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>

        <section id="community" className="animate-rise rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-8">
          <SectionHeader title={content.community.title} description={content.community.description} />
          <div className="mt-6 flex flex-wrap gap-3">
            {content.hero.actions.map((action) => (
              <ActionLinkButton key={`community-action-${action.href}`} action={action} />
            ))}
          </div>
          {supplementalCommunityLinks.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {supplementalCommunityLinks.map((link) => (
                <Button key={link.href} asChild variant="secondary">
                  <a href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              ))}
            </div>
          ) : null}
        </section>
      </main>

      <footer className="border-t border-border/65 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <p>{content.footer}</p>
          <div className="flex flex-wrap gap-2">
            {content.hero.actions.map((action) => (
              <ActionLinkButton key={`footer-action-${action.href}`} action={action} size="sm" />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

interface ActionLinkButtonProps {
  action: HeroAction;
  size?: 'default' | 'sm' | 'lg';
}

function ActionLinkButton({ action, size = 'default' }: ActionLinkButtonProps) {
  const isPrimary = action.variant === 'primary';
  return (
    <Button asChild variant={isPrimary ? 'default' : 'secondary'} size={size}>
      <a
        href={action.href}
        target={isExternalLink(action.href) ? '_blank' : undefined}
        rel={isExternalLink(action.href) ? 'noreferrer' : undefined}
      >
        {action.label}
        {isPrimary ? <ArrowRight className="size-4" /> : <ExternalLink className="size-4" />}
      </a>
    </Button>
  );
}

interface SectionHeaderProps {
  title: string;
  description: string;
}

function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {description}
      </p>
    </div>
  );
}
