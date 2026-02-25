/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { cva, type VariantProps } from 'class-variance-authority';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusBadgeVariants = cva('', {
  variants: {
    status: {
      online:
        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      offline: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      running:
        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      stopped: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      terminated:
        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      pending:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      creating: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      provisioning:
        'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      healthy:
        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      unhealthy: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    },
  },
  defaultVariants: {
    status: 'unknown',
  },
});

export type StatusType = NonNullable<
  VariantProps<typeof statusBadgeVariants>['status']
>;

interface StatusBadgeProps {
  // Accept any string to handle API responses (ONLINE, OFFLINE, RUNNING, etc.)
  status?: string | null;
  className?: string;
  children?: React.ReactNode;
  showDot?: boolean;
}

const statusLabels: Record<StatusType, string> = {
  online: 'Online',
  offline: 'Offline',
  running: 'Running',
  stopped: 'Stopped',
  terminated: 'Terminated',
  pending: 'Pending',
  creating: 'Creating',
  provisioning: 'Provisioning',
  error: 'Error',
  healthy: 'Healthy',
  unhealthy: 'Unhealthy',
  unknown: 'Unknown',
};

export function StatusBadge({
  status,
  className,
  children,
  showDot = true,
}: StatusBadgeProps) {
  // Normalize status to lowercase to handle API responses (which use UPPERCASE)
  const normalizedStatus = (
    typeof status === 'string' ? status.toLowerCase() : status
  ) as StatusType | undefined;
  const statusValue = normalizedStatus ?? 'unknown';
  const dotColors: Record<StatusType, string> = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    running: 'bg-green-500',
    stopped: 'bg-gray-500',
    terminated: 'bg-gray-400',
    pending: 'bg-yellow-500',
    creating: 'bg-blue-500',
    provisioning: 'bg-blue-500',
    error: 'bg-red-500',
    healthy: 'bg-green-500',
    unhealthy: 'bg-red-500',
    unknown: 'bg-gray-500',
  };

  return (
    <Badge
      variant="outline"
      className={cn(statusBadgeVariants({ status: statusValue }), className)}
    >
      {showDot && (
        <span
          className={cn(
            'mr-1.5 inline-block size-2 rounded-full',
            dotColors[statusValue],
          )}
        />
      )}
      {children ?? statusLabels[statusValue]}
    </Badge>
  );
}
