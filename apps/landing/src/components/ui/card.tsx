/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';

import { cn } from '@/lib/utils';

function Card({ className, ...props }: React.ComponentProps<'article'>) {
  return (
    <article
      className={cn(
        'rounded-2xl border border-border/70 bg-card/75 p-6 backdrop-blur shadow-[0_20px_80px_-55px_rgba(0,0,0,0.9)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_24px_90px_-50px_rgba(52,211,153,0.45)]',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('text-lg font-semibold tracking-tight text-foreground', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      className={cn('mt-3 text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Card, CardDescription, CardTitle };
