import { useEffect, useState } from 'react';
import { LineChart, useInterval, SWARM_STATE } from 'locust-ui';

import Toolbar from 'components/Toolbar/Toolbar';
import { useLocustSelector, useSelector } from 'redux/hooks';
import {
  IPerRequestData,
  IPerRequestResponse,
  IRequestBody,
  adaptPerNameChartData,
  fetchQuery,
  chartValueFormatter,
} from 'utils/api';

interface IScatterplotData {
  name: string;
  responseTime: number;
  time: string;
}

interface IScatterplotResponse extends IPerRequestResponse {
  responseTime: number;
}

interface IRequestLines {
  name: string;
  key: string;
}

export default function Scatterplot() {
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const { currentTestrun } = useSelector(({ toolbar }) => toolbar);

  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [scatterplot, setScatterplot] = useState<IPerRequestData>();
  const [requestLines, setRequestLines] = useState<IRequestLines[]>();

  const getScatterplot = (body: IRequestBody) =>
    fetchQuery<IScatterplotData[]>('/cloud-stats/scatterplot', body, scatterplot =>
      setScatterplot(adaptPerNameChartData<IScatterplotResponse>(scatterplot, 'responseTime')),
    );

  const getRequestNames = (body: IRequestBody) =>
    fetchQuery<{ name: string }[]>('/cloud-stats/request-names', body, requestNames => {
      (!requestLines ||
        (requestLines &&
          !requestNames.every(({ name }, index) => requestLines[index].name === name))) &&
        setRequestLines(
          requestNames.map(({ name: requestName }) => ({
            name: `${requestName}`,
            key: requestName,
          })),
        );
    });

  const fetchScatterplot = () => {
    const currentTimestamp = new Date().toISOString();
    const payload = {
      start: currentTestrun,
      end: timestamp,
      testrun: currentTestrun,
    };

    getRequestNames(payload);
    getScatterplot(payload);

    setTimestamp(currentTimestamp);
  };

  useInterval(
    () => {
      fetchScatterplot();
    },
    5000,
    {
      shouldRunInterval: swarmState === SWARM_STATE.SPAWNING || swarmState == SWARM_STATE.RUNNING,
    },
  );

  useEffect(() => {
    fetchScatterplot();
  }, [currentTestrun]);

  return (
    <>
      <Toolbar />
      {scatterplot && requestLines && (
        <LineChart<IPerRequestData>
          chartValueFormatter={chartValueFormatter}
          charts={scatterplot}
          colors={['#8A2BE2', '#0000FF', '#00ca5a', '#FFA500', '#FFFF00', '#EE82EE']}
          lines={requestLines}
          scatterplot
          title='Scatterplot'
        />
      )}
    </>
  );
}
