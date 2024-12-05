import { SWARM_STATE } from 'locust-ui';
import { describe, expect, test } from 'vitest';

import StateButtons from 'components/Layout/StateButtons';
import { UI_VIEW_TYPES } from 'redux/slice/ui.slice';
import { renderWithProvider } from 'test/testUtils';

describe('StateButtons', () => {
  test('should render the edit and stop button during a test run', () => {
    const { getByRole, queryByRole } = renderWithProvider(<StateButtons />, undefined, {
      swarm: { state: SWARM_STATE.RUNNING },
    });

    expect(getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(queryByRole('button', { name: 'New' })).toBeFalsy();
    expect(queryByRole('button', { name: 'Reset' })).toBeFalsy();
  });

  test('should render the new button after a test is stopped', () => {
    const { getByRole, queryByRole } = renderWithProvider(<StateButtons />, undefined, {
      swarm: { state: SWARM_STATE.STOPPED },
    });

    expect(getByRole('button', { name: 'New' })).toBeTruthy();
    expect(queryByRole('button', { name: 'Edit' })).toBeFalsy();
    expect(queryByRole('button', { name: 'Stop' })).toBeFalsy();
    expect(queryByRole('button', { name: 'Reset' })).toBeFalsy();
  });

  test('should render the new button if hasDismissedForm', () => {
    const { getByRole, queryByRole } = renderWithProvider(<StateButtons />, {
      ui: { hasDismissedSwarmForm: true },
    });

    expect(getByRole('button', { name: 'New' })).toBeTruthy();
    expect(queryByRole('button', { name: 'Edit' })).toBeFalsy();
    expect(queryByRole('button', { name: 'Stop' })).toBeFalsy();
    expect(queryByRole('button', { name: 'Reset' })).toBeFalsy();
  });

  test('should render nothing before a test has been ran', () => {
    const { queryByRole } = renderWithProvider(<StateButtons />);

    expect(queryByRole('button', { name: 'New' })).toBeFalsy();
    expect(queryByRole('button', { name: 'Edit' })).toBeFalsy();
    expect(queryByRole('button', { name: 'Stop' })).toBeFalsy();
    expect(queryByRole('button', { name: 'Reset' })).toBeFalsy();
  });

  test('should render the reset button when view type is classic', () => {
    const { getByRole } = renderWithProvider(<StateButtons />, {
      ui: { viewType: UI_VIEW_TYPES.CLASSIC, hasDismissedSwarmForm: true },
    });

    expect(getByRole('button', { name: 'Reset' })).toBeTruthy();
  });
});
