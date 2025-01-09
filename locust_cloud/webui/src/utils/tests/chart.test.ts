import { describe, test, expect } from 'vitest';

import { adaptPerNameChartData } from 'utils/chart';

describe('adaptPerNameChartData', () => {
  test('should adapt the request data for echarts', () => {
    const mockChart = {
      name: '/mock',
      time: '123',
      mockKey: 'data',
    };

    const result = adaptPerNameChartData([mockChart, mockChart], 'mockKey');

    expect(result[mockChart.name]).toEqual([
      [mockChart.time, mockChart.mockKey],
      [mockChart.time, mockChart.mockKey],
    ]);
  });

  test('should use a default fallback value if data is missing', () => {
    const mockChart = {
      name: '/mock',
      time: '123',
    };

    const result = adaptPerNameChartData<any>([mockChart], 'mockKey');

    expect(result[mockChart.name]).toEqual([[mockChart.time, '0']]);
  });

  test('should use a provided fallback value if data is missing', () => {
    const mockChart = {
      name: '/mock',
      time: '123',
    };

    const result = adaptPerNameChartData<any>([mockChart], 'mockKey', { fallbackValue: '456' });

    expect(result[mockChart.name]).toEqual([[mockChart.time, '456']]);
  });
});
