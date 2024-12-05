import { waitFor } from '@testing-library/dom';
import { SWARM_STATE } from 'locust-ui';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';

import Toolbar from 'components/Toolbar/Toolbar';
import { TEST_BASE_API } from 'test/constants';
import { mockTestrunsForDisplay, mockTestrunsResponse } from 'test/mocks/testruns.mock';
import { MockFetchTestrunsHook, renderWithProvider } from 'test/testUtils';

const profiles = [{ profile: 'myprofile' }];

const server = setupServer(
  http.post(`${TEST_BASE_API}/profiles`, () => HttpResponse.json(profiles)),
  http.post(`${TEST_BASE_API}/testruns`, () => HttpResponse.json(mockTestrunsResponse)),
);

describe('Toolbar', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  test('should render a toolbar with profiles only', async () => {
    const { getAllByText, queryByText, getByText, queryByRole } = renderWithProvider(<Toolbar />);

    await waitFor(() => {
      expect(getAllByText('Profile')).toBeTruthy();
      expect(getByText('None')).toBeTruthy();
      expect(getByText(profiles[0].profile)).toBeTruthy();
    });

    expect(queryByText('Test Run')).toBeFalsy();
    expect(queryByRole('checkbox', { name: 'Advanced' })).toBeFalsy();
  });

  test('should render testruns when shouldShowTestruns', async () => {
    const { getAllByText, getByText } = renderWithProvider(
      <MockFetchTestrunsHook>
        <Toolbar shouldShowTestruns />
      </MockFetchTestrunsHook>,
      undefined,
      {
        swarm: { state: SWARM_STATE.RUNNING },
      },
    );

    await waitFor(() => {
      expect(getAllByText('Test Run')).toBeTruthy();
    });

    mockTestrunsForDisplay.forEach(runId => {
      expect(getByText(runId)).toBeTruthy();
    });
  });

  test('should render advanced toggle when showHideAdvanced', async () => {
    const { getByRole } = renderWithProvider(<Toolbar showHideAdvanced />);

    expect(getByRole('checkbox', { name: 'Advanced' })).toBeTruthy();
  });
});
