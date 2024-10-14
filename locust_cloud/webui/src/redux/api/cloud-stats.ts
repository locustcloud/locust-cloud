import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { adaptPerNameChartData, IPerRequestData, IPerRequestResponse } from 'utils/api';

interface IRequestLinesResponse {
  name: string;
}

export interface IRequestLines {
  name: string;
  key: string;
}

interface IRpsPerRequestResponse extends IPerRequestResponse {
  throughput: number;
}

interface IAvgResponseTimesResponse extends IPerRequestResponse {
  responseTime: number;
}

interface IErrorsPerRequestResponse extends IPerRequestResponse {
  errorRate: number;
}

interface IPerc99ResponseTimesResponse extends IPerRequestResponse {
  perc99: number;
}

interface IResponseLengthResponse extends IPerRequestResponse {
  responseLength: number;
}

export interface IRequestBody {
  start?: string;
  end?: string;
  resolution?: number;
  testrun?: string;
}

interface IRpsResponse {
  users: string | null;
  rps: string | null;
  errorRate: string | null;
  time: string;
}

export interface IRpsData {
  users: [string, string][];
  rps: [string, string][];
  errorRate: [string, string][];
  time: string[];
}

/*
  Because of time_bucket_gapfill it's possible to have periods without data
  Rather than displaying gaps in the chart, we carry the last know value
*/
const carryLastValue = (values?: [string, string][]) => {
  if (!values) {
    return '0';
  }

  return values[values.length - 1][1];
};

export const cloudStats = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: 'cloud-stats' }),
  reducerPath: 'cloud-stats',
  endpoints: builder => ({
    getRequestNames: builder.mutation<IRequestLines[], IRequestBody>({
      query: body => ({
        url: 'request-names',
        method: 'POST',
        body,
      }),
      transformResponse: (requestNames: IRequestLinesResponse[]) =>
        requestNames.map(({ name: requestName }) => ({
          name: `${requestName}`,
          key: requestName,
        })),
    }),
    getRpsPerRequest: builder.mutation<IPerRequestData, IRequestBody>({
      query: body => ({
        url: 'rps-per-request',
        method: 'POST',
        body,
      }),
      transformResponse: (rpsPerRequest: IRpsPerRequestResponse[]) =>
        adaptPerNameChartData<IRpsPerRequestResponse>(rpsPerRequest, 'throughput'),
    }),
    getAvgResponseTimes: builder.mutation<IPerRequestData, IRequestBody>({
      query: body => ({
        url: 'avg-response-times',
        method: 'POST',
        body,
      }),
      transformResponse: (avgResponseTimes: IAvgResponseTimesResponse[]) =>
        adaptPerNameChartData<IAvgResponseTimesResponse>(avgResponseTimes, 'responseTime'),
    }),
    getErrorsPerRequest: builder.mutation<IPerRequestData, IRequestBody>({
      query: body => ({
        url: 'errors-per-request',
        method: 'POST',
        body,
      }),
      transformResponse: (errorsPerRequest: IErrorsPerRequestResponse[]) =>
        adaptPerNameChartData<IErrorsPerRequestResponse>(errorsPerRequest, 'errorRate'),
    }),
    getPerc99ResponseTimes: builder.mutation<IPerRequestData, IRequestBody>({
      query: body => ({
        url: 'perc99-response-times',
        method: 'POST',
        body,
      }),
      transformResponse: (perc99ResponseTimes: IPerc99ResponseTimesResponse[]) =>
        adaptPerNameChartData<IPerc99ResponseTimesResponse>(perc99ResponseTimes, 'perc99'),
    }),
    getResponseLength: builder.mutation<IPerRequestData, IRequestBody>({
      query: body => ({
        url: 'perc99-response-times',
        method: 'POST',
        body,
      }),
      transformResponse: (responseLength: IResponseLengthResponse[]) =>
        adaptPerNameChartData<IResponseLengthResponse>(responseLength, 'responseLength'),
    }),
    getRps: builder.mutation<IRpsData, IRequestBody>({
      query: body => ({
        url: 'rps',
        method: 'POST',
        body,
      }),
      transformResponse: (rps: IRpsResponse[]) =>
        rps.reduce(
          (rpsChart, { users, rps, errorRate, time }) => ({
            users: [...(rpsChart.users || []), [time, users || carryLastValue(rpsChart.users)]],
            rps: [...(rpsChart.rps || []), [time, rps || '0']],
            errorRate: [...(rpsChart.errorRate || []), [time, errorRate || '0']],
            time: [...(rpsChart.time || []), time],
          }),
          {} as IRpsData,
        ),
    }),
  }),
});

export const {
  useGetRequestNamesMutation,
  useGetRpsPerRequestMutation,
  useGetAvgResponseTimesMutation,
  useGetErrorsPerRequestMutation,
  useGetPerc99ResponseTimesMutation,
  useGetResponseLengthMutation,
  useGetRpsMutation,
} = cloudStats;
