import { act } from 'react';
import { fireEvent } from '@testing-library/dom';
import { SWARM_STATE } from 'locust-ui';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import Charts from 'components/tabs/Charts';
import { TEST_BASE_API } from 'test/constants';
import { mockTestrunsResponse } from 'test/mocks/testruns.mock';
import { MockFetchTestrunsHook, renderWithProvider } from 'test/testUtils';

const mockRequestName = '/';
const mockRequestTime = '2024-12-04 19:01:00+00:00';
const mockRequestNames = [{ name: mockRequestName }];
const mockRpsPerRequest = [{ throughput: '123', name: mockRequestName, time: mockRequestTime }];
const mockAvgResponseTimes = [
  { responseTime: '123', name: mockRequestName, time: mockRequestTime },
];
const mockErrorsPerRequest = [{ errorRate: '123', name: mockRequestName, time: mockRequestTime }];
const mockPerc99ResponseTimes = [{ perc99: '123', name: mockRequestName, time: mockRequestTime }];
const mockResponseLength = [
  { responseLength: '123', name: mockRequestName, time: mockRequestTime },
];
const mockRps = [{ users: '123', rps: '124', errorRate: '10', time: mockRequestTime }];

const server = setupServer(
  http.post(`${TEST_BASE_API}/request-names`, () => HttpResponse.json(mockRequestNames)),
  http.post(`${TEST_BASE_API}/rps-per-request`, () => HttpResponse.json(mockRpsPerRequest)),
  http.post(`${TEST_BASE_API}/avg-response-times`, () => HttpResponse.json(mockAvgResponseTimes)),
  http.post(`${TEST_BASE_API}/errors-per-request`, () => HttpResponse.json(mockErrorsPerRequest)),
  http.post(`${TEST_BASE_API}/perc99-response-times`, () =>
    HttpResponse.json(mockPerc99ResponseTimes),
  ),
  http.post(`${TEST_BASE_API}/response-length`, () => HttpResponse.json(mockResponseLength)),
  http.post(`${TEST_BASE_API}/rps`, () => HttpResponse.json(mockRps)),
  http.post(`${TEST_BASE_API}/profiles`, () => HttpResponse.json([])),
  http.post(`${TEST_BASE_API}/testruns`, () => HttpResponse.json(mockTestrunsResponse)),
);

describe('Charts Tab', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  test('should render the charts', () => {
    const { container } = renderWithProvider(<Charts />);

    expect(container.querySelectorAll('canvas').length).toBe(2);
  });

  test('should render the toolbar', () => {
    const { getByRole } = renderWithProvider(<Charts />);

    expect(getByRole('combobox', { name: 'Resolution' })).toBeTruthy();
    expect(getByRole('checkbox', { name: 'Advanced' })).toBeTruthy();
  });

  test.only('should hide the loading state after data has loaded', async () => {
    vi.useFakeTimers();

    const { getByRole, queryByRole } = renderWithProvider(
      <MockFetchTestrunsHook>
        <Charts />
      </MockFetchTestrunsHook>,
      undefined,
      {
        swarm: { state: SWARM_STATE.RUNNING },
      },
    );

    expect(getByRole('progressbar')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(queryByRole('progressbar')).toBeFalsy();
    vi.useRealTimers();
  });

  test('should show the advanced graphs on advanced view toggle', async () => {
    const { container, getByRole } = renderWithProvider(<Charts />);

    const advancedToggle = getByRole('checkbox', { name: 'Advanced' });

    act(() => {
      fireEvent.click(advancedToggle);
    });

    expect(container.querySelectorAll('canvas').length).toBe(6);
  });
});
