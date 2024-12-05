import { act } from 'react';
import { SWARM_STATE } from 'locust-ui';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import Testruns from 'components/tabs/Testruns';
import { TEST_BASE_API } from 'test/constants';
import { mockTestrunsResponse } from 'test/mocks/testruns.mock';
import { MockFetchTestrunsHook, renderWithProvider } from 'test/testUtils';

const mockRequestTime = '2024-12-04 19:01:00+00:00';
const mockTestrunsTable = [
  {
    runId: mockRequestTime,
    profile: 'profile',
    locustfile: 'locust.py',
    username: 'mock-user',
    numUsers: '5',
    workerCount: '1',
    requests: '2',
    respTime: '20',
    rpsAvg: '10',
    failRatio: '13',
    exitCode: '0',
    runTime: '44',
  },
];
const mockTestrunsRps = [{ avgRps: '55', avgRpsFailed: '2', time: mockRequestTime }];
const mockTestrunsResponseTime = [
  { avgResponseTime: '15', avgResponseTimeFailed: '4', time: mockRequestTime },
];

const server = setupServer(
  http.post(`${TEST_BASE_API}/testruns-table`, () => HttpResponse.json(mockTestrunsTable)),
  http.post(`${TEST_BASE_API}/testruns-rps`, () => HttpResponse.json(mockTestrunsRps)),
  http.post(`${TEST_BASE_API}/testruns-response-time`, () =>
    HttpResponse.json(mockTestrunsResponseTime),
  ),
  http.post(`${TEST_BASE_API}/profiles`, () => HttpResponse.json([])),
  http.post(`${TEST_BASE_API}/testruns`, () => HttpResponse.json(mockTestrunsResponse)),
);

describe('Testruns Tab', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  test('should render the tables and graphs', () => {
    const { container, getByRole } = renderWithProvider(<Testruns />);

    expect(getByRole('table')).toBeTruthy();
    expect(container.querySelectorAll('canvas').length).toBe(2);
  });

  test('should render the table data', async () => {
    vi.useFakeTimers();

    const { getByRole } = renderWithProvider(
      <MockFetchTestrunsHook>
        <Testruns />
      </MockFetchTestrunsHook>,
      undefined,
      { swarm: { state: SWARM_STATE.RUNNING } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    const mockTestrunsTableRowData = { ...mockTestrunsTable[0] };
    mockTestrunsTableRowData.runId = new Date(mockTestrunsTable[0].runId).toLocaleString();

    expect(
      getByRole('row', { name: Object.values(mockTestrunsTableRowData).join(' ') }),
    ).toBeTruthy();

    vi.useRealTimers();
  });

  test('should render the toolbar', async () => {
    vi.useFakeTimers();

    const { getByRole, queryByRole } = renderWithProvider(
      <MockFetchTestrunsHook>
        <Testruns />
      </MockFetchTestrunsHook>,
      undefined,
      { swarm: { state: SWARM_STATE.RUNNING } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(getByRole('combobox', { name: 'Profile' })).toBeTruthy();
    expect(queryByRole('combobox', { name: 'Test Run' })).toBeFalsy();
    expect(queryByRole('combobox', { name: 'Resolution' })).toBeFalsy();
    expect(queryByRole('checkbox', { name: 'Advanced' })).toBeFalsy();

    vi.useRealTimers();
  });
});
