import { useEffect, useState } from 'react';
import { LineChart, useInterval, SWARM_STATE } from 'locust-ui';

import Toolbar from 'components/Toolbar/Toolbar';
import { useGetRequestNamesMutation, useGetScatterplotMutation } from 'redux/api/cloud-stats';
import { useAction, useLocustSelector, useSelector } from 'redux/hooks';
import { snackbarActions } from 'redux/slice/snackbar.slice';
import { IPerRequestData } from 'types/request.types';
import { chartValueFormatter } from 'utils/chart';
import { utcNow } from 'utils/date';

interface IRequestLines {
  name: string;
  key: string;
}

const SCATTERPLOT_COLORS = ['#8A2BE2', '#0000FF', '#00ca5a', '#FFA500', '#FFFF00', '#EE82EE'];

export default function Scatterplot() {
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const { currentTestrun } = useSelector(({ toolbar }) => toolbar);
  const setSnackbar = useAction(snackbarActions.setSnackbar);

  const [timestamp, setTimestamp] = useState(utcNow());
  const [scatterplot, setScatterplot] = useState<IPerRequestData>({ time: [] });
  const [requestLines, setRequestLines] = useState<IRequestLines[]>([]);

  const [getRequestNames] = useGetRequestNamesMutation();
  const [getScatterplot] = useGetScatterplotMutation();

  const fetchScatterplot = async () => {
    if (currentTestrun) {
      const currentTimestamp = utcNow();
      const payload = {
        start: currentTestrun,
        end: timestamp,
        testrun: currentTestrun,
      };

      const [
        { data: requestLines, error: requestLinesError },
        { data: scatterplot, error: scatterplotError },
      ] = await Promise.all([getRequestNames(payload), getScatterplot(payload)]);

      const fetchError = requestLinesError || scatterplotError;

      if (fetchError && 'error' in fetchError) {
        setSnackbar({ message: fetchError.error });
      }

      if (requestLines && scatterplot) {
        setRequestLines(requestLines);
        setScatterplot(scatterplot);
      }

      if (swarmState !== SWARM_STATE.STOPPED) {
        setTimestamp(currentTimestamp);
      }
    }
  };

  useInterval(fetchScatterplot, 5000, {
    shouldRunInterval: swarmState === SWARM_STATE.SPAWNING || swarmState == SWARM_STATE.RUNNING,
  });

  useEffect(() => {
    fetchScatterplot();
  }, [currentTestrun]);

  return (
    <>
      <Toolbar />
      <LineChart<IPerRequestData>
        chartValueFormatter={chartValueFormatter}
        charts={scatterplot}
        colors={SCATTERPLOT_COLORS}
        lines={requestLines}
        scatterplot
        title='Scatterplot'
      />
    </>
  );
}
