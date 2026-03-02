/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { Fragment, useMemo } from 'react';

import { formatShortcutKeys } from '@/lib/shortcut';
import { cn } from '@/lib/utils';

export interface ShortcutTooltipContentProps {
  label: string;
  keys?: readonly string[];
  className?: string;
}

export function ShortcutTooltipContent({
  label,
  keys = [],
  className,
}: ShortcutTooltipContentProps) {
  const displayKeys = useMemo(() => formatShortcutKeys(keys), [keys]);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span>{label}</span>
      {displayKeys.length > 0 && (
        <span className="inline-flex items-center gap-1">
          {displayKeys.map((key, index) => (
            <Fragment key={`${key}-${index}`}>
              {index > 0 && <span className="text-background/65">+</span>}
              <kbd className="inline-flex min-h-4 items-center rounded-[5px] bg-white/14 px-1.5 py-0.5 text-[10px] font-mono leading-none text-white ring-1 ring-inset ring-white/28">
                {key}
              </kbd>
            </Fragment>
          ))}
        </span>
      )}
    </div>
  );
}
