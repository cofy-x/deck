/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';

import { AppLayout } from '@/components/common/app-layout';
import { ErrorBoundary } from '@/components/common/error-boundary';

export const Route = createRootRoute({
  component: () => (
    <ErrorBoundary>
      <AppLayout />
      <TanStackRouterDevtools />
    </ErrorBoundary>
  ),
});
