import { roundToDecimalPlaces } from 'locust-ui';

export interface IRequestBody {
  start?: string;
  end?: string;
  resolution?: number;
  testrun?: string;
}

export function fetchQuery<ResponseType>(
  url: string,
  body: IRequestBody,
  onSuccess: (response: ResponseType) => void,
) {
  fetch(`http://localhost:5000${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
    .then(res => res.json())
    .then(data => data && data.length && onSuccess(data))
    // eslint-disable-next-line no-console
    .catch(console.error);
}

export interface IPerRequestResponse {
  name: string;
  time: string;
}

export type IPerRequestData = {
  [key: string]: string[][];
} & { time: string[] };

export const adaptPerNameChartData = <ChartType extends IPerRequestResponse>(
  chartData: ChartType[],
  key: keyof ChartType,
) =>
  chartData.reduce((chart, data) => {
    const { name, time } = data;
    const value = data[key] as string;
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
