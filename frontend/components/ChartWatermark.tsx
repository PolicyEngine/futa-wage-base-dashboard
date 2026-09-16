'use client';

import { asset } from '@/lib/site';

/**
 * PolicyEngine logo watermark for Recharts charts.
 * Place directly after <ResponsiveContainer> to render
 * a right-aligned logo below the chart (matching app-v2).
 */
export default function ChartWatermark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset('/policyengine-logo-teal.png')}
      alt=""
      aria-hidden="true"
      style={{
        display: 'block',
        marginLeft: 'auto',
        width: 80,
        opacity: 0.8,
      }}
    />
  );
}
