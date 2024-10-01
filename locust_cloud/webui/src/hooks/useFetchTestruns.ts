import { useEffect } from 'react';
import { SWARM_STATE, useInterval } from 'locust-ui';

import { useAction, useLocustSelector, useSelector } from 'redux/hooks';
import { snackbarActions } from 'redux/slice/snackbar.slice';
import { toolbarActions } from 'redux/slice/toolbar.slice';
import { fetchQuery } from 'utils/api';

export default function useFetchTestruns() {
  const setToolbar = useAction(toolbarActions.setToolbar);
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const { testrunsForDisplay, previousTestrun } = useSelector(({ toolbar }) => toolbar);
  const setSnackbar = useAction(snackbarActions.setSnackbar);

  const onError = (error: string) => setSnackbar({ message: error });

  const fetchTestruns = () => {
    fetchQuery<{ runId: string; endTime: string }[]>(
      '/cloud-stats/testruns',
      {},
      testrunIds => {
        const testruns = testrunIds.reduce(
          (testrunMap, { runId, endTime }, index) => ({
            ...testrunMap,
            [new Date(runId).toLocaleString()]: { runId, endTime, index },
          }),
          {},
        );

        setToolbar({
          testruns,
          currentTestrun: testrunIds[0].runId,
          currentTestrunIndex: 0,
          testrunsForDisplay: testrunIds.map(({ runId }) => new Date(runId).toLocaleString()),
        });
      },
      onError,
    );
  };

  useInterval(fetchTestruns, 500, {
    shouldRunInterval:
      (swarmState != SWARM_STATE.READY && !testrunsForDisplay.length) ||
      (!!previousTestrun &&
        swarmState == SWARM_STATE.RUNNING &&
        testrunsForDisplay[0] <= previousTestrun),
  });

  useEffect(() => {
    if (swarmState === SWARM_STATE.STOPPED && testrunsForDisplay) {
      setToolbar({ previousTestrun: testrunsForDisplay[0] });
    }
  }, [swarmState, testrunsForDisplay]);

  useEffect(() => {
    if (window.templateArgs.isGraphViewer) {
      fetchTestruns();
    }
  }, []);
}
