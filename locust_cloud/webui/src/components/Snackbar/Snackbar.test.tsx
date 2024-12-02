import { describe, expect, test, vi } from 'vitest';

import Snackbar from 'components/Snackbar/Snackbar';
import { renderWithProvider } from 'test/testUtils';

describe('Snackbar', () => {
  test('should render a snackbar', () => {
    const snackbarMessage = 'Hello, World!';

    const { getByText } = renderWithProvider(<Snackbar />, {
      snackbar: { message: snackbarMessage },
    });

    expect(getByText(snackbarMessage)).toBeTruthy();
  });

  test('should not render a snackbar by default', () => {
    const { queryByRole } = renderWithProvider(<Snackbar />);

    expect(queryByRole('alert')).toBeFalsy();
  });
});
