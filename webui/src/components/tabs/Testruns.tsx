import { useEffect, useState } from 'react';
import { Table } from 'locust-ui';

import { useSelector } from 'redux/hooks';
import { IRequestBody, fetchQuery } from 'utils/api';

interface ITestrunsTable {
  id: string;
  arguments: string;
  startTimeEpoch: string;
  numUsers: number;
  requests: number;
  respTime: number;
  rpsAvg: number;
  failRatio: number;
  endTime: string;
  endTimeEpoch: string;
  exitCode: string;
  runTime: string;
}

export default function Testruns() {
  const { testruns, currentTestrun } = useSelector(({ toolbar }) => toolbar);

  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [testrunsTableData, setTestrunsTableData] = useState<ITestrunsTable[]>([]);

  const getTestruns = (body: IRequestBody) =>
    fetchQuery<ITestrunsTable[]>('/cloud-stats/testruns-table', body, setTestrunsTableData);

  const fetchTestruns = () => {
    const currentTimestamp = new Date().toISOString();
    const payload = {
      start: currentTestrun,
      end: timestamp,
      testrun: currentTestrun,
    };

    getTestruns(payload);

    setTimestamp(currentTimestamp);
  };

  useEffect(() => {
    fetchTestruns();
  }, [testruns]);

  return (
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
  );
}
