import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useInterval, roundToDecimalPlaces, SWARM_STATE, LineChart } from 'locust-ui';

import Toolbar from 'components/Toolbar/Toolbar';
import {
  useGetAvgResponseTimesMutation,
  useGetErrorsPerRequestMutation,
  useGetPerc99ResponseTimesMutation,
  useGetRequestNamesMutation,
  useGetResponseLengthMutation,
  useGetRpsMutation,
  useGetRpsPerRequestMutation,
} from 'redux/api/cloud-stats';
import { useAction, useLocustSelector, useSelector } from 'redux/hooks';
import { snackbarActions } from 'redux/slice/snackbar.slice';
import { IPerRequestData, chartValueFormatter } from 'utils/api';

interface IRequestLines {
  name: string;
  key: string;
}

interface IRpsData {
  users: [string, string][];
  rps: [string, string][];
  errorRate: [string, string][];
  time: string[];
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

interface ICharts {
  requestLines: IRequestLines[];
  rpsPerRequest: IPerRequestData;
  avgResponseTimes: IPerRequestData;
  errorsPerRequest: IPerRequestData;
  perc99ResponseTimes: IPerRequestData;
  responseLength: IPerRequestData;
  rpsData: IRpsData;
}

const defaultChartData = {
  requestLines: [],
  rpsPerRequest: defaultPerRequestState,
  avgResponseTimes: defaultPerRequestState,
  errorsPerRequest: defaultPerRequestState,
  perc99ResponseTimes: defaultPerRequestState,
  responseLength: defaultPerRequestState,
  rpsData: defaultRpsDataState,
};

export default function Charts() {
  const { state: swarmState } = useLocustSelector(({ swarm }) => swarm);
  const { resolution, currentTestrunIndex, currentTestrun, testruns } = useSelector(
    ({ toolbar }) => toolbar,
  );
  const setSnackbar = useAction(snackbarActions.setSnackbar);

  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [timestamp, setTimestamp] = useState(new Date().toISOString());

  const [charts, setCharts] = useState<ICharts>(defaultChartData);

  const [getRequestNames] = useGetRequestNamesMutation();
  const [getRpsPerRequest] = useGetRpsPerRequestMutation();
  const [getAvgResponseTimes] = useGetAvgResponseTimesMutation();
  const [getErrorsPerRequest] = useGetErrorsPerRequestMutation();
  const [getPerc99ResponseTimes] = useGetPerc99ResponseTimesMutation();
  const [getResponseLength] = useGetResponseLengthMutation();
  const [getRps] = useGetRpsMutation();

  const fetchCharts = async () => {
    if (currentTestrun) {
      const currentTimestamp = new Date().toISOString();
      const { endTime } = testruns[new Date(currentTestrun).toLocaleString()];
      const payload = {
        start: currentTestrun,
        end: endTime || timestamp,
        resolution,
        testrun: currentTestrun,
      };

      const [
        { data: requestLines, error: requestLinesError },
        { data: rpsPerRequest = defaultPerRequestState, error: rpsPerRequestError },
        { data: avgResponseTimes = defaultPerRequestState, error: avgResponseTimesError },
        { data: errorsPerRequest = defaultPerRequestState, error: errorsPerRequestError },
        { data: perc99ResponseTimes = defaultPerRequestState, error: perc99ResponseTimesError },
        { data: responseLength = defaultPerRequestState, error: responseLengthError },
        { data: rpsData, error: rpsError },
      ] = await Promise.all([
        getRequestNames(payload),
        getRpsPerRequest(payload),
        getAvgResponseTimes(payload),
        getErrorsPerRequest(payload),
        getPerc99ResponseTimes(payload),
        getResponseLength(payload),
        getRps(payload),
      ]);

      const errorMessage =
        requestLinesError ||
        rpsPerRequestError ||
        avgResponseTimesError ||
        errorsPerRequestError ||
        perc99ResponseTimesError ||
        responseLengthError ||
        rpsError;

      if (errorMessage) {
        setSnackbar({ message: String(errorMessage) });
      }

      // only show an error for the first testrun if no test is running
      if (
        (currentTestrunIndex !== 0 && !requestLines.length) ||
        (currentTestrunIndex === 0 && swarmState !== SWARM_STATE.RUNNING && !requestLines.length)
      ) {
        setIsError(true);
      }

      setCharts({
        requestLines,
        rpsPerRequest,
        avgResponseTimes,
        errorsPerRequest,
        perc99ResponseTimes,
        responseLength,
        rpsData,
      });

      setIsLoading(false);

      if (swarmState !== SWARM_STATE.STOPPED) {
        setTimestamp(currentTimestamp);
      }
    }

    // if (swarmState === SWARM_STATE.SPAWNING || swarmState === SWARM_STATE.RUNNING) {
    //   setTimeout(fetchCharts, 1000);
    // }
  };

  useInterval(fetchCharts, 1000, {
    shouldRunInterval: swarmState === SWARM_STATE.SPAWNING || swarmState == SWARM_STATE.RUNNING,
    immediate: true,
  });

  useEffect(() => {
    // handle initial load, testrun change, or resolution change
    fetchCharts();
  }, [currentTestrun, resolution]);

  useEffect(() => {
    if (swarmState === SWARM_STATE.RUNNING) {
      setIsLoading(true);
    }
  }, [swarmState]);

  const onSelectTestRun = useCallback(() => {
    setIsLoading(true);
    setIsError(false);
  }, []);

  return (
    <>
      <Toolbar onSelectTestRun={onSelectTestRun} />
      {isError && (
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
          charts={charts.rpsData}
          colors={CHART_COLORS.RPS}
          lines={RPS_CHART_LINES}
          splitAxis
          title='Throughput / active users'
          yAxisLabels={RPS_Y_AXIS_LABELS}
        />
        <Box
          sx={{
            display:
              !isError || (isError && !!charts.requestLines && charts.requestLines.length)
                ? 'block'
                : 'none',
          }}
        >
          <LineChart<IPerRequestData>
            chartValueFormatter={v => `${roundToDecimalPlaces(Number((v as string[])[1]), 2)}ms`}
            charts={charts.avgResponseTimes}
            colors={CHART_COLORS.PER_REQUEST}
            lines={charts.requestLines}
            title='Average Response Times'
          />
          <LineChart<IPerRequestData>
            chartValueFormatter={chartValueFormatter}
            charts={charts.rpsPerRequest}
            colors={CHART_COLORS.PER_REQUEST}
            lines={charts.requestLines}
            title='RPS per Request'
          />
          <LineChart<IPerRequestData>
            chartValueFormatter={chartValueFormatter}
            charts={charts.errorsPerRequest}
            colors={CHART_COLORS.ERROR}
            lines={charts.requestLines}
            title='Errors per Request'
          />
          <LineChart<IPerRequestData>
            chartValueFormatter={chartValueFormatter}
            charts={charts.perc99ResponseTimes}
            colors={CHART_COLORS.PER_REQUEST}
            lines={charts.requestLines}
            title='99th Percentile Response Times'
          />
          <LineChart<IPerRequestData>
            chartValueFormatter={chartValueFormatter}
            charts={charts.responseLength}
            colors={CHART_COLORS.PER_REQUEST}
            lines={charts.requestLines}
            title='Response Length'
          />
        </Box>
      </Box>
    </>
  );
}
