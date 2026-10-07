import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import PersonPortrait from './PersonPortrait';
afterEach(cleanup);
it('shows the saved portrait and updates when another photo is selected', () => {
  const { rerender } = render(<PersonPortrait src="https://example.com/first.jpg" name="María Ríos" />);
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/first.jpg');
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('img')).toHaveTextContent('MR');
  rerender(<PersonPortrait src="https://example.com/new.jpg" name="María Ríos" />);
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/new.jpg');
});
