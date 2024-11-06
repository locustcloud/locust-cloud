import { roundToDecimalPlaces } from 'locust-ui';

import { IPerRequestData, IPerRequestResponse } from 'types/request.types';

export const adaptPerNameChartData = <ChartType extends IPerRequestResponse>(
  chartData: ChartType[],
  key: keyof ChartType,
  { fallbackValue }: { fallbackValue: string | null } = { fallbackValue: '0' },
) =>
  chartData.reduce((chart, data) => {
    const { name, time } = data;
    const value = (data[key] as string) || fallbackValue;
    const timeAxis = chart.time || [];
    timeAxis.push(time);

    if (!chart[name]) {
      return {
        ...chart,
        [name]: [[time, value]],
        time: timeAxis,
      } as IPerRequestData;
    }

    chart[name].push([time, value]);

    return {
      ...chart,
      time: timeAxis,
    } as IPerRequestData;
  }, {} as IPerRequestData);

export function chartValueFormatter(value: string | number | string[] | number[]) {
  return roundToDecimalPlaces(Number((value as string[])[1]), 2);
}
