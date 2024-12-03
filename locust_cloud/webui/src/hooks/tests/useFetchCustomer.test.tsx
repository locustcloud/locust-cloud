import { waitFor } from '@testing-library/dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { beforeAll, afterEach, afterAll, describe, expect, test } from 'vitest';

import useFetchCustomer from 'hooks/useFetchCustomer';
import { TEST_BASE_API } from 'test/constants';
import { renderWithProvider } from 'test/testUtils';

const mockCustomer = [
  {
    maxUsers: 1000,
    maxVuh: 10000,
    maxWorkers: 2,
    usersPerWorker: 500,
  },
];
const totalVuhFormatted = '74 hours, 30 minutes';

const server = setupServer(
  http.post(`${TEST_BASE_API}/total-vuh`, () => HttpResponse.json([{ totalVuh: '3 days, 2:30' }])),
  http.post(`${TEST_BASE_API}/customer`, () => HttpResponse.json(mockCustomer)),
);

function MockHook() {
  useFetchCustomer();

  return <div />;
}

describe('useFetchCustomer', () => {
  beforeAll(() => {
    server.listen();
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => {
    server.close();
  });

  test('should fetch and format totalVuh', async () => {
    const { store } = renderWithProvider(<MockHook />);

    await waitFor(() => {
      expect(store.getState().customer.totalVuh).toEqual(totalVuhFormatted);
    });
  });

  test('should fetch and set customer', async () => {
    const { store } = renderWithProvider(<MockHook />);

    await waitFor(() => {
      expect(store.getState().customer).toEqual({
        ...mockCustomer[0],
        totalVuh: totalVuhFormatted,
        username: '',
      });
    });
  });
});
