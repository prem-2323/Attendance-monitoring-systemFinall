import React from 'react';

/**
 * Core base Skeleton component
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-700/50 ${className}`}
      {...props}
    />
  );
};

export const SkeletonText: React.FC<{
  className?: string;
  width?: string;
  height?: string;
}> = ({ className = '', width = 'w-24', height = 'h-3.5' }) => {
  return <Skeleton className={`${height} ${width} rounded-md ${className}`} />;
};

export const SkeletonBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  return <Skeleton className={`h-5 w-16 rounded-md ${className}`} />;
};

export const SkeletonAvatar: React.FC<{
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  rounded?: string;
}> = ({ size = 'md', className = '', rounded = 'rounded-xl' }) => {
  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
    xl: 'h-24 w-24',
  };
  return <Skeleton className={`${sizeMap[size]} ${rounded} ${className}`} />;
};

/**
 * Metric KPI Stat Card Skeleton
 */
export const SkeletonStatCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <div className="flex items-center gap-2 pt-1">
          <Skeleton className="h-3 w-12 rounded-md" />
          <Skeleton className="h-3 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
};

/**
 * Grid of Stat Cards
 */
export const SkeletonStatsGrid: React.FC<{ count?: number; cols?: string }> = ({
  count = 4,
  cols = 'grid-cols-2 lg:grid-cols-4',
}) => {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>
  );
};

/**
 * Table Skeleton with search/filter bar and configurable rows & columns
 */
export const SkeletonTable: React.FC<{
  rows?: number;
  cols?: number;
  hasFilterBar?: boolean;
}> = ({ rows = 5, cols = 6, hasFilterBar = true }) => {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white saas-card-shadow overflow-hidden">
      {hasFilterBar && (
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-60 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl hidden sm:block" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>
      )}

      {/* Table Head */}
      <div className="border-b border-slate-200/80 bg-slate-50/75 px-6 py-3.5">
        <div className="grid grid-cols-12 gap-4 items-center">
          {Array.from({ length: cols }).map((_, i) => (
            <div
              key={i}
              className={
                i === 0
                  ? 'col-span-3'
                  : i === 1
                  ? 'col-span-2'
                  : i === cols - 1
                  ? 'col-span-2 flex justify-end'
                  : 'col-span-1 sm:col-span-1 md:col-span-2'
              }
            >
              <Skeleton className="h-3.5 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Table Body Rows */}
      <div className="divide-y divide-slate-100 px-6">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="grid grid-cols-12 gap-4 py-4 items-center">
            {/* Col 1: Avatar + Name */}
            <div className="col-span-3 flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
              <div className="space-y-1.5 min-w-0 flex-1">
                <Skeleton className="h-3.5 w-24 rounded-md" />
                <Skeleton className="h-2.5 w-16 rounded-md" />
              </div>
            </div>

            {/* Col 2 */}
            <div className="col-span-2 space-y-1.5">
              <Skeleton className="h-3.5 w-20 rounded-md" />
              <Skeleton className="h-2.5 w-14 rounded-md" />
            </div>

            {/* Col 3: Status badge */}
            <div className="col-span-2">
              <Skeleton className="h-6 w-20 rounded-md" />
            </div>

            {/* Col 4 */}
            <div className="col-span-2 hidden md:block">
              <Skeleton className="h-3.5 w-24 rounded-md" />
            </div>

            {/* Col 5: Actions */}
            <div className="col-span-3 flex justify-end gap-2">
              <Skeleton className="h-8 w-16 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Table Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3">
        <Skeleton className="h-3 w-36 rounded-md" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-16 rounded-lg" />
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

/**
 * Grid of Roster/Team Cards (Employee directory, Manager cards)
 */
export const SkeletonRosterGrid: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow space-y-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-3 w-16 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-5 w-14 rounded-md" />
          </div>

          <div className="space-y-2 border-y border-slate-100 py-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16 rounded-md" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Chart & Analytics Card Skeleton
 */
export const SkeletonChartCard: React.FC<{ className?: string; height?: string }> = ({
  className = '',
  height = 'h-64',
}) => {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow space-y-5 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-3 w-48 rounded-md" />
        </div>
        <Skeleton className="h-8 w-28 rounded-xl" />
      </div>

      <div className={`flex items-end gap-3 ${height} pt-6 pb-2 px-2 border-b border-slate-100`}>
        {Array.from({ length: 8 }).map((_, i) => {
          const heights = ['h-3/4', 'h-1/2', 'h-4/5', 'h-2/3', 'h-full', 'h-3/5', 'h-5/6', 'h-4/6'];
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <Skeleton className={`w-full ${heights[i % heights.length]} rounded-t-md`} />
              <Skeleton className="h-2.5 w-6 rounded-md" />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs pt-1">
        <Skeleton className="h-3 w-32 rounded-md" />
        <Skeleton className="h-3 w-24 rounded-md" />
      </div>
    </div>
  );
};

/**
 * List / Feed Activity Card Skeleton
 */
export const SkeletonListCard: React.FC<{ rows?: number; title?: string }> = ({
  rows = 4,
}) => {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <Skeleton className="h-5 w-36 rounded-md" />
        <Skeleton className="h-4 w-16 rounded-md" />
      </div>
      <div className="space-y-3.5 divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-32 rounded-md" />
                <Skeleton className="h-2.5 w-24 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
};
