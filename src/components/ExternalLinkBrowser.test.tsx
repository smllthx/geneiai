import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import ExternalLinkBrowser, { externalPage } from './ExternalLinkBrowser';
it('keeps internal routes, unsafe protocols and downloads out of the embedded browser', () => {
  for (const value of ['/arbol', 'javascript:alert(1)', 'https://user:pass@external.example', 'https://files.example/photo.jpg', 'https://files.example/storage/v1/object/doc']) {
    expect(externalPage(value, 'https://geneai.example')).toBeNull();
  }
  expect(externalPage('https://records.example/person', 'https://geneai.example')?.hostname).toBe('records.example');
});
it('opens an external source inside the app and exposes a browser fallback', () => {
  render(<><a href="https://records.example/person">Fuente</a><ExternalLinkBrowser /></>);
  fireEvent.click(screen.getByRole('link', { name: 'Fuente' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('records.example');
  expect(screen.getByTitle('Página externa')).toHaveAttribute('src', 'https://records.example/person');
  expect(screen.getByRole('link', { name: /Abrir en navegador/ })).toHaveAttribute('rel', 'noopener noreferrer');
});
