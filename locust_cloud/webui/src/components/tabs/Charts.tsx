import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { roundToDecimalPlaces, SWARM_STATE, LineChart } from 'locust-ui';

import Toolbar from 'components/Toolbar/Toolbar';
import useAwaitInterval from 'hooks/useAwaitInterval';
import {
  IRequestLines,
  IRpsData,
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

const defaultPerRequestState = { time: [] } as IPerRequestData;
const defaultRpsDataState = { time: [] as string[] } as IRpsData;
const defaultRequestLines = [] as IRequestLines[];

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

      const mutations = [
        getRequestNames,
        getRps,
        getAvgResponseTimes,
        getRpsPerRequest,
        getErrorsPerRequest,
        getPerc99ResponseTimes,
        getResponseLength,
      ];

      const mutationResults = await Promise.all(mutations.map(mutation => mutation(payload)));

      const fetchError = mutationResults.filter(({ error }) => error);

      if (fetchError && 'error' in fetchError) {
        setSnackbar({ message: String(fetchError.error) });
      }

      const [
        { data: requestLines = defaultRequestLines },
        { data: rpsData = defaultRpsDataState },
        { data: avgResponseTimes = defaultPerRequestState },
        { data: rpsPerRequest = defaultPerRequestState },
        { data: errorsPerRequest = defaultPerRequestState },
        { data: perc99ResponseTimes = defaultPerRequestState },
        { data: responseLength = defaultPerRequestState },
      ] = mutationResults;

      // only show an error for the first testrun if no test is running
      if (
        (currentTestrunIndex !== 0 && !(requestLines as IRequestLines[]).length) ||
        (currentTestrunIndex === 0 &&
          swarmState !== SWARM_STATE.RUNNING &&
          !(requestLines as IRequestLines[]).length)
      ) {
        setIsError(true);
      }

      setCharts({
        requestLines: requestLines as IRequestLines[],
        rpsData: rpsData as IRpsData,
        avgResponseTimes: avgResponseTimes as IPerRequestData,
        rpsPerRequest: rpsPerRequest as IPerRequestData,
        errorsPerRequest: errorsPerRequest as IPerRequestData,
        perc99ResponseTimes: perc99ResponseTimes as IPerRequestData,
        responseLength: responseLength as IPerRequestData,
      });

      setIsLoading(false);

      if (swarmState !== SWARM_STATE.STOPPED) {
        setTimestamp(currentTimestamp);
      }
    }
  };

  useAwaitInterval(fetchCharts, 1000, {
    shouldRunInterval: swarmState === SWARM_STATE.SPAWNING || swarmState == SWARM_STATE.RUNNING,
    immediate: true,
  });

  useEffect(() => {
    // handle initial load and fetching on testrun or resolution change
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
