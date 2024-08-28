import { useEffect, useState } from 'react';
import { LineChart, useInterval, roundToDecimalPlaces, SWARM_STATE } from 'locust-ui';

import Toolbar from 'components/Toolbar/Toolbar';
import { useLocustSelector, useSelector } from 'redux/hooks';
import {
  IRequestBody,
  adaptPerNameChartData,
  fetchQuery,
  IPerRequestResponse,
  IPerRequestData,
  chartValueFormatter,
} from 'utils/api';

interface IRequestLines {
  name: string;
  key: string;
}

interface IRpsResponse {
  users: string;
  rps: string;
  errorRate: string;
  time: string;
}

interface IRpsData {
  users: [string, string][];
  rps: [string, string][];
  errorRate: [string, string][];
  time: string[];
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

export default function Charts() {
  const { state: swarmState } = useLocustSelector(({ swarm }) => swarm);
  const { resolution, currentTestrun, testruns } = useSelector(({ toolbar }) => toolbar);

  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [requestLines, setRequestLines] = useState<IRequestLines[]>([]);
  const [rpsData, setRpsData] = useState<IRpsData>({ time: [] as string[] } as IRpsData);
  const [rpsPerRequest, setRpsPerRequest] = useState<IPerRequestData>({
    time: [],
  } as IPerRequestData);
  const [avgResponseTimes, setAvgResponseTimes] = useState<IPerRequestData>({
    time: [],
  } as IPerRequestData);
  const [errorsPerRequest, setErrorsPerRequest] = useState<IPerRequestData>({
    time: [],
  } as IPerRequestData);
  const [perc99ResponseTimes, setPerc99ResponseTimes] = useState<IPerRequestData>({
    time: [],
  } as IPerRequestData);
  const [responseLength, setResponseLength] = useState<IPerRequestData>({
    time: [],
  } as IPerRequestData);

  const getRequestNames = (body: IRequestBody) =>
    fetchQuery<{ name: string }[]>('/cloud-stats/request-names', body, requestNames =>
      setRequestLines(
        requestNames.map(({ name: requestName }) => ({
          name: `${requestName}`,
          key: requestName,
        })),
      ),
    );
  const getRps = (body: IRequestBody) =>
    fetchQuery<IRpsResponse[]>('/cloud-stats/rps', body, rps =>
      setRpsData(
        rps.reduce(
          (rpsChart, { users, rps, errorRate, time }) => ({
            users: [...(rpsChart.users || []), [time, users]],
            rps: [...(rpsChart.rps || []), [time, rps]],
            errorRate: [...(rpsChart.errorRate || []), [time, errorRate]],
            time: [...(rpsChart.time || []), time],
          }),
          {} as IRpsData,
        ),
      ),
    );

  const getRpsPerRequest = (body: IRequestBody) =>
    fetchQuery<IRpsPerRequestResponse[]>('/cloud-stats/rps-per-request', body, rpsPerRequest =>
      setRpsPerRequest(adaptPerNameChartData<IRpsPerRequestResponse>(rpsPerRequest, 'throughput')),
    );
  const getAvgResponseTimes = (body: IRequestBody) =>
    fetchQuery<IAvgResponseTimesResponse[]>(
      '/cloud-stats/avg-response-times',
      body,
      avgResponseTimes =>
        setAvgResponseTimes(
          adaptPerNameChartData<IAvgResponseTimesResponse>(avgResponseTimes, 'responseTime'),
        ),
    );
  const getErrorsPerRequest = (body: IRequestBody) =>
    fetchQuery<IErrorsPerRequestResponse[]>(
      '/cloud-stats/errors-per-request',
      body,
      errorsPerRequest =>
        setErrorsPerRequest(
          adaptPerNameChartData<IErrorsPerRequestResponse>(errorsPerRequest, 'errorRate'),
        ),
    );
  const getPerc99ResponseTimes = (body: IRequestBody) =>
    fetchQuery<IPerc99ResponseTimesResponse[]>(
      '/cloud-stats/perc99-response-times',
      body,
      perc99ResponseTimes =>
        setPerc99ResponseTimes(
          adaptPerNameChartData<IPerc99ResponseTimesResponse>(perc99ResponseTimes, 'perc99'),
        ),
    );
  const getResponseLength = (body: IRequestBody) =>
    fetchQuery<IResponseLengthResponse[]>('/cloud-stats/response-length', body, responseLength =>
      setResponseLength(
        adaptPerNameChartData<IResponseLengthResponse>(responseLength, 'responseLength'),
      ),
    );

  const fetchCharts = (endTime?: string) => {
    if (currentTestrun) {
      const currentTimestamp = new Date().toISOString();
      const payload = {
        start: currentTestrun,
        end: endTime || timestamp,
        resolution,
        testrun: currentTestrun,
      };

      getRequestNames(payload);
      getRpsPerRequest(payload);
      getAvgResponseTimes(payload);
      getErrorsPerRequest(payload);
      getPerc99ResponseTimes(payload);
      getResponseLength(payload);
      getRps(payload);

      setTimestamp(currentTimestamp);
    }
  };

  useInterval(fetchCharts, 1000, {
    shouldRunInterval: swarmState === SWARM_STATE.SPAWNING || swarmState == SWARM_STATE.RUNNING,
  });

  useEffect(() => {
    if (currentTestrun) {
      const { endTime } = testruns[new Date(currentTestrun).toLocaleString()];
      // handle re-fetch on testrun or resolution change
      fetchCharts(endTime);
    } else {
      // handle initial load or resolution change
      fetchCharts();
    }
  }, [currentTestrun, resolution]);

  return (
    <>
      <Toolbar />
      <LineChart<IRpsData>
        chartValueFormatter={chartValueFormatter}
        charts={rpsData}
        colors={['#00ca5a', '#0099ff', '#ff6d6d']}
        lines={[
          {
            name: 'Users',
            key: 'users',
            yAxisIndex: 0,
          },
          {
            name: 'Requests per Second',
            key: 'rps',
            yAxisIndex: 1,
            areaStyle: {},
          },
          {
            name: 'Errors per Second',
            key: 'errorRate',
            yAxisIndex: 1,
            areaStyle: {},
          },
        ]}
        splitAxis
        title='Throughput / active users'
        yAxisLabels={['Users', 'RPS']}
      />
      <LineChart<IPerRequestData>
        chartValueFormatter={v => `${roundToDecimalPlaces(Number((v as string[])[1]), 2)}ms`}
        charts={avgResponseTimes}
        colors={['#9966CC', '#8A2BE2', '#8E4585', '#E0B0FF', '#C8A2C8', '#E6E6FA']}
        lines={requestLines}
        title='Average Response Times'
      />
      <LineChart<IPerRequestData>
        chartValueFormatter={chartValueFormatter}
        charts={rpsPerRequest}
        colors={['#9966CC', '#8A2BE2', '#8E4585', '#E0B0FF', '#C8A2C8', '#E6E6FA']}
        lines={requestLines}
        title='RPS per Request'
      />
      <LineChart<IPerRequestData>
        chartValueFormatter={chartValueFormatter}
        charts={errorsPerRequest}
        colors={['#ff8080', '#ff4d4d', '#ff1a1a', '#e60000', '#b30000', '#800000']}
        lines={requestLines}
        title='Errors per Request'
      />
      <LineChart<IPerRequestData>
        chartValueFormatter={chartValueFormatter}
        charts={perc99ResponseTimes}
        colors={['#9966CC', '#8A2BE2', '#8E4585', '#E0B0FF', '#C8A2C8', '#E6E6FA']}
        lines={requestLines}
        title='99th Percentile Response Times'
      />
      <LineChart<IPerRequestData>
        chartValueFormatter={chartValueFormatter}
        charts={responseLength}
        colors={['#9966CC', '#8A2BE2', '#8E4585', '#E0B0FF', '#C8A2C8', '#E6E6FA']}
        lines={requestLines}
        title='Response Length'
      />
    </>
  );
}
