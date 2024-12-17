import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { LineChart, Table } from 'locust-ui';

import Toolbar from 'components/Toolbar/Toolbar';
import {
  useGetTestrunsResponseTimeMutation,
  useGetTestrunsRpsMutation,
  useGetTestrunsTableMutation,
} from 'redux/api/cloud-stats';
import { useAction, useLocustSelector, useSelector } from 'redux/hooks';
import { snackbarActions } from 'redux/slice/snackbar.slice';
import { ITestrunsResponseTime, ITestrunsRps, ITestrunsTable } from 'types/testruns.types';
import { chartValueFormatter } from 'utils/chart';

const testrunsTableStructure = [
  { key: 'runId', title: 'Run Id', markdown: true },
  { key: 'profile', title: 'Profile' },
  { key: 'locustfile', title: 'Locustfile' },
  { key: 'username', title: 'Username' },
  { key: 'numUsers', title: '# Users' },
  { key: 'workerCount', title: '# Worker' },
  { key: 'requests', title: '# Requests' },
  { key: 'respTime', title: 'Response Time' },
  { key: 'rpsAvg', title: 'Average RPS' },
  { key: 'failRatio', title: 'Fail Ratio (%)', round: 2 },
  { key: 'exitCode', title: 'Exit Code' },
  { key: 'runTime', title: 'Run Time (s)' },
];

const testrunsRpsChartLines = [
  {
    name: 'Average RPS',
    key: 'avgRps' as keyof ITestrunsRps,
  },
];

const testrunsResponseTimeChartLines = [
  {
    name: 'Average Response Time',
    key: 'avgResponseTime' as keyof ITestrunsResponseTime,
  },
];

const testrunsChartColors = ['#00ca5a', '#ff6d6d'];

export default function Testruns() {
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const { testrunsForDisplay, profile } = useSelector(({ toolbar }) => toolbar);
  const setSnackbar = useAction(snackbarActions.setSnackbar);

  const [getTestrunsTable] = useGetTestrunsTableMutation();
  const [getTestrunsRps] = useGetTestrunsRpsMutation();
  const [getTestrunsResponseTime] = useGetTestrunsResponseTimeMutation();

  const [testrunsTableData, setTestrunsTableData] = useState<ITestrunsTable[]>([]);
  const [testrunsRps, setTestrunsRps] = useState<ITestrunsRps>({
    time: [] as string[],
  } as ITestrunsRps);
  const [testrunsResponseTime, setTestrunsResponseTime] = useState<ITestrunsResponseTime>({
    time: [] as string[],
  } as ITestrunsResponseTime);

  const fetchTestruns = async () => {
    const payload = { profile: profile || null };

    const [
      { data: testrunsTableData, error: testrunsTableError },
      { data: testrunsRps, error: testrunsRpsError },
      { data: testrunsResponseTime, error: testrunsResponseTimeError },
    ] = await Promise.all([
      getTestrunsTable(payload),
      getTestrunsRps(payload),
      getTestrunsResponseTime(payload),
    ]);

    const fetchError = testrunsTableError || testrunsRpsError || testrunsResponseTimeError;

    if (fetchError && 'error' in fetchError) {
      setSnackbar({ message: fetchError.error });
    } else {
      setTestrunsTableData(testrunsTableData as ITestrunsTable[]);
      setTestrunsRps(testrunsRps as ITestrunsRps);
      setTestrunsResponseTime(testrunsResponseTime as ITestrunsResponseTime);
    }
  };

  useEffect(() => {
    fetchTestruns();
  }, [testrunsForDisplay, swarmState]);

  return (
    <Box>
      <Toolbar shouldShowTestruns={false} />
      <Box sx={{ height: '500px', overflowY: 'auto', mb: 8 }}>
        <Table rows={testrunsTableData} structure={testrunsTableStructure} />
      </Box>
      <Box sx={{ display: 'flex' }}>
        <LineChart<ITestrunsRps>
          chartValueFormatter={chartValueFormatter}
          charts={testrunsRps}
          colors={testrunsChartColors}
          lines={testrunsRpsChartLines}
          title='Throughput'
        />
        <LineChart<ITestrunsResponseTime>
          chartValueFormatter={chartValueFormatter}
          charts={testrunsResponseTime}
          colors={testrunsChartColors}
          lines={testrunsResponseTimeChartLines}
          title='Response Time'
        />
      </Box>
    </Box>
  );
}
