import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { LineChart, Table } from 'locust-ui';

import { useSelector } from 'redux/hooks';
import { IRequestBody, chartValueFormatter, fetchQuery } from 'utils/api';

interface ITestrunsTable {
  id: string;
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
  const { testruns, currentTestrun } = useSelector(({ toolbar }) => toolbar);

  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [testrunsTableData, setTestrunsTableData] = useState<ITestrunsTable[]>([]);
  const [testrunsRps, setTestrunsRps] = useState<ITestrunsRps>({
    time: [] as string[],
  } as ITestrunsRps);
  const [testrunsResponseTime, setTestrunsResponseTime] = useState<ITestrunsResponseTime>({
    time: [] as string[],
  } as ITestrunsResponseTime);

  const getTestrunsTable = (body: IRequestBody) =>
    fetchQuery<ITestrunsTable[]>('/cloud-stats/testruns-table', body, setTestrunsTableData);
  const getTestrunsRps = (body: IRequestBody) =>
    fetchQuery<ITestrunsRpsResponse[]>('/cloud-stats/testruns-rps', body, response =>
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
    );
  const getTestrunsResponseTime = (body: IRequestBody) =>
    fetchQuery<ITestrunsResponseTimeResponse[]>(
      '/cloud-stats/testruns-response-time',
      body,
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
    );

  const fetchTestruns = () => {
    const currentTimestamp = new Date().toISOString();
    const payload = {
      start: currentTestrun,
      end: timestamp,
      testrun: currentTestrun,
    };

    getTestrunsTable(payload);
    getTestrunsRps(payload);
    getTestrunsResponseTime(payload);

    setTimestamp(currentTimestamp);
  };

  useEffect(() => {
    fetchTestruns();
  }, [testruns]);

  return (
    <Box>
      <Box sx={{ height: '500px', overflowY: 'auto', mb: 8 }}>
        <Table
          rows={testrunsTableData}
          structure={[
            { key: 'id', title: 'Run Id' },
            { key: 'arguments', title: 'Arguments' },
            { key: 'startTimeEpoch', title: 'Start Time Epoch' },
            { key: 'numUsers', title: '# Users' },
            { key: 'requests', title: '# Requests' },
            { key: 'respTime', title: 'Response Time' },
            { key: 'rpsAvg', title: 'Average RPS' },
            { key: 'failRatio', title: 'Fail Ratio' },
            { key: 'endTime', title: 'End Time' },
            { key: 'endTimeEpoch', title: 'End Time Epoch' },
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
            {
              name: 'Average RPS Failed',
              key: 'avgRpsFailed',
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
            {
              name: 'Average Response Time Failed',
              key: 'avgResponseTimeFailed',
            },
          ]}
          title='Response Time'
        />
      </Box>
    </Box>
  );
}
