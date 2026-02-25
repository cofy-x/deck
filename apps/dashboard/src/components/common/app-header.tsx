/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Activity, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppControllerHealth } from '@/lib/api/generated/app/app';

export function AppHeader() {
  const [isDark, setIsDark] = useState(false);

  const { data: healthData, isLoading: healthLoading } = useAppControllerHealth(
    {
      query: {
        refetchInterval: 30000, // Check health every 30 seconds
      },
    },
  );

  const isHealthy = healthData?.status === 200;

  useEffect(() => {
    // Check system preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-2" />
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <Activity
                  className={`size-4 ${
                    healthLoading
                      ? 'text-muted-foreground animate-pulse'
                      : isHealthy
                        ? 'text-green-500'
                        : 'text-destructive'
                  }`}
                />
                <span className="text-muted-foreground text-xs">
                  {healthLoading
                    ? 'Checking...'
                    : isHealthy
                      ? 'API Online'
                      : 'API Offline'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {healthLoading
                  ? 'Checking API health...'
                  : isHealthy
                    ? 'API is healthy and responding'
                    : 'API is not responding'}
              </p>
            </TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-4" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleTheme}>
                {isDark ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
                <span className="sr-only">Toggle theme</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle {isDark ? 'light' : 'dark'} mode</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
