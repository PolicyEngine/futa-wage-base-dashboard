import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '@/app/(shell)/page';
import Footer from '@/components/Footer';
import { RESULTS, FIRST, LAST, TEN_YEAR_TOTAL, VALIDATION, MODEL_INFO } from '@/lib/data';
import { formatBillions, formatDollars, formatSignedPercent } from '@/lib/format';

describe('Estimates tab', () => {
  it('renders headline figures from the data module, not literals', () => {
    render(<Home />);
    expect(screen.getByText(formatBillions(TEN_YEAR_TOTAL))).toBeInTheDocument();
    // Headline card and the selected-year card both show the first-year gain.
    expect(screen.getAllByText(`+${formatBillions(FIRST.additional)}`)).toHaveLength(2);
    expect(
      screen.getByText(
        new RegExp(
          `${formatBillions(FIRST.baseline)} to ${formatBillions(FIRST.reform)}, ${(
            FIRST.reform / FIRST.baseline
          ).toFixed(1)} times`.replace(/[$.]/g, '\\$&'),
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${formatDollars(FIRST.wageBase)} to ${formatDollars(LAST.wageBase)}`),
    ).toBeInTheDocument();
  });

  it('says where $43,000 comes from and what FUTA pays for', () => {
    render(<Home />);
    expect(screen.getByText(/median annual wage of U\.S\. workers in 2023/)).toBeInTheDocument();
    expect(screen.getByText(/FUTA revenue pays for state administration/)).toBeInTheDocument();
  });

  it('uses an accessible tab list and a radio group for years', () => {
    render(<Home />);
    const tablist = screen.getByRole('tablist', { name: 'Dashboard sections' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('aria-controls', 'panel-estimates');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'panel-estimates');

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(RESULTS.length);
    expect(radios[0]).toBeChecked();
    fireEvent.click(radios[RESULTS.length - 1]);
    expect(radios[RESULTS.length - 1]).toBeChecked();
    expect(screen.getAllByText(`+${formatBillions(LAST.additional)}`).length).toBeGreaterThan(0);
  });

  it('moves between tabs with arrow keys', () => {
    render(<Home />);
    const [first] = screen.getAllByRole('tab');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Validation and methods' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'panel-validation');
  });

  it('labels the chart for screen readers', () => {
    render(<Home />);
    expect(screen.getByRole('figure', { name: /FUTA revenue by calendar year/ })).toBeInTheDocument();
  });
});

describe('Validation and methods tab', () => {
  it('shows fiscal-year-basis comparisons with signed gaps', () => {
    render(<Home />);
    fireEvent.click(screen.getByRole('tab', { name: 'Validation and methods' }));
    for (const v of VALIDATION) {
      const gap = (v.modelFiscalYear - v.irsGross) / v.irsGross;
      expect(screen.getByText(`Model ${formatSignedPercent(gap)} vs. IRS`)).toBeInTheDocument();
      expect(screen.getAllByText(formatBillions(v.modelFiscalYear)).length).toBeGreaterThan(0);
    }
  });

  it('does not claim the model applies Virgin Islands surcharges', () => {
    render(<Home />);
    fireEvent.click(screen.getByRole('tab', { name: 'Validation and methods' }));
    expect(screen.getByText(/no Virgin Islands employers/)).toBeInTheDocument();
    expect(screen.queryByText(/model applies each year.s statutory/)).not.toBeInTheDocument();
  });

  it('states the model version once, from the data module', () => {
    render(<Home />);
    fireEvent.click(screen.getByRole('tab', { name: 'Validation and methods' }));
    expect(screen.getByText(new RegExp(`policyengine-us ${MODEL_INFO.policyengineUs}`))).toBeInTheDocument();
  });
});

describe('Footer', () => {
  it('shows the model version from the data module and a real subscribe form', () => {
    const { container } = render(<Footer />);
    expect(container.textContent).toContain(`policyengine-us v${MODEL_INFO.policyengineUs}`);
    const email = screen.getByLabelText('Email address');
    expect(email).toHaveAttribute('name', 'EMAIL');
    expect(email.closest('form')).toHaveAttribute(
      'action',
      expect.stringContaining('list-manage.com/subscribe/post'),
    );
  });
});
