import { act } from 'react';
import { SWARM_STATE } from 'locust-ui';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { beforeAll, afterEach, afterAll, describe, expect, test, vi } from 'vitest';

import useFetchTestruns from 'hooks/useFetchTestruns';
import { TEST_BASE_API } from 'test/constants';
import {
  mockTestrunsForDisplay,
  mockRunIds,
  mockTestruns,
  mockTestrunsResponse,
} from 'test/mocks/testruns.mock';
import { renderWithProvider } from 'test/testUtils';

const server = setupServer(
  http.post(`${TEST_BASE_API}/testruns`, () => HttpResponse.json(mockTestrunsResponse)),
);

function MockHook() {
  useFetchTestruns();

  return <div />;
}

describe('useFetchTestruns', () => {
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
