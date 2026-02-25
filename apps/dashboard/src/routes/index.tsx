/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { Activity, Server } from 'lucide-react';

import { PageHeader, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppControllerHealth } from '@/lib/api/generated/app/app';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: healthData, isLoading: healthLoading } =
    useAppControllerHealth();

  const isHealthy = healthData?.status === 200;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your Deck infrastructure"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/">
                <Server className="mr-2 size-4" />
                Hello X
              </Link>
            </Button>
          </div>
        }
      />

      {/* System Health Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Status</CardTitle>
          <Activity
            className={`size-4 ${
              healthLoading
                ? 'text-muted-foreground animate-pulse'
                : isHealthy
                  ? 'text-green-500'
                  : 'text-destructive'
            }`}
          />
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div className="flex items-center gap-3">
              <StatusBadge status={isHealthy ? 'healthy' : 'unhealthy'} />
              <span className="text-muted-foreground text-sm">
                {isHealthy
                  ? 'All systems operational'
                  : 'API is not responding'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
