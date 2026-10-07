import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import PersonVitalFacts from './PersonVitalFacts';
afterEach(cleanup);
const burial = () => within(screen.getByText('Entierro').parentElement!);
it('shows the saved burial date and place in chronological vital order', () => {
  render(<PersonVitalFacts person={{ entierro_fecha: '1989-07-06', entierro_lugar_id: 'cem' }} name="María Ríos" placeLabel={id => id === 'cem' ? 'Antofagasta, Chile' : null} />);
  expect(burial().getByText('6 de julio de 1989')).toBeVisible();
  expect(burial().getByText('Antofagasta, Chile')).toBeVisible();
  expect(screen.getAllByRole('term').map(term => term.textContent)).toEqual(['Nombre', 'Nacimiento', 'Bautismo', 'Matrimonio', 'Defunción', 'Entierro']);
});
it('shows burial information stored only as an imported event without overwriting canonical dates', () => {
  const props = { name: 'María Ríos', events: [{ tipo: 'entierro', fecha: '1989-07-07', lugar_original: 'Cementerio municipal' }], placeLabel: () => null };
  const { rerender } = render(<PersonVitalFacts {...props} person={{}} />);
  expect(burial().getByText('7 de julio de 1989')).toBeVisible();
  expect(burial().getByText('Cementerio municipal')).toBeVisible();
  rerender(<PersonVitalFacts {...props} person={{ entierro_fecha: '1989-07-06' }} />);
  expect(burial().getByText('6 de julio de 1989')).toBeVisible();
  expect(burial().queryByText('7 de julio de 1989')).toBeNull();
  expect(burial().queryByText('Cementerio municipal')).toBeNull();
  rerender(<PersonVitalFacts {...props} person={{ entierro_fecha: '1989-07-07' }} />);
  expect(burial().getByText('Cementerio municipal')).toBeVisible();
});
it('keeps approximate dates and does not invent a missing burial date', () => {
  const { rerender } = render(<PersonVitalFacts person={{}} name="María Ríos" events={[{ tipo: 'entierro', fecha_aprox: 'Hacia 1989' }]} placeLabel={() => null} />);
  expect(burial().getByText('Hacia 1989')).toBeVisible();
  rerender(<PersonVitalFacts person={{}} name="María Ríos" placeLabel={() => null} />);
  expect(burial().getByText('Dato no registrado')).toBeVisible();
});
