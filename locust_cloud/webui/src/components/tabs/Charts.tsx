import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useInterval, roundToDecimalPlaces, SWARM_STATE, LineChart } from 'locust-ui';

import Toolbar from 'components/Toolbar/Toolbar';
import { useAction, useLocustSelector, useSelector } from 'redux/hooks';
import { snackbarActions } from 'redux/slice/snackbar.slice';
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
  users: string | null;
  rps: string | null;
  errorRate: string | null;
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

const defaultPerRequestState = { time: [] } as IPerRequestData;
const defaultRpsDataState = { time: [] as string[] } as IRpsData;

const CHART_COLORS = {
  RPS: ['#00ca5a', '#0099ff', '#ff6d6d'],
  PER_REQUEST: ['#9966CC', '#8A2BE2', '#8E4585', '#E0B0FF', '#C8A2C8', '#E6E6FA'],
  ERROR: ['#ff8080', '#ff4d4d', '#ff1a1a', '#e60000', '#b30000', '#800000'],
};

const RPS_Y_AXIS_LABELS: [string, string] = ['Users', 'RPS'];
const RPS_CHART_LINES = [
  {
    name: 'Users',
    key: 'users' as keyof IRpsData,
    yAxisIndex: 0,
  },
  {
    name: 'Requests per Second',
    key: 'rps' as keyof IRpsData,
    yAxisIndex: 1,
    areaStyle: {},
  },
  {
    name: 'Errors per Second',
    key: 'errorRate' as keyof IRpsData,
    yAxisIndex: 1,
    areaStyle: {},
  },
];

const carryLastValue = (values?: [string, string][]) => {
  if (!values) {
    return '0';
  }

  return values[values.length - 1][1];
};

