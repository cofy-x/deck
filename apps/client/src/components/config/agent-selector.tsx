/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronsUpDown, Check, Bot } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useAgents } from '@/hooks/use-config';
import { useChatStore } from '@/stores/chat-store';
import { t } from '@/i18n';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentSelector({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { data: agents } = useAgents();
  const selectedAgent = useChatStore((s) => s.selectedAgent);
  const setSelectedAgent = useChatStore((s) => s.setSelectedAgent);

  // Support programmatic opening via chat store
  const externalOpen = useChatStore((s) => s.agentSelectorOpen);
  const setExternalOpen = useChatStore((s) => s.setAgentSelectorOpen);
  const requestInputFocus = useChatStore((s) => s.requestInputFocus);

  useEffect(() => {
    if (externalOpen) {
      setOpen(true);
      setExternalOpen(false);
    }
  }, [externalOpen, setExternalOpen]);

  // When popover closes after being opened via command, refocus the input
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      requestInputFocus();
    }
  }, [open, requestInputFocus]);

  const currentAgent = agents?.find((a) => a.name === selectedAgent);
  const displayLabel = currentAgent?.name ?? agents?.[0]?.name ?? t('agent.default_label');

  const handleSelect = useCallback(
    (name: string) => {
      setSelectedAgent(name === selectedAgent ? null : name);
      setOpen(false);
    },
    [selectedAgent, setSelectedAgent],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn('h-7 gap-1 px-2 text-xs font-normal', className)}
        >
          <Bot className="h-3.5 w-3.5" />
          <span className="truncate max-w-[100px]">{displayLabel}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('agent.search')} />
          <CommandList>
            <CommandEmpty>{t('agent.no_agents')}</CommandEmpty>
            <CommandGroup>
              {agents?.map((agent) => {
                const isActive =
                  agent.name === (selectedAgent ?? agents[0]?.name);
                const hoverTitle = agent.description
                  ? `${agent.name}: ${agent.description}`
                  : agent.name;
                return (
                  <CommandItem
                    key={agent.name}
                    value={agent.name}
                    title={hoverTitle}
                    onSelect={() => handleSelect(agent.name)}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <Check
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        isActive ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="text-sm"
                        style={agent.color ? { color: agent.color } : undefined}
                      >
                        {agent.name}
                      </span>
                      {agent.description && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                          {agent.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
