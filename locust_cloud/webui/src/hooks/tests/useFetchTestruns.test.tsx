import { act } from 'react';
import { SWARM_STATE } from 'locust-ui';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { beforeAll, afterEach, afterAll, describe, expect, test, vi } from 'vitest';

import useFetchTestruns from 'hooks/useFetchTestruns';
import { TEST_BASE_API } from 'test/constants';
import { renderWithProvider } from 'test/testUtils';

const mockRunIds = [
  '2024-11-30 10:09:10.771147+00:00',
  '2024-10-30 05:58:31.234505+00:00',
  '2024-10-30 06:00:44.325405+00:00',
];
const mockTestrunsForDisplay = mockRunIds.map(runId => new Date(runId).toLocaleString());
const mockTestrunsResponse = [
  {
    endTime: '2024-11-30 11:00:37.653931+00:00',
    locustfile: 'locustfile.py',
    profile: null,
    runId: mockRunIds[0],
  },
  {
    endTime: '2024-10-30 08:39:22.358997+00:00',
    locustfile: 'locustfile.py',
    profile: null,
    runId: mockRunIds[1],
  },
  {
    endTime: '2024-10-30 08:39:22.358997+00:00',
    locustfile: 'different_locustfile.py',
    profile: 'myprofile',
    runId: mockRunIds[2],
  },
];
const mockTestruns = {
  [mockTestrunsForDisplay[0]]: {
    runId: mockRunIds[0],
    endTime: mockTestrunsResponse[0].endTime,
    index: 0,
  },
  [mockTestrunsForDisplay[1]]: {
    runId: mockRunIds[1],
    endTime: mockTestrunsResponse[1].endTime,
    index: 1,
  },
  [mockTestrunsForDisplay[2]]: {
    runId: mockRunIds[2],
    endTime: mockTestrunsResponse[2].endTime,
    index: 2,
  },
};

const server = setupServer(
  http.post(`${TEST_BASE_API}/testruns`, () => HttpResponse.json(mockTestrunsResponse)),
);

function MockHook() {
  useFetchTestruns();

  return <div />;
}

describe('useFetchStats', () => {
  beforeAll(() => {
    server.listen();
    vi.useFakeTimers();
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => {
    server.close();
    vi.useRealTimers();
  });

  test('should fetch testruns and update the toolbar accordingly', async () => {
    const { store } = renderWithProvider(<MockHook />, undefined, {
      swarm: { state: SWARM_STATE.RUNNING },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(store.getState().toolbar.testrunsForDisplay).toEqual(mockTestrunsForDisplay);
    expect(store.getState().toolbar.testruns).toEqual(mockTestruns);
    expect(store.getState().toolbar.currentTestrunIndex).toBe(0);
    expect(store.getState().toolbar.currentTestrun).toBe(mockRunIds[0]);
  });

  test('should fetch testruns if isGraphViewer', async () => {
    window.templateArgs.isGraphViewer = true;
    const { store } = renderWithProvider(<MockHook />);
    window.templateArgs.isGraphViewer = false;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(store.getState().toolbar.testrunsForDisplay).toEqual(mockTestrunsForDisplay);
  });

  test('should set the current testrun according to url if isGraphViewer', async () => {
    window.templateArgs.isGraphViewer = true;
    const { store } = renderWithProvider(<MockHook />, undefined, {
      url: { query: { testrun: mockTestrunsForDisplay[1] } },
    });
    window.templateArgs.isGraphViewer = false;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(store.getState().toolbar.currentTestrunIndex).toBe(1);
    expect(store.getState().toolbar.currentTestrun).toBe(mockRunIds[1]);
  });

  test('should fetch testruns if hasDismissedSwarmForm', async () => {
    const { store } = renderWithProvider(<MockHook />, { ui: { hasDismissedSwarmForm: true } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(store.getState().toolbar.testrunsForDisplay).toEqual(mockTestrunsForDisplay);
  });

  test('should set the current testrun according to url if hasDismissedSwarmForm', async () => {
    const { store } = renderWithProvider(
      <MockHook />,
      { ui: { hasDismissedSwarmForm: true } },
      {
        url: { query: { testrun: mockTestrunsForDisplay[1] } },
      },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(store.getState().toolbar.currentTestrunIndex).toBe(1);
    expect(store.getState().toolbar.currentTestrun).toBe(mockRunIds[1]);
  });

  test('should filter testrunsForDisplay by locustfile', async () => {
    const { store } = renderWithProvider(
      <MockHook />,
      { toolbar: { profile: mockTestrunsResponse[0].locustfile, testrunsForDisplay: [] } },
      {
        swarm: { state: SWARM_STATE.RUNNING },
      },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(store.getState().toolbar.testrunsForDisplay.length).toEqual(2);
  });

  test('should filter testrunsForDisplay by profile', async () => {
    const { store } = renderWithProvider(
      <MockHook />,
      { toolbar: { profile: mockTestrunsResponse[2].profile, testrunsForDisplay: [] } },
      {
        swarm: { state: SWARM_STATE.RUNNING },
      },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(store.getState().toolbar.testrunsForDisplay.length).toEqual(1);
    expect(store.getState().toolbar.currentTestrunIndex).toEqual(2);
    expect(store.getState().toolbar.currentTestrun).toEqual(mockTestrunsResponse[2].runId);
  });

  test('should filter testrunsForDisplay by profile from url', async () => {
    const { store } = renderWithProvider(
      <MockHook />,
      { ui: { hasDismissedSwarmForm: true } },
      {
        url: { query: { profile: mockTestrunsResponse[2].profile } },
      },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(store.getState().toolbar.testrunsForDisplay.length).toEqual(1);
  });
});
