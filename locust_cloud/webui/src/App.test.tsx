import { act } from 'react';
import { fireEvent } from '@testing-library/dom';
import { useFetchExceptions, useFetchStats, useLogViewer } from 'locust-ui';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import App from 'App';
import { customerActions } from 'redux/slice/customer.slice';
import { UI_VIEW_TYPES } from 'redux/slice/ui.slice';
import { TEST_BASE_API } from 'test/constants';
import { mockCustomer, mockTotalVuh } from 'test/mocks/customer.mock';
import { swarmStateMock } from 'test/mocks/swarmState.mock';
import { mockTestrunsResponse } from 'test/mocks/testruns.mock';
import { renderWithProvider } from 'test/testUtils';

const server = setupServer(
  http.post(`${TEST_BASE_API}/customer`, () => HttpResponse.json([mockCustomer])),
  http.post(`${TEST_BASE_API}/total-vuh`, () => HttpResponse.json(mockTotalVuh)),
  http.post(`${TEST_BASE_API}/profiles`, () => HttpResponse.json([])),
  http.post(`${TEST_BASE_API}/testruns`, () => HttpResponse.json(mockTestrunsResponse)),
);

vi.mock('locust-ui', async () => {
  const actual = (await vi.importActual('locust-ui')) as { [key: string]: any };

  return {
    ...actual,
    useFetchStats: vi.fn(),
    useFetchExceptions: vi.fn(),
    useLogViewer: vi.fn(),
  };
});

describe('App', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  test('should render the App with the swarm form by default', () => {
    const { getByRole } = renderWithProvider(<App />);

    expect(getByRole('link', { name: 'Locust' })).toBeTruthy();
    expect(getByRole('heading', { name: 'Start new load test' })).toBeTruthy();
    expect(getByRole('textbox', { name: 'Number of users (peak concurrency)' })).toBeTruthy();
    expect(getByRole('textbox', { name: 'Ramp up (users started/second)' })).toBeTruthy();
    expect(getByRole('textbox', { name: 'Host' })).toBeTruthy();
    expect(getByRole('button', { name: 'Start' })).toBeTruthy();
  });

  test('should use the expeced locust-ui hooks', () => {
    renderWithProvider(<App />);

    expect(useFetchExceptions).toHaveBeenCalled();
    expect(useFetchStats).toHaveBeenCalled();
    expect(useLogViewer).toHaveBeenCalled();
  });

  test('should allow the swarm form to be dismissed', () => {
    const { store, getByRole, queryByRole } = renderWithProvider(<App />);

    const button = getByRole('button', { name: 'dismiss form' });

    act(() => {
      fireEvent.click(button);
    });

    expect(queryByRole('button', { name: 'Start' })).toBeFalsy();
    expect(store.getState().ui.hasDismissedSwarmForm).toBe(true);
  });

  test('should render the expected tabs by default', () => {
    const { getByRole } = renderWithProvider(<App />, {
      ui: { hasDismissedSwarmForm: true, viewType: UI_VIEW_TYPES.CLOUD },
    });

    expect(getByRole('tab', { name: 'Charts' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Stats' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Scatterplot' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Testruns' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Exceptions' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Logs' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Download Data' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Customer' })).toBeTruthy();
  });

  test('should render a workers tab when isDistributed', () => {
    const { getByRole } = renderWithProvider(
      <App />,
      { ui: { hasDismissedSwarmForm: true, viewType: UI_VIEW_TYPES.CLOUD } },
      {
        swarm: { isDistributed: true },
      },
    );

    expect(getByRole('tab', { name: 'Workers' })).toBeTruthy();
  });

  test('should render locust tabs by when viewType is classic', () => {
    const { getByRole } = renderWithProvider(<App />, {
      ui: { hasDismissedSwarmForm: true, viewType: UI_VIEW_TYPES.CLASSIC },
    });

    expect(getByRole('tab', { name: 'Statistics' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Charts' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Failures' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Exceptions' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Current Ratio' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Download Data' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Logs' })).toBeTruthy();
  });

  test('should not show the swarm form when isGraphViewer', () => {
    window.templateArgs.isGraphViewer = true;
    const { queryByRole } = renderWithProvider(<App />);
    window.templateArgs.isGraphViewer = false;

    expect(queryByRole('button', { name: 'Start' })).toBeFalsy();
  });
});

describe('useSwarmForm', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  test('should not show an alert or disable the form by default', () => {
    const { getByRole, queryByRole } = renderWithProvider(<App />, { customer: mockCustomer });

    expect(queryByRole('alert')).toBeFalsy();
    expect((getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBeFalsy();
  });

  test('should disable the form and display an alert when maxUsers has been exceeded', () => {
    const { getByRole } = renderWithProvider(<App />, { customer: mockCustomer });

    const textbox = getByRole('textbox', { name: 'Number of users (peak concurrency)' });

    act(() => {
      fireEvent.change(textbox, {
        target: { value: '20000' },
      });
    });

    expect(getByRole('alert')).toBeTruthy();
    expect(
      (getByRole('button', { name: 'Start', hidden: true }) as HTMLButtonElement).disabled,
    ).toBeTruthy();
  });

  test('should show a warning when userCount has exceeded recommended amount', () => {
    const { getByRole } = renderWithProvider(
      <App />,
      { customer: mockCustomer },
      { swarm: { ...swarmStateMock, workerCount: 1 } },
    );

    const textbox = getByRole('textbox', { name: 'Number of users (peak concurrency)' });

    act(() => {
      fireEvent.change(textbox, {
        target: { value: '501' },
      });
    });

    expect(getByRole('alert')).toBeTruthy();
    expect((getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBeFalsy();
  });

  test('should show a warning when totalVuhHours is close to exceeding maxVuh', () => {
    const { store, getByRole } = renderWithProvider(<App />);

    act(() => {
      store.dispatch(
        customerActions.setCustomer({ ...mockCustomer, totalVuh: '46 hours', maxVuh: 50 }),
      );
    });

    expect(getByRole('alert')).toBeTruthy();
    expect((getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBeFalsy();
  });

  test('should show an alert and disable the form when totalVuhHours has exceeded maxVuh', () => {
    const { store, getByRole } = renderWithProvider(<App />);

    act(() => {
      store.dispatch(
        customerActions.setCustomer({ ...mockCustomer, totalVuh: '51 hours', maxVuh: 50 }),
      );
    });

    expect(getByRole('alert')).toBeTruthy();
    expect((getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBeTruthy();
  });
});
