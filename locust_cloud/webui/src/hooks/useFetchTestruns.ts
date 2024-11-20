import { useEffect } from 'react';
import { pushQuery, SWARM_STATE, useInterval } from 'locust-ui';

import { useGetTestrunsMutation } from 'redux/api/cloud-stats';
import { useAction, useLocustSelector, useSelector } from 'redux/hooks';
import { snackbarActions } from 'redux/slice/snackbar.slice';
import { toolbarActions } from 'redux/slice/toolbar.slice';
import { ITestrunsMap } from 'types/testruns.types';

export default function useFetchTestruns() {
  const setToolbar = useAction(toolbarActions.setToolbar);
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const { testrun: testrunFromUrl, profile: profileFromUrl } = useLocustSelector(
    ({ url }) => url.query || {},
  );
  const { testrunsForDisplay, previousTestrun, profile } = useSelector(({ toolbar }) => toolbar);
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

      const currentProfile =
        swarmState === SWARM_STATE.RUNNING ? profile : profile || profileFromUrl;

      const testrunsForProfile = testrunIds.filter(
        ({ profile, locustfile }) =>
          !currentProfile || profile === currentProfile || locustfile === currentProfile,
      );
      const testrunsForDisplay = testrunsForProfile.map(({ runId }) =>
        new Date(runId).toLocaleString(),
      );

      const currentTestrun =
        swarmState === SWARM_STATE.RUNNING || profile
          ? testruns[testrunsForDisplay[0]]
          : (testrunFromUrl && testruns[testrunFromUrl]) || testruns[testrunsForDisplay[0]];

      if (profile) {
        pushQuery({ testrun: testrunsForDisplay[0] });
      }

      setToolbar({
        testruns,
        currentTestrun: currentTestrun.runId,
        currentTestrunIndex: currentTestrun.index || 0,
        testrunsForDisplay: testrunsForDisplay,
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

  useEffect(() => {
    if (
      (swarmState != SWARM_STATE.READY ||
        window.templateArgs.isGraphViewer ||
        hasDismissedSwarmForm) &&
      profile
    ) {
      fetchTestruns();
    }
  }, [swarmState, profile]);
}
