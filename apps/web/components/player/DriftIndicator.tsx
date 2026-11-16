import React from 'react';
import { DriftCorrection } from '@watchparty/shared';
import { Activity, ShieldCheck, Zap } from 'lucide-react';

interface DriftIndicatorProps {
  driftInfo: DriftCorrection;
  baseRate?: number;
  isConnected: boolean;
}

export function DriftIndicator({ driftInfo, baseRate = 1.0, isConnected }: DriftIndicatorProps) {
  if (!isConnected) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
        <span>Reconnecting...</span>
      </div>
    );
  }

  const { action, drift, effectiveRate } = driftInfo;
  const absDriftMs = Math.round(Math.abs(drift) * 1000);

  if (action === 'deadband') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span>Synced ({absDriftMs}ms)</span>
      </div>
    );
  }

  if (action === 'micro_slew' || action === 'moderate_slew') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
        <span>Slewing ({effectiveRate}x · {absDriftMs}ms)</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
      <Zap className="w-3.5 h-3.5 animate-bounce" />
      <span>Hard Seeking ({absDriftMs}ms)</span>
    </div>
  );
}
