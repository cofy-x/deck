/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { t } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { QuestionRequest } from '@opencode-ai/sdk/v2/client';
import { useQuestionReply } from '@/hooks/use-session';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuestionDialogProps {
  /** Pending question requests; only the first is displayed. */
  questions: QuestionRequest[];
  /** Callback invoked after a question is answered or rejected. */
  onDismiss: (requestId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuestionDialog({ questions, onDismiss }: QuestionDialogProps) {
  const current = questions[0] as QuestionRequest | undefined;
  const questionInfo = current?.questions[0];
  const { reply, reject, isPending } = useQuestionReply();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customText, setCustomText] = useState('');

  // Reset local state when the question changes
  const currentId = current?.id;
  const [lastId, setLastId] = useState<string | undefined>(undefined);
  if (currentId !== lastId) {
    setLastId(currentId);
    setSelected(new Set());
    setCustomText('');
  }

  const isMultiple = questionInfo?.multiple ?? false;
  const allowCustom = questionInfo?.custom !== false;

  const toggleOption = useCallback(
    (label: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (isMultiple) {
          if (next.has(label)) next.delete(label);
          else next.add(label);
        } else {
          // Single select: replace
          next.clear();
          next.add(label);
        }
        return next;
      });
    },
    [isMultiple],
  );

  const handleSubmit = useCallback(() => {
    if (!current) return;
    const answers: string[] = [...selected];
    if (customText.trim()) {
      answers.push(customText.trim());
    }
    if (answers.length === 0) return;
    reply(
      {
        requestId: current.id,
        sessionId: current.sessionID,
        answers: [answers],
      },
      { onSettled: () => onDismiss(current.id) },
    );
  }, [current, selected, customText, reply, onDismiss]);

  const handleReject = useCallback(() => {
    if (!current) return;
    reject(
      { requestId: current.id, sessionId: current.sessionID },
      { onSettled: () => onDismiss(current.id) },
    );
  }, [current, reject, onDismiss]);

  return (
    <Dialog open={!!current} onOpenChange={() => current && handleReject()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-400" />
            {questionInfo?.header ?? t('question.default_header')}
          </DialogTitle>
          {questionInfo && (
            <DialogDescription>{questionInfo.question}</DialogDescription>
          )}
        </DialogHeader>

        {questionInfo && (
          <div className="space-y-2">
            {/* Options */}
            {questionInfo.options.map((opt) => {
              const isSelected = selected.has(opt.label);
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => toggleOption(opt.label)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50',
                    isSelected && 'border-primary bg-primary/10',
                  )}
                >
                  {isMultiple && (
                    <Checkbox
                      checked={isSelected}
                      className="mt-0.5"
                      tabIndex={-1}
                    />
                  )}
                  <div>
                    <span className="font-medium">{opt.label}</span>
                    {opt.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {opt.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Custom input */}
            {allowCustom && (
              <div className="space-y-1 pt-1">
                <Label className="text-xs text-muted-foreground">
                  {t('question.custom_label')}
                </Label>
                <Input
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder={t('question.custom_placeholder')}
                  className="text-sm"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            disabled={isPending}
          >
            {t('question.skip')}
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending || (selected.size === 0 && !customText.trim())}
          >
            {t('common.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
