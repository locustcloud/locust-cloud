import { useEffect, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Table, useInterval, roundToDecimalPlaces, SWARM_STATE } from 'locust-ui';

import Gauge from 'components/Gauge/Gauge';
import Toolbar from 'components/Toolbar/Toolbar';
import { useLocustSelector, useSelector } from 'redux/hooks';
import { IRequestBody, fetchQuery } from 'utils/api';

interface IStatsData {
  method: string;
  name: string;
  average: number;
  requests: number;
  failed: number;
  min: number;
  max: number;
  errorPercentage: number;
}

interface IFailuresData {
  name: string;
  exception: string;
  count: number;
}

interface ITotalRequestsResponse {
  totalRequests: number;
}

interface ITotalFailuresResponse {
  totalFailures: number;
}

interface IErrorPercentageResponse {
  errorPercentage: number;
}

export default function Stats() {
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const { currentTestrun } = useSelector(({ toolbar }) => toolbar);

  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [totalRequests, setTotalRequests] = useState<number>(0);
  const [totalFailures, setTotalFailures] = useState<number>(0);
  const [errorPercentage, setErrorPercentage] = useState<number>(0);
  const [statsData, setStatsData] = useState<IStatsData[]>([]);
  const [failuresData, setFailuresData] = useState<IFailuresData[]>([]);

  const getRequests = (body: IRequestBody) =>
    fetchQuery<IStatsData[]>('/cloud-stats/requests', body, setStatsData);
  const getFailures = (body: IRequestBody) =>
    fetchQuery<IFailuresData[]>('/cloud-stats/failures', body, setFailuresData);
  const getTotalRequests = (body: IRequestBody) =>
    fetchQuery<ITotalRequestsResponse[]>(
      '/cloud-stats/total-requests',
      body,
      ([{ totalRequests }]) => setTotalRequests(totalRequests || 0),
    );
  const getTotalFailures = (body: IRequestBody) =>
    fetchQuery<ITotalFailuresResponse[]>(
      '/cloud-stats/total-failures',
      body,
      ([{ totalFailures }]) => setTotalFailures(totalFailures || 0),
    );
  const getErrorPercentage = (body: IRequestBody) =>
    fetchQuery<IErrorPercentageResponse[]>(
      '/cloud-stats/error-percentage',
      body,
      ([{ errorPercentage }]) => {
        const roundedPercentage = roundToDecimalPlaces(errorPercentage, 2);
        setErrorPercentage(isNaN(roundedPercentage) ? 0 : roundedPercentage);
      },
    );

  const fetchStats = () => {
    const currentTimestamp = new Date().toISOString();
    const payload = {
      start: currentTestrun,
      end: timestamp,
      testrun: currentTestrun,
    };

    getTotalRequests(payload);
    getTotalFailures(payload);
    getErrorPercentage(payload);
    getRequests(payload);
    getFailures(payload);

    setTimestamp(currentTimestamp);
  };

  useInterval(fetchStats, 1000, {
    shouldRunInterval: swarmState === SWARM_STATE.SPAWNING || swarmState == SWARM_STATE.RUNNING,
  });

  useEffect(() => {
    fetchStats();
  }, [currentTestrun]);

  return (
    <>
      <Toolbar />
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
