import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { adaptPerNameChartData, IPerRequestResponse } from 'utils/api';

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

interface IRpsResponse {
  users: string | null;
  rps: string | null;
  errorRate: string | null;
  time: string;
}

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
    getRequestNames: builder.mutation({
      query: body => ({
        url: 'request-names',
        method: 'POST',
        body,
      }),
      transformResponse: requestNames =>
        requestNames.map(({ name: requestName }) => ({
          name: `${requestName}`,
          key: requestName,
        })),
    }),
    getRpsPerRequest: builder.mutation({
      query: body => ({
        url: 'rps-per-request',
        method: 'POST',
        body,
      }),
      transformResponse: rpsPerRequest =>
        adaptPerNameChartData<IRpsPerRequestResponse>(rpsPerRequest, 'throughput'),
    }),
    getAvgResponseTimes: builder.mutation({
      query: body => ({
        url: 'avg-response-times',
        method: 'POST',
        body,
      }),
      transformResponse: avgResponseTimes =>
        adaptPerNameChartData<IAvgResponseTimesResponse>(avgResponseTimes, 'responseTime'),
    }),
    getErrorsPerRequest: builder.mutation({
      query: body => ({
        url: 'errors-per-request',
        method: 'POST',
        body,
      }),
      transformResponse: errorsPerRequest =>
        adaptPerNameChartData<IErrorsPerRequestResponse>(errorsPerRequest, 'errorRate'),
    }),
    getPerc99ResponseTimes: builder.mutation({
      query: body => ({
        url: 'perc99-response-times',
        method: 'POST',
        body,
      }),
      transformResponse: perc99ResponseTimes =>
        adaptPerNameChartData<IPerc99ResponseTimesResponse>(perc99ResponseTimes, 'perc99'),
    }),
    getResponseLength: builder.mutation({
      query: body => ({
        url: 'perc99-response-times',
        method: 'POST',
        body,
      }),
      transformResponse: responseLength =>
        adaptPerNameChartData<IResponseLengthResponse>(responseLength, 'responseLength'),
    }),
    getRps: builder.mutation({
      query: body => ({
        url: 'rps',
        method: 'POST',
        body,
      }),
      transformResponse: rps =>
        rps.reduce(
          (rpsChart, { users, rps, errorRate, time }) => ({
            users: [...(rpsChart.users || []), [time, users || carryLastValue(rpsChart.users)]],
            rps: [...(rpsChart.rps || []), [time, rps || '0']],
            errorRate: [...(rpsChart.errorRate || []), [time, errorRate || '0']],
            time: [...(rpsChart.time || []), time],
          }),
          {},
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
