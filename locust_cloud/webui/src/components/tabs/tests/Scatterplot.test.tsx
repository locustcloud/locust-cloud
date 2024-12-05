import { act } from 'react';
import { SWARM_STATE } from 'locust-ui';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import Scatterplot from 'components/tabs/Scatterplot';
import { TEST_BASE_API } from 'test/constants';
import { mockTestrunsResponse } from 'test/mocks/testruns.mock';
import { MockFetchTestrunsHook, renderWithProvider } from 'test/testUtils';

const profiles = [{ profile: 'myprofile' }];
const mockRequestNames = [{ name: '/' }];
const mockScatterplotResponse = [
  { responseTime: '123', name: '/', time: '2024-12-04 19:01:00+00:00' },
];

const server = setupServer(
  http.post(`${TEST_BASE_API}/request-names`, () => HttpResponse.json(mockRequestNames)),
  http.post(`${TEST_BASE_API}/scatterplot`, () => HttpResponse.json(mockScatterplotResponse)),
  http.post(`${TEST_BASE_API}/profiles`, () => HttpResponse.json(profiles)),
  http.post(`${TEST_BASE_API}/testruns`, () => HttpResponse.json(mockTestrunsResponse)),
);

describe('Scatterplot', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  test('should render a Scatterplot', async () => {
    vi.useFakeTimers();

    const { container } = renderWithProvider(
      <MockFetchTestrunsHook>
        <Scatterplot />
      </MockFetchTestrunsHook>,
      undefined,
      {
        swarm: { state: SWARM_STATE.RUNNING },
      },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(container.querySelector('canvas')).toBeTruthy();

    vi.useRealTimers();
  });

  test('should render a Toolbar with profiles', async () => {
    vi.useFakeTimers();

    const { getByRole } = renderWithProvider(<Scatterplot />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(getByRole('combobox', { name: 'Profile' })).toBeTruthy();

    vi.useRealTimers();
  });
});