export default function Charts() {
  const { state: swarmState } = useLocustSelector(({ swarm }) => swarm);
  const { resolution, currentTestrun, testruns } = useSelector(({ toolbar }) => toolbar);
  const setSnackbar = useAction(snackbarActions.setSnackbar);

  const [isLoading, setIsLoading] = useState(true);
  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [requestLines, setRequestLines] = useState<IRequestLines[]>([]);
  const [rpsData, setRpsData] = useState<IRpsData>(defaultRpsDataState);
  const [rpsPerRequest, setRpsPerRequest] = useState<IPerRequestData>(defaultPerRequestState);
  const [avgResponseTimes, setAvgResponseTimes] = useState<IPerRequestData>(defaultPerRequestState);
  const [errorsPerRequest, setErrorsPerRequest] = useState<IPerRequestData>(defaultPerRequestState);
  const [perc99ResponseTimes, setPerc99ResponseTimes] =
    useState<IPerRequestData>(defaultPerRequestState);
  const [responseLength, setResponseLength] = useState<IPerRequestData>(defaultPerRequestState);

  const onError = (error: string) => setSnackbar({ message: error });

  const getRequestNames = (body: IRequestBody) =>
    fetchQuery<{ name: string }[]>(
      '/cloud-stats/request-names',
      body,
      requestNames =>
        setRequestLines(
          requestNames.map(({ name: requestName }) => ({
            name: `${requestName}`,
            key: requestName,
          })),
        ),
      onError,
    );
  const getRps = (body: IRequestBody) =>
    fetchQuery<IRpsResponse[]>(
      '/cloud-stats/rps',
      body,
      rps =>
        setRpsData(
          rps.reduce(
            (rpsChart, { users, rps, errorRate, time }) => ({
              users: [...(rpsChart.users || []), [time, users || carryLastValue(rpsChart.users)]],
              rps: [...(rpsChart.rps || []), [time, rps || '0']],
              errorRate: [...(rpsChart.errorRate || []), [time, errorRate || '0']],
              time: [...(rpsChart.time || []), time],
            }),
            {} as IRpsData,
          ),
        ),
      onError,
    );

  const getRpsPerRequest = (body: IRequestBody) =>
    fetchQuery<IRpsPerRequestResponse[]>(
      '/cloud-stats/rps-per-request',
      body,
      rpsPerRequest =>
        setRpsPerRequest(
          adaptPerNameChartData<IRpsPerRequestResponse>(rpsPerRequest, 'throughput'),
        ),
      onError,
    );
  const getAvgResponseTimes = (body: IRequestBody) =>
    fetchQuery<IAvgResponseTimesResponse[]>(
      '/cloud-stats/avg-response-times',
      body,
      avgResponseTimes => {
        setAvgResponseTimes(
          adaptPerNameChartData<IAvgResponseTimesResponse>(avgResponseTimes, 'responseTime'),
        );
        if (isLoading) {
          setIsLoading(false);
        }
      },
      onError,
    );
  const getErrorsPerRequest = (body: IRequestBody) =>
    fetchQuery<IErrorsPerRequestResponse[]>(
      '/cloud-stats/errors-per-request',
      body,
      errorsPerRequest =>
        setErrorsPerRequest(
          adaptPerNameChartData<IErrorsPerRequestResponse>(errorsPerRequest, 'errorRate'),
        ),
      onError,
    );
  const getPerc99ResponseTimes = (body: IRequestBody) =>
    fetchQuery<IPerc99ResponseTimesResponse[]>(
      '/cloud-stats/perc99-response-times',
      body,
      perc99ResponseTimes =>
        setPerc99ResponseTimes(
          adaptPerNameChartData<IPerc99ResponseTimesResponse>(perc99ResponseTimes, 'perc99'),
        ),
      onError,
    );
  const getResponseLength = (body: IRequestBody) =>
    fetchQuery<IResponseLengthResponse[]>(
      '/cloud-stats/response-length',
      body,
      responseLength =>
        setResponseLength(
          adaptPerNameChartData<IResponseLengthResponse>(responseLength, 'responseLength'),
        ),
      onError,
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
    immediate: true,
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

  useEffect(() => {
    if (swarmState === SWARM_STATE.RUNNING) {
      setIsLoading(true);
    }
  }, [swarmState]);

  return (
    <>
      <Toolbar onSelectTestRun={() => setIsLoading(true)} />
      {!isLoading && !requestLines.length && (
        <Alert severity='error'>There was a problem loading some graphs for this testrun.</Alert>
      )}
      <Box sx={{ position: 'relative' }}>
        {isLoading && (
          <Box
            sx={{
              position: 'absolute',
              height: '100%',
              width: '100%',
              backgroundColor: 'rgba(0,0,0,0.4)',
              zIndex: 1,
              display: 'flex',
              justifyContent: 'center',
              paddingTop: 4,
            }}
          >
            <CircularProgress />
          </Box>
        )}
        <LineChart<IRpsData>
          chartValueFormatter={chartValueFormatter}
          charts={rpsData}
          colors={CHART_COLORS.RPS}
          lines={RPS_CHART_LINES}
          splitAxis
          title='Throughput / active users'
          yAxisLabels={RPS_Y_AXIS_LABELS}
        />
        {!!requestLines.length && (
          <>
            <LineChart<IPerRequestData>
              chartValueFormatter={v => `${roundToDecimalPlaces(Number((v as string[])[1]), 2)}ms`}
              charts={avgResponseTimes}
              colors={CHART_COLORS.PER_REQUEST}
              lines={requestLines}
              title='Average Response Times'
            />
            <LineChart<IPerRequestData>
              chartValueFormatter={chartValueFormatter}
              charts={rpsPerRequest}
              colors={CHART_COLORS.PER_REQUEST}
              lines={requestLines}
              title='RPS per Request'
            />
            <LineChart<IPerRequestData>
              chartValueFormatter={chartValueFormatter}
              charts={errorsPerRequest}
              colors={CHART_COLORS.ERROR}
              lines={requestLines}
              title='Errors per Request'
            />
            <LineChart<IPerRequestData>
              chartValueFormatter={chartValueFormatter}
              charts={perc99ResponseTimes}
              colors={CHART_COLORS.PER_REQUEST}
              lines={requestLines}
              title='99th Percentile Response Times'
            />
            <LineChart<IPerRequestData>
              chartValueFormatter={chartValueFormatter}
              charts={responseLength}
              colors={CHART_COLORS.PER_REQUEST}
              lines={requestLines}
              title='Response Length'
            />
          </>
        )}
      </Box>
    </>
  );
}
