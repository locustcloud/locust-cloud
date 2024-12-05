import { act } from 'react';
import { SWARM_STATE } from 'locust-ui';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import Stats from 'components/tabs/Stats';
import { TEST_BASE_API } from 'test/constants';
import { mockTestrunsResponse } from 'test/mocks/testruns.mock';
import { MockFetchTestrunsHook, renderWithProvider } from 'test/testUtils';

const mockRequestName = '/';
const mockStatsData = [
  {
    name: mockRequestName,
    method: 'GET',
    requests: 20,
    failed: 1,
    max: 2,
    errorPercentage: 5,
  },
];
const mockFailuresData = [{ name: mockRequestName, exception: 'Failure message', count: 3 }];
const mockTotalRequests = [{ totalRequests: 13 }];
const mockTotalFailures = [{ totalFailures: 1 }];
const mockErrorPercentage = [{ errorPercentage: 5 }];

const server = setupServer(
  http.post(`${TEST_BASE_API}/requests`, () => HttpResponse.json(mockStatsData)),
  http.post(`${TEST_BASE_API}/failures`, () => HttpResponse.json(mockFailuresData)),
  http.post(`${TEST_BASE_API}/total-requests`, () => HttpResponse.json(mockTotalRequests)),
  http.post(`${TEST_BASE_API}/total-failures`, () => HttpResponse.json(mockTotalFailures)),
  http.post(`${TEST_BASE_API}/error-percentage`, () => HttpResponse.json(mockErrorPercentage)),
  http.post(`${TEST_BASE_API}/profiles`, () => HttpResponse.json([])),
  http.post(`${TEST_BASE_API}/testruns`, () => HttpResponse.json(mockTestrunsResponse)),
);

describe('Stats Tab', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  test('should render the tables', () => {
    const { getByRole, getAllByRole } = renderWithProvider(<Stats />);

    expect(getByRole('heading', { name: 'Request Statistics' })).toBeTruthy();
    expect(getByRole('heading', { name: 'Failure Statistics' })).toBeTruthy();
    expect(getAllByRole('table').length).toBe(2);
  });

  test('should render the table data', async () => {
    vi.useFakeTimers();

    const { container, getByRole, getByText } = renderWithProvider(
      <MockFetchTestrunsHook>
        <Stats />
      </MockFetchTestrunsHook>,
      undefined,
      { swarm: { state: SWARM_STATE.RUNNING } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    const totalRequestsHeader = getByText('Total Requests');
    const totalFailuresHeader = getByText('Total Failures');
    const errorPercentageGauge = container.querySelector('canvas');

    expect(getByRole('row', { name: Object.values(mockFailuresData[0]).join(' ') })).toBeTruthy();
    expect(getByRole('row', { name: Object.values(mockStatsData[0]).join(' ') })).toBeTruthy();
    expect(errorPercentageGauge).toBeTruthy();
    expect(totalRequestsHeader).toBeTruthy();
    expect(totalFailuresHeader).toBeTruthy();
    expect(totalRequestsHeader.nextElementSibling?.textContent).toBe(
      String(mockTotalRequests[0].totalRequests),
    );
    expect(totalFailuresHeader.nextElementSibling?.textContent).toBe(
      String(mockTotalFailures[0].totalFailures),
    );

    vi.useRealTimers();
  });

  test('should render the toolbar', async () => {
    vi.useFakeTimers();

    const { getByRole, queryByRole } = renderWithProvider(
      <MockFetchTestrunsHook>
        <Stats />
      </MockFetchTestrunsHook>,
      undefined,
      { swarm: { state: SWARM_STATE.RUNNING } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(getByRole('combobox', { name: 'Profile' })).toBeTruthy();
    expect(getByRole('combobox', { name: 'Test Run' })).toBeTruthy();
    expect(queryByRole('combobox', { name: 'Resolution' })).toBeFalsy();
    expect(queryByRole('checkbox', { name: 'Advanced' })).toBeFalsy();

    vi.useRealTimers();
  });
});
