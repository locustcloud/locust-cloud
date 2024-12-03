import { describe, expect, test } from 'vitest';

import Customer from 'components/tabs/Customer';
import { swarmStateMock } from 'test/mocks/swarmState.mock';
import { renderWithProvider } from 'test/testUtils';

describe('Customer Tab', () => {
  test('should render the customer tab', () => {
    const customer = { maxVuh: 1001, totalVuh: '30 hours' };
    const mockTemplateArgs = {
      username: 'John',
      locustVersion: '123',
      locustCloudVersion: '456',
    };

    global.window.templateArgs = mockTemplateArgs;
    const { getByRole, getByText } = renderWithProvider(<Customer />, {
      customer,
    });
    global.window.templateArgs = swarmStateMock;

    expect(getByRole('button', { name: 'Logout' })).toBeTruthy();
    expect(getByText(t => t.includes(String(customer.maxVuh)))).toBeTruthy();
    expect(getByText(t => t.includes(String(customer.totalVuh)))).toBeTruthy();
    expect(getByText(t => t.includes(mockTemplateArgs.username))).toBeTruthy();
    expect(getByText(t => t.includes(mockTemplateArgs.locustVersion))).toBeTruthy();
    expect(getByText(t => t.includes(mockTemplateArgs.locustCloudVersion))).toBeTruthy();
  });
});
