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

    if (!chart[name]) {
      return {
        ...chart,
        [name]: [[new Date(time).toISOString(), value]],
      } as IPerRequestData;
    }

    chart[name].push([new Date(time).toISOString(), value]);

    return {
      ...chart,
    } as IPerRequestData;
  }, {} as IPerRequestData);

export function chartValueFormatter(value: string | number | string[] | number[]) {
  return roundToDecimalPlaces(Number((value as string[])[1]), 2);
}
