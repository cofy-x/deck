/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Folder, Loader2, Search } from 'lucide-react';

import { t } from '@/i18n';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/project-store';
import {
  useFindDirectories,
  useListChildDirectories,
  usePaths,
  type ProjectDirectoryItem,
} from '@/hooks/use-project';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base directory to list projects from inside the sandbox. */
const SANDBOX_HOME = '/home/deck';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectPickerDialog() {
  const open = useProjectStore((s) => s.projectPickerOpen);
  const closeProjectPicker = useProjectStore((s) => s.closeProjectPicker);
  const setDirectory = useProjectStore((s) => s.setDirectory);
  const currentDirectory = useProjectStore((s) => s.currentDirectory);

  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [previewDirectory, setPreviewDirectory] =
    useState<ProjectDirectoryItem | null>(null);
  const { data: paths } = usePaths();

  // Keep root dynamic to match OpenCode server environment.
  const rootDirectory = paths?.home ?? SANDBOX_HOME;

  const { data: matchedDirectories = [], isLoading: isFindingDirectories } =
    useFindDirectories(rootDirectory, search);
  const { data: childDirectories = [], isLoading: isListingChildDirectories } =
    useListChildDirectories(
      rootDirectory,
      previewDirectory?.absolutePath ?? null,
    );

  const isChildListMode = previewDirectory !== null;

  const visibleDirectories = useMemo(() => {
    if (isChildListMode) {
      return childDirectories;
    }
    return matchedDirectories;
  }, [isChildListMode, childDirectories, matchedDirectories]);

  const isLoading = isChildListMode
    ? isListingChildDirectories
    : isFindingDirectories;

  const handleSelect = useCallback(
    (directory: ProjectDirectoryItem) => {
      setDirectory(directory.absolutePath);
    },
    [setDirectory],
  );

  const resetNavigationState = useCallback(() => {
    setActiveIndex(-1);
    setPreviewDirectory(null);
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      resetNavigationState();
    },
    [resetNavigationState],
  );

  const moveActiveIndex = useCallback(
    (delta: number) => {
      if (visibleDirectories.length === 0) return;
      const size = visibleDirectories.length;
      const start = activeIndex >= 0 ? activeIndex : delta > 0 ? -1 : 0;
      const nextIndex = (start + delta + size) % size;
      setActiveIndex(nextIndex);
    },
    [activeIndex, visibleDirectories],
  );

  const handleDrillIntoDirectory = useCallback(() => {
    if (visibleDirectories.length === 0) return;
    const nextIndex = activeIndex >= 0 ? activeIndex : 0;
    const item = visibleDirectories[nextIndex];
    if (!item) return;

    // Enter child directory browsing mode only on Tab.
    setPreviewDirectory(item);
    setSearch(item.queryPath);
    setActiveIndex(-1);
  }, [activeIndex, visibleDirectories]);

  useEffect(() => {
    if (visibleDirectories.length === 0) {
      if (activeIndex !== -1) setActiveIndex(-1);
      return;
    }
    if (activeIndex >= visibleDirectories.length) {
      setActiveIndex(visibleDirectories.length - 1);
    }
  }, [activeIndex, visibleDirectories]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (visibleDirectories.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveActiveIndex(1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveActiveIndex(-1);
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        handleDrillIntoDirectory();
        return;
      }

      if (event.key === 'Enter' && activeIndex >= 0) {
        event.preventDefault();
        const item = visibleDirectories[activeIndex];
        if (item) {
          handleSelect(item);
        }
      }
    },
    [
      activeIndex,
      handleDrillIntoDirectory,
      handleSelect,
      moveActiveIndex,
      visibleDirectories,
    ],
  );

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) {
        closeProjectPicker();
        setSearch('');
        resetNavigationState();
      }
    },
    [closeProjectPicker, resetNavigationState],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('project.title')}</DialogTitle>
          <DialogDescription>
            {t('project.description').replace('{root}', rootDirectory)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('project.search_placeholder')}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-8"
              autoFocus
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>

          {/* Directory list */}
          <ScrollArea className="h-[300px] rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : visibleDirectories.length > 0 ? (
              <div className="flex flex-col gap-0.5 p-1">
                {visibleDirectories.map((directory, index) => {
                  const isCurrent = directory.absolutePath === currentDirectory;
                  const isPreview = index === activeIndex;
                  return (
                    <button
                      key={directory.absolutePath}
                      type="button"
                      onClick={() => handleSelect(directory)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/50',
                        (isCurrent || isPreview) && 'bg-muted font-medium',
                      )}
                    >
                      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {directory.queryPath || directory.absolutePath}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Folder className="h-8 w-8" />
                <span>{t('project.no_directories')}</span>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
