import { describe, test, expect } from 'vitest';

import Gauge from 'components/Gauge/Gauge';
import { renderWithProvider } from 'test/testUtils';

describe('Gauge', () => {
  test('should render a Gauge', () => {
    const { container } = renderWithProvider(<Gauge gaugeValue={5} name='Gauge' />);

    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
