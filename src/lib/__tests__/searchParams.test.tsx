import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BrowserRouter, useSearchParams } from 'react-router-dom';
import { updateSearchParams } from '@/lib/searchParams';

function MonthStepper() {
  const [, setSearchParams] = useSearchParams();
  const goToSeptember = () => {
    updateSearchParams(setSearchParams, (p) => p.set('from', '2026-09-01'));
    updateSearchParams(setSearchParams, (p) => p.set('to', '2026-09-30'));
    updateSearchParams(setSearchParams, (p) => p.set('date', 'custom'));
  };
  return <button onClick={goToSeptember}>September</button>;
}

describe('updateSearchParams', () => {
  beforeEach(() => window.history.replaceState(null, '', '/transactions?category=food'));

  it('keeps every write made in one handler, and params set before it', () => {
    const { getByText } = render(
      <BrowserRouter>
        <MonthStepper />
      </BrowserRouter>,
    );
    fireEvent.click(getByText('September'));
    const params = new URLSearchParams(window.location.search);
    expect(Object.fromEntries(params)).toEqual({
      category: 'food',
      from: '2026-09-01',
      to: '2026-09-30',
      date: 'custom',
    });
  });
});
