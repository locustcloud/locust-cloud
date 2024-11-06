import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { roundToDecimalPlaces } from 'locust-ui';

import { ICustomer } from 'types/customer.types';
import {
  IAvgResponseTimesResponse,
  IErrorsPerRequestResponse,
  IFailuresData,
  IPerc99ResponseTimesResponse,
  IPerRequestData,
  IRequestBody,
  IRequestLines,
  IRequestLinesResponse,
  IResponseLengthResponse,
  IRpsData,
  IRpsPerRequestResponse,
  IRpsResponse,
  IScatterplotData,
  IStatsData,
  IVuhResponse,
} from 'types/request.types';
import {
  ITestrun,
  ITestrunsResponseTime,
  ITestrunsResponseTimeResponse,
  ITestrunsRps,
  ITestrunsRpsResponse,
  ITestrunsTable,
} from 'types/testruns.types';
import { adaptPerNameChartData } from 'utils/chart';
import { createAbsoluteUrl } from 'utils/url';

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
  baseQuery: fetchBaseQuery({
    baseUrl: 'cloud-stats',
  }),
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
        adaptPerNameChartData<IPerc99ResponseTimesResponse>(perc99ResponseTimes, 'perc99', {
          fallbackValue: null,
        }),
    }),
    getResponseLength: builder.mutation<IPerRequestData, IRequestBody>({
      query: body => ({
        url: 'response-length',
        method: 'POST',
        body,
      }),
      transformResponse: (responseLength: IResponseLengthResponse[]) =>
        adaptPerNameChartData<IResponseLengthResponse>(responseLength, 'responseLength', {
          fallbackValue: null,
        }),
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

    getTestrunsTable: builder.mutation<ITestrunsTable[], void>({
      query: () => ({
        url: 'testruns-table',
        method: 'POST',
      }),
      transformResponse: (testruns: ITestrunsTable[]) =>
        testruns.map(({ runId, ...testrunData }) => {
          const testrunIdForDisplay = new Date(runId).toLocaleString();
          const url = createAbsoluteUrl({ tab: 'charts', testrun: testrunIdForDisplay });

          return {
            ...testrunData,
            runId: `[${testrunIdForDisplay}](${url})`,
          };
        }),
    }),
    getTestrunsRps: builder.mutation<ITestrunsRps, void>({
      query: () => ({
        url: 'testruns-rps',
        method: 'POST',
      }),
      transformResponse: (response: ITestrunsRpsResponse[]) =>
        response.reduce(
          (rpsChart, { avgRps, avgRpsFailed, time }) => ({
            ...rpsChart,
            avgRps: [...(rpsChart.avgRps || []), [time, avgRps]],
            avgRpsFailed: [...(rpsChart.avgRpsFailed || []), [time, avgRpsFailed]],
            time: [...(rpsChart.time || []), time],
          }),
          {} as ITestrunsRps,
        ),
    }),
    getTestrunsResponseTime: builder.mutation<ITestrunsResponseTime, void>({
      query: () => ({
        url: 'testruns-response-time',
        method: 'POST',
      }),
      transformResponse: (response: ITestrunsResponseTimeResponse[]) =>
        response.reduce(
          (responseTimeChart, { avgResponseTime, avgResponseTimeFailed, time }) => ({
            ...responseTimeChart,
            avgResponseTime: [
              ...(responseTimeChart.avgResponseTime || []),
              [time, avgResponseTime],
            ],
            avgResponseTimeFailed: [
              ...(responseTimeChart.avgResponseTimeFailed || []),
              [time, avgResponseTimeFailed],
            ],
            time: [...(responseTimeChart.time || []), time],
          }),
          {} as ITestrunsResponseTime,
        ),
    }),

    getRequests: builder.mutation<IStatsData[], IRequestBody>({
      query: body => ({
        url: 'requests',
        method: 'POST',
        body,
      }),
    }),
    getFailures: builder.mutation<IFailuresData[], IRequestBody>({
      query: body => ({
        url: 'failures',
        method: 'POST',
        body,
      }),
    }),
    getTotalRequests: builder.mutation<number, IRequestBody>({
      query: body => ({
        url: 'total-requests',
        method: 'POST',
        body,
      }),
      transformResponse: ([{ totalRequests }]) => totalRequests || 0,
    }),
    getTotalFailures: builder.mutation<number, IRequestBody>({
      query: body => ({
        url: 'total-failures',
        method: 'POST',
        body,
      }),
      transformResponse: ([{ totalFailures }]) => totalFailures || 0,
    }),
    getErrorPercentage: builder.mutation<number, IRequestBody>({
      query: body => ({
        url: 'error-percentage',
        method: 'POST',
        body,
      }),
      transformResponse: ([{ errorPercentage }]) => {
        const roundedPercentage = roundToDecimalPlaces(errorPercentage, 2);
        return isNaN(roundedPercentage) ? 0 : roundedPercentage;
      },
    }),

    getTotalVuh: builder.mutation<IVuhResponse[], void>({
      query: () => ({
        url: 'total-vuh',
        method: 'POST',
      }),
    }),
    getCustomerData: builder.mutation<ICustomer, void>({
      query: () => ({
        url: 'customer',
        method: 'POST',
      }),
      transformResponse: ([customerData]) => customerData,
    }),

    getTestruns: builder.mutation<ITestrun[], void>({
      query: () => ({
        url: 'testruns',
        method: 'POST',
      }),
    }),

    getScatterplot: builder.mutation<IPerRequestData, IRequestBody>({
      query: body => ({
        url: 'scatterplot',
        method: 'POST',
        body,
      }),
      transformResponse: (scatterplot: IScatterplotData[]) =>
        adaptPerNameChartData<IScatterplotData>(scatterplot, 'responseTime'),
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
  useGetTestrunsTableMutation,
  useGetTestrunsRpsMutation,
  useGetTestrunsResponseTimeMutation,
  useGetRequestsMutation,
  useGetFailuresMutation,
  useGetTotalRequestsMutation,
  useGetTotalFailuresMutation,
  useGetErrorPercentageMutation,
  useGetTotalVuhMutation,
  useGetCustomerDataMutation,
  useGetTestrunsMutation,
  useGetScatterplotMutation,
} = cloudStats;
