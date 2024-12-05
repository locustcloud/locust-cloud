import { act } from 'react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, test } from 'vitest';

import ViewTypeSelector from 'components/Layout/ViewTypeSelector';
import { UI_VIEW_TYPES } from 'redux/slice/ui.slice';
import { renderWithProvider } from 'test/testUtils';

describe('ViewTypeSelector', () => {
  test('should set the expected view type on click', () => {
    const { store, getByRole } = renderWithProvider(<ViewTypeSelector />);

    const buttonToggle = getByRole('button');

    expect(store.getState().ui.viewType).toBe(UI_VIEW_TYPES.CLOUD);

    act(() => {
      fireEvent.click(buttonToggle);
    });

    expect(store.getState().ui.viewType).toBe(UI_VIEW_TYPES.CLASSIC);

    act(() => {
      fireEvent.click(buttonToggle);
    });

    expect(store.getState().ui.viewType).toBe(UI_VIEW_TYPES.CLOUD);
  });
});
