import { ImageResponse } from 'next/og';
import { FIRST, LAST, TEN_YEAR_TOTAL, CURRENT_BASE } from '@/lib/data';
import { formatBillions, formatDollars } from '@/lib/format';

export const alt = 'PolicyEngine FUTA taxable wage base dashboard';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Satori (next/og) requires every element with several children to be a flex
// container, so each text run below is a single string child.
export default function OpenGraphImage() {
  const subtitle = `Raising the federal unemployment tax base from ${formatDollars(CURRENT_BASE)} to ${formatDollars(FIRST.wageBase)} and indexing it to inflation`;
  const tenYearLabel = `Additional FUTA revenue, ${FIRST.year} to ${LAST.year}`;
  const firstYearLabel = `First year (${FIRST.year})`;
  const firstYearValue = `+${formatBillions(FIRST.additional)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #234E52 0%, #2C7A7B 100%)',
          color: '#FFFFFF',
          fontFamily: 'Inter, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', fontSize: 28, letterSpacing: 4, opacity: 0.85 }}>
            POLICYENGINE
          </div>
          <div style={{ display: 'flex', fontSize: 60, fontWeight: 700, lineHeight: 1.1 }}>
            FUTA taxable wage base dashboard
          </div>
          <div style={{ display: 'flex', fontSize: 30, opacity: 0.9, lineHeight: 1.3 }}>
            {subtitle}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 64 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 24, opacity: 0.8 }}>{tenYearLabel}</div>
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 700 }}>
              {formatBillions(TEN_YEAR_TOTAL)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 24, opacity: 0.8 }}>{firstYearLabel}</div>
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 700 }}>{firstYearValue}</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
