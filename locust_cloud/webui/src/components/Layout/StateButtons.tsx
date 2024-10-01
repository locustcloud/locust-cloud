import { Box } from '@mui/material';
import { EditButton, NewTestButton, ResetButton, StopButton, SWARM_STATE } from 'locust-ui';

import { useLocustSelector, useSelector } from 'redux/hooks';
import { UI_VIEW_TYPES } from 'redux/slice/ui.slice';

export default function StateButtons() {
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const viewType = useSelector(({ ui }) => ui.viewType);

  if (swarmState === SWARM_STATE.READY) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', columnGap: 2, marginY: 'auto', height: '50px' }}>
      {swarmState === SWARM_STATE.STOPPED ? (
        <NewTestButton />
      ) : (
        <>
          <EditButton />
          <StopButton />
        </>
      )}
      {viewType == UI_VIEW_TYPES.CLASSIC && <ResetButton />}
    </Box>
  );
}
