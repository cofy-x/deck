/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useCallback } from 'react';
import { FileText, FolderOpen, Search, Loader2 } from 'lucide-react';
import { t } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useChatStore } from '@/stores/chat-store';
import { useFindFiles } from '@/hooks/use-mention';
import { useProjectStore } from '@/stores/project-store';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FilePickerDialogProps {
  /** Called when the user selects a file. Inserts the file path into the input. */
  onSelectFile?: (filePath: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilePickerDialog({ onSelectFile }: FilePickerDialogProps) {
  const open = useChatStore((s) => s.filePickerOpen);
  const setOpen = useChatStore((s) => s.setFilePickerOpen);
  const requestInputFocus = useChatStore((s) => s.requestInputFocus);
  const currentDirectory = useProjectStore((s) => s.currentDirectory);
  const [query, setQuery] = useState('');
  const { data: files, isLoading } = useFindFiles(query, currentDirectory);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      setOpen(value);
      if (!value) {
        setQuery('');
        requestInputFocus();
      }
    },
    [setOpen, requestInputFocus],
  );

  const handleSelect = useCallback(
    (filePath: string) => {
      if (onSelectFile) {
        onSelectFile(filePath);
      }
      setOpen(false);
      setQuery('');
    },
    [onSelectFile, setOpen],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            {t('file_picker.title')}
          </DialogTitle>
          <DialogDescription>
            {t('file_picker.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('file_picker.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
            autoFocus
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {isLoading && query.length > 0 ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : query.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t('file_picker.empty_prompt')}
            </div>
          ) : files && files.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {files.map((filePath) => {
                const isDir = !filePath.includes('.');
                return (
                  <button
                    key={filePath}
                    type="button"
                    onClick={() => handleSelect(filePath)}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/50',
                    )}
                  >
                    {isDir ? (
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate font-mono text-xs">
                      {filePath}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t('file_picker.no_results')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
