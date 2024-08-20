import { useEffect } from 'react';
import { SWARM_STATE, useInterval } from 'locust-ui';

import { useAction, useLocustSelector, useSelector } from 'redux/hooks';
import { toolbarActions } from 'redux/slice/toolbar.slice';
import { fetchQuery } from 'utils/api';

export default function useFetchTestruns() {
  const setToolbar = useAction(toolbarActions.setToolbar);
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  console.log({ swarmState });
  const { testruns = [], previousTestrun } = useSelector(({ toolbar }) => toolbar);

  const fetchTestruns = () => {
    console.log('fetch?');
    fetchQuery<{ runId: string }[]>('/cloud-stats/testruns', {}, testrunIds => {
      const testruns = testrunIds.map(({ runId }) => runId);

      setToolbar({
        testruns,
        currentTestrun: testruns[0],
        testrunsForDisplay: testruns.map(runId => new Date(runId).toLocaleString()),
      });
    });
  };

  useInterval(fetchTestruns, 500, {
    shouldRunInterval:
      !testruns.length ||
      (!!previousTestrun && swarmState == SWARM_STATE.RUNNING && testruns[0] <= previousTestrun),
  });

  useEffect(() => {
    if (swarmState === SWARM_STATE.STOPPED && testruns) {
      setToolbar({ previousTestrun: testruns[0] });
    }
  }, [swarmState, testruns]);
}
