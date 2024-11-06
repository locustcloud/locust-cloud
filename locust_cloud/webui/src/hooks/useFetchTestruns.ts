import { useEffect } from 'react';
import { SWARM_STATE, useInterval } from 'locust-ui';
import { ITestrunsMap } from 'types/testruns.types';

import { useGetTestrunsMutation } from 'redux/api/cloud-stats';
import { useAction, useLocustSelector, useSelector } from 'redux/hooks';
import { snackbarActions } from 'redux/slice/snackbar.slice';
import { toolbarActions } from 'redux/slice/toolbar.slice';

export default function useFetchTestruns() {
  const setToolbar = useAction(toolbarActions.setToolbar);
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const testrunFromUrl = useLocustSelector(({ url }) => url.query && url.query.testrun);
  const { testrunsForDisplay, previousTestrun } = useSelector(({ toolbar }) => toolbar);
  const { hasDismissedSwarmForm } = useSelector(({ ui }) => ui);
  const setSnackbar = useAction(snackbarActions.setSnackbar);

  const [getTestruns] = useGetTestrunsMutation();

  const fetchTestruns = async () => {
    const { data: testrunIds, error: fetchError } = await getTestruns();

    if (fetchError && 'error' in fetchError) {
      setSnackbar({ message: fetchError.error });
    }

    if (testrunIds) {
      const testruns = testrunIds.reduce(
        (testrunMap, { runId, endTime }, index) => ({
          ...testrunMap,
          [new Date(runId).toLocaleString()]: { runId, endTime, index },
        }),
        {} as ITestrunsMap,
      );

      const currentTestrun =
        swarmState === SWARM_STATE.RUNNING
          ? testrunIds[0]
          : (testrunFromUrl && testruns[testrunFromUrl]) || testrunIds[0];

      setToolbar({
        testruns,
        currentTestrun: currentTestrun.runId,
        currentTestrunIndex: currentTestrun.index || 0,
        testrunsForDisplay: testrunIds.map(({ runId }) => new Date(runId).toLocaleString()),
      });
    }
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
    if (window.templateArgs.isGraphViewer || hasDismissedSwarmForm) {
      fetchTestruns();
    }
  }, [hasDismissedSwarmForm]);
}
