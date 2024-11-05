import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { LineChart, roundToDecimalPlaces, SWARM_STATE } from 'locust-ui';

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
  const { resolution, currentTestrunIndex, currentTestrun, testruns, shouldShowAdvanced } =
    useSelector(({ toolbar }) => toolbar);
  const setSnackbar = useAction(snackbarActions.setSnackbar);

  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [charts, setCharts] = useState<ICharts>(defaultChartData);
  const [shouldReplaceMergeLines, setShouldReplaceMergeLines] = useState(false);

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
        { key: 'requestLines', mutation: getRequestNames },
        { key: 'rpsData', mutation: getRps },
        { key: 'avgResponseTimes', mutation: getAvgResponseTimes },
        { key: 'rpsPerRequest', mutation: getRpsPerRequest, isAdvanced: true },
        { key: 'errorsPerRequest', mutation: getErrorsPerRequest, isAdvanced: true },
        { key: 'perc99ResponseTimes', mutation: getPerc99ResponseTimes, isAdvanced: true },
        { key: 'responseLength', mutation: getResponseLength, isAdvanced: true },
      ].filter(({ isAdvanced }) => !isAdvanced || shouldShowAdvanced);

      const mutationResults = await Promise.all(mutations.map(({ mutation }) => mutation(payload)));

      const fetchError = mutationResults.find(({ error }) => error);

      if (fetchError && fetchError.error && 'error' in fetchError.error) {
        setSnackbar({ message: fetchError.error.error });
      } else {
        const chartData = mutations.reduce(
          (charts, { key }, index) => ({ ...charts, [key]: mutationResults[index].data }),
          {} as ICharts,
        );

        const currentRequestLinesLength = chartData.requestLines.length;

        // only show an error for the first testrun if no test is running
        if (
          !currentRequestLinesLength &&
          (currentTestrunIndex !== 0 || swarmState !== SWARM_STATE.RUNNING)
        ) {
          setIsError(true);
        }

        const shouldUpdateRequestLines =
          currentRequestLinesLength !== charts.requestLines.length ||
          chartData.requestLines.some(({ key }, index) => key !== charts.requestLines[index].key);

        chartData.requestLines = shouldUpdateRequestLines
          ? chartData.requestLines
          : charts.requestLines;

        setShouldReplaceMergeLines(shouldUpdateRequestLines);
        setCharts({ ...charts, ...chartData });
        setIsLoading(false);
      }

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
    // handle initial load and fetching on testrun, resolution change, or showing of advanced charts
    fetchCharts();
  }, [currentTestrun, resolution, shouldShowAdvanced]);

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
      <Toolbar onSelectTestRun={onSelectTestRun} shouldShowResolution showHideAdvanced />
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
            shouldReplaceMergeLines={shouldReplaceMergeLines}
            title='Average Response Times'
          />

          {shouldShowAdvanced && (
            <>
              <LineChart<IPerRequestData>
                chartValueFormatter={chartValueFormatter}
                charts={charts.rpsPerRequest}
                colors={CHART_COLORS.PER_REQUEST}
                lines={charts.requestLines}
                shouldReplaceMergeLines={shouldReplaceMergeLines}
                title='RPS per Request'
              />
              <LineChart<IPerRequestData>
                chartValueFormatter={chartValueFormatter}
                charts={charts.errorsPerRequest}
                colors={CHART_COLORS.ERROR}
                lines={charts.requestLines}
                shouldReplaceMergeLines={shouldReplaceMergeLines}
                title='Errors per Request'
              />
              <LineChart<IPerRequestData>
                chartValueFormatter={chartValueFormatter}
                charts={charts.perc99ResponseTimes}
                colors={CHART_COLORS.PER_REQUEST}
                lines={charts.requestLines}
                shouldReplaceMergeLines={shouldReplaceMergeLines}
                title='99th Percentile Response Times'
              />
              <LineChart<IPerRequestData>
                chartValueFormatter={chartValueFormatter}
                charts={charts.responseLength}
                colors={CHART_COLORS.PER_REQUEST}
                lines={charts.requestLines}
                shouldReplaceMergeLines={shouldReplaceMergeLines}
                title='Response Length'
              />
            </>
          )}
        </Box>
      </Box>
    </>
  );
}
