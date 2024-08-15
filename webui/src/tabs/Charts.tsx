import { useEffect, useState } from 'react';
import { Box, SelectChangeEvent } from '@mui/material';
import {
  LineChart,
  useInterval,
  roundToDecimalPlaces,
  IRootState,
  SWARM_STATE,
  Select,
} from 'locust-ui';
import { useSelector } from 'react-redux';

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
  users: number;
  rps: number;
  errorRate: number;
  time: string;
}

interface IRpsData {
  users: [string, number][];
  rps: [string, number][];
  errorRate: [string, number][];
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

const RESOLUTION_OPTIONS = ['1', '2', '5', '10', '30'];

export default function Charts() {
  const { state: swarmState } = useSelector(({ swarm }: IRootState) => swarm);

  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [testruns, setTestruns] = useState<string[]>([]);
  const [previousTestrun, setPreviousTestrun] = useState<string>();
  const [currentTestrun, setCurrentTestrun] = useState<string>();
  const [resolution, setResolution] = useState(5);
  const [requestLines, setRequestLines] = useState<IRequestLines[]>([]);
  const [rpsData, setRpsData] = useState<IRpsData>({} as IRpsData);
  const [rpsPerRequest, setRpsPerRequest] = useState<IPerRequestData>({});
  const [avgResponseTimes, setAvgResponseTimes] = useState<IPerRequestData>({});
  const [errorsPerRequest, setErrorsPerRequest] = useState<IPerRequestData>({});
  const [perc99ResponseTimes, setPerc99ResponseTimes] = useState<IPerRequestData>({});
  const [responseLength, setResponseLength] = useState<IPerRequestData>({});

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

  const fetchCharts = () => {
    if (currentTestrun) {
      const currentTimestamp = new Date().toISOString();

      getRequestNames({ start: currentTestrun, end: timestamp });
      getRpsPerRequest({ start: currentTestrun, end: timestamp, resolution });
      getAvgResponseTimes({ start: currentTestrun, end: timestamp });
      getErrorsPerRequest({ start: currentTestrun, end: timestamp, resolution });
      getPerc99ResponseTimes({ start: currentTestrun, end: timestamp, resolution });
      getResponseLength({ start: currentTestrun, end: timestamp });
      getRps({ start: currentTestrun, end: timestamp, resolution });

      setTimestamp(currentTimestamp);
    }
  };

  const fetchTestruns = () => {
    fetchQuery<{ id: string }[]>('/cloud-stats/testruns', {}, testrunIds => {
      const testruns = testrunIds.map(({ id }) => new Date(id).toLocaleString());
      setTestruns(testruns);
      setCurrentTestrun(testrunIds[0].id);
    });
  };

  useInterval(fetchCharts, 1000, {
    shouldRunInterval: swarmState === SWARM_STATE.SPAWNING || swarmState == SWARM_STATE.RUNNING,
  });

  useInterval(fetchTestruns, 500, {
    shouldRunInterval: !testruns.length || (!!previousTestrun && testruns[0] <= previousTestrun),
  });

  useEffect(() => {
    // handle initial load
    fetchCharts();
  }, []);

  useEffect(() => {
    if (swarmState === SWARM_STATE.STOPPED && testruns) {
      setCurrentTestrun(undefined);
      setPreviousTestrun(testruns[0]);
    }
  }, [swarmState, testruns]);

  return (
    <>
      <Box sx={{ my: 4, display: 'flex', columnGap: 4 }}>
        <Select
          defaultValue={'5'}
          label='Resolution'
          name='resolution'
          onChange={(e: SelectChangeEvent<string>) => setResolution(Number(e.target.value))}
          options={RESOLUTION_OPTIONS}
          sx={{ width: '150px' }}
        />
        {!!testruns.length && (
          <Select
            label='Test Run'
            name='testrun'
            onChange={(e: SelectChangeEvent<string>) => setCurrentTestrun(e.target.value)}
            options={testruns}
            sx={{ width: '250px' }}
          />
        )}
      </Box>

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
