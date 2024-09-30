import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { LineChart, Table } from 'locust-ui';

import { useAction, useSelector } from 'redux/hooks';
import { snackbarActions } from 'redux/slice/snackbar.slice';
import { chartValueFormatter, fetchQuery } from 'utils/api';

interface ITestrunsTable {
  runId: string;
  arguments: string;
  startTimeEpoch: string;
  numUsers: string;
  requests: string;
  respTime: string;
  rpsAvg: string;
  failRatio: string;
  endTime: string;
  endTimeEpoch: string;
  exitCode: string;
  runTime: string;
}

interface ITestrunsRpsResponse {
  avgRps: string;
  avgRpsFailed: string;
  time: string;
}

interface ITestrunsRps {
  avgRps: [string, string][];
  avgRpsFailed: [string, string][];
  time: string[];
}

interface ITestrunsResponseTimeResponse {
  avgResponseTime: string;
  avgResponseTimeFailed: string;
  time: string;
}

interface ITestrunsResponseTime {
  avgResponseTime: [string, string][];
  avgResponseTimeFailed: [string, string][];
  time: string[];
}

export default function Testruns() {
  const { testrunsForDisplay } = useSelector(({ toolbar }) => toolbar);
  const setSnackbar = useAction(snackbarActions.setSnackbar);

  const onError = (error: string) => setSnackbar({ message: error });

  const [testrunsTableData, setTestrunsTableData] = useState<ITestrunsTable[]>([]);
  const [testrunsRps, setTestrunsRps] = useState<ITestrunsRps>({
    time: [] as string[],
  } as ITestrunsRps);
  const [testrunsResponseTime, setTestrunsResponseTime] = useState<ITestrunsResponseTime>({
    time: [] as string[],
  } as ITestrunsResponseTime);

  const getTestrunsTable = () =>
    fetchQuery<ITestrunsTable[]>(
      '/cloud-stats/testruns-table',
      {},
      testruns =>
        setTestrunsTableData(
          testruns.map(({ runId, ...testrunData }) => ({
            ...testrunData,
            runId: new Date(runId).toLocaleString(),
          })),
        ),
      onError,
    );

  const getTestrunsRps = () =>
    fetchQuery<ITestrunsRpsResponse[]>(
      '/cloud-stats/testruns-rps',
      {},
      response =>
        setTestrunsRps(
          response.reduce(
            (rpsChart, { avgRps, avgRpsFailed, time }) => ({
              ...rpsChart,
              avgRps: [...(rpsChart.avgRps || []), [time, avgRps]],
              avgRpsFailed: [...(rpsChart.avgRpsFailed || []), [time, avgRpsFailed]],
              time: [...(rpsChart.time || []), time],
            }),
            {} as ITestrunsRps,
          ),
        ),
      onError,
    );
  const getTestrunsResponseTime = () =>
    fetchQuery<ITestrunsResponseTimeResponse[]>(
      '/cloud-stats/testruns-response-time',
      {},
      response =>
        setTestrunsResponseTime(
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
        ),
      onError,
    );

  useEffect(() => {
    getTestrunsTable();
    getTestrunsRps();
    getTestrunsResponseTime();
  }, [testrunsForDisplay]);

  return (
    <Box>
      <Box sx={{ height: '500px', overflowY: 'auto', mb: 8 }}>
        <Table
          rows={testrunsTableData}
          structure={[
            { key: 'runId', title: 'Run Id' },
            { key: 'numUsers', title: '# Users' },
            { key: 'requests', title: '# Requests' },
            { key: 'respTime', title: 'Response Time' },
            { key: 'rpsAvg', title: 'Average RPS' },
            { key: 'failRatio', title: 'Fail Ratio' },
            { key: 'exitCode', title: 'Exit Code' },
            { key: 'runTime', title: 'Run Time' },
          ]}
        />
      </Box>
      <Box sx={{ display: 'flex' }}>
        <LineChart<ITestrunsRps>
          chartValueFormatter={chartValueFormatter}
          charts={testrunsRps}
          colors={['#00ca5a', '#ff6d6d']}
          lines={[
            {
              name: 'Average RPS',
              key: 'avgRps',
            },
          ]}
          title='Throughput'
        />
        <LineChart<ITestrunsResponseTime>
          chartValueFormatter={chartValueFormatter}
          charts={testrunsResponseTime}
          colors={['#00ca5a', '#ff6d6d']}
          lines={[
            {
              name: 'Average Response Time',
              key: 'avgResponseTime',
            },
          ]}
          title='Response Time'
        />
      </Box>
    </Box>
  );
}
