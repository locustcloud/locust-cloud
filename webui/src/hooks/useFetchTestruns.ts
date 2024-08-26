import { useEffect } from 'react';
import { SWARM_STATE, useInterval } from 'locust-ui';

import { useAction, useLocustSelector, useSelector } from 'redux/hooks';
import { toolbarActions } from 'redux/slice/toolbar.slice';
import { fetchQuery } from 'utils/api';

export default function useFetchTestruns() {
  const setToolbar = useAction(toolbarActions.setToolbar);
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const { testrunsForDisplay, previousTestrun } = useSelector(({ toolbar }) => toolbar);

  const fetchTestruns = () => {
    fetchQuery<{ runId: string; endTime: string }[]>('/cloud-stats/testruns', {}, testrunIds => {
      const testruns = testrunIds.reduce(
        (testrunMap, { runId, endTime }) => ({
          ...testrunMap,
          [new Date(runId).toLocaleString()]: { runId, endTime },
        }),
        {},
      );

      setToolbar({
        testruns,
        currentTestrun: testrunIds[0].runId,
        testrunsForDisplay: testrunIds.map(({ runId }) => new Date(runId).toLocaleString()),
      });
    });
  };

  useInterval(fetchTestruns, 500, {
    shouldRunInterval:
      !testrunsForDisplay.length ||
      (!!previousTestrun &&
        swarmState == SWARM_STATE.RUNNING &&
        testrunsForDisplay[0] <= previousTestrun),
  });

  useEffect(() => {
    if (swarmState === SWARM_STATE.STOPPED && testrunsForDisplay) {
      setToolbar({ previousTestrun: testrunsForDisplay[0] });
    }
  }, [swarmState, testrunsForDisplay]);
}
