import { useEffect, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Table, SWARM_STATE } from 'locust-ui';

import Gauge from 'components/Gauge/Gauge';
import Toolbar from 'components/Toolbar/Toolbar';
import useAwaitInterval from 'hooks/useAwaitInterval';
import {
  useGetErrorPercentageMutation,
  useGetFailuresMutation,
  useGetRequestsMutation,
  useGetTotalFailuresMutation,
  useGetTotalRequestsMutation,
} from 'redux/api/cloud-stats';
import { useAction, useLocustSelector, useSelector } from 'redux/hooks';
import { snackbarActions } from 'redux/slice/snackbar.slice';
import { IFailuresData, IStatsData } from 'types/request.types';

export default function Stats() {
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const { currentTestrun, currentTestrunIndex, testruns } = useSelector(({ toolbar }) => toolbar);
  const setSnackbar = useAction(snackbarActions.setSnackbar);

  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [totalRequests, setTotalRequests] = useState<number>(0);
  const [totalFailures, setTotalFailures] = useState<number>(0);
  const [errorPercentage, setErrorPercentage] = useState<number>(0);
  const [statsData, setStatsData] = useState<IStatsData[]>([]);
  const [failuresData, setFailuresData] = useState<IFailuresData[]>([]);

  const [getRequests] = useGetRequestsMutation();
  const [getFailures] = useGetFailuresMutation();
  const [getTotalRequests] = useGetTotalRequestsMutation();
  const [getTotalFailures] = useGetTotalFailuresMutation();
  const [getErrorPercentage] = useGetErrorPercentageMutation();

  const fetchStats = async () => {
    if (currentTestrun) {
      const currentTimestamp = new Date().toISOString();
      const { endTime } = testruns[new Date(currentTestrun).toLocaleString()];

      const payload = {
        start: currentTestrun,
        end:
          !endTime || (swarmState === SWARM_STATE.RUNNING && currentTestrunIndex === 0)
            ? timestamp
            : endTime,
        testrun: currentTestrun,
      };

      const [
        { data: statsData, error: statsDataError },
        { data: failuresData, error: failuresDataError },
        { data: totalRequests, error: totalRequestsError },
        { data: totalFailures, error: totalFailuresError },
        { data: errorPercentage, error: errorPercentageError },
      ] = await Promise.all([
        getRequests(payload),
        getFailures(payload),
        getTotalRequests(payload),
        getTotalFailures(payload),
        getErrorPercentage(payload),
      ]);

      const fetchError =
        statsDataError ||
        failuresDataError ||
        totalRequestsError ||
        totalFailuresError ||
        errorPercentageError;

      if (fetchError && 'error' in fetchError) {
        setSnackbar({ message: fetchError.error });
      }

      if (statsData && failuresData) {
        setStatsData(statsData);
        setFailuresData(failuresData);
        setTotalRequests(totalRequests as number);
        setTotalFailures(totalFailures as number);
        setErrorPercentage(errorPercentage as number);
      }

      if (swarmState !== SWARM_STATE.STOPPED) {
        setTimestamp(currentTimestamp);
      }
    }
  };

  useAwaitInterval(fetchStats, 1000, {
    shouldRunInterval: swarmState === SWARM_STATE.SPAWNING || swarmState == SWARM_STATE.RUNNING,
  });

  useEffect(() => {
    // handle inital load
    fetchStats();
  }, [currentTestrun]);

  return (
    <>
      <Toolbar shouldShowResolution={false} />
      <Paper elevation={3} sx={{ display: 'flex', justifyContent: 'space-between', px: 4, mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography component='p' mb={1} noWrap variant='h6'>
            Total Requests
          </Typography>
          <Typography color='success.main' component='p' mb={1} variant='h6'>
            {totalRequests}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flex: 0.5 }}>
          <Gauge gaugeValue={errorPercentage} name='Error Rate' />
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography component='p' mb={1} noWrap variant='h6'>
            Total Failures
          </Typography>
          <Typography color='error' component='p' mb={1} variant='h6'>
            {totalFailures}
          </Typography>
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', flexDirection: 'column', rowGap: 4 }}>
        <Box>
          <Typography component='h2' mb={1} variant='h6'>
            Request Statistics
          </Typography>
          <Table
            rows={statsData}
            structure={[
              { key: 'name', title: 'Name' },
              { key: 'method', title: 'Type' },
              { key: 'requests', title: 'Requests' },
              { key: 'failed', title: 'Failed' },
              { key: 'max', title: 'Max', round: 2 },
              {
                key: 'errorPercentage',
                title: 'Error Percentage (%)',
                round: 2,
              },
            ]}
          />
        </Box>
        <Box>
          <Typography component='h2' mb={1} variant='h6'>
            Failure Statistics
          </Typography>
          <Table
            rows={failuresData}
            structure={[
              { key: 'name', title: 'Name' },
              { key: 'exception', title: 'Message' },
              { key: 'count', title: 'Count' },
            ]}
          />
        </Box>
      </Box>
    </>
  );
}
