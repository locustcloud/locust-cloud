import { Box } from '@mui/material';
import { EditButton, NewTestButton, ResetButton, StopButton, SWARM_STATE } from 'locust-ui';

import useSwarmForm from 'hooks/useSwarmForm';
import { useLocustSelector, useSelector } from 'redux/hooks';
import { UI_VIEW_TYPES } from 'redux/slice/ui.slice';

export default function StateButtons() {
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const viewType = useSelector(({ ui }) => ui.viewType);
  const {
    alert: newTestFormAlert,
    shouldDisableForm: shouldDisableNewTestForm,
    handleFormChange: handleNewTestFormChange,
  } = useSwarmForm();
  const {
    alert: editFormAlert,
    shouldDisableForm: shouldDisableEditForm,
    handleFormChange: handleEditFormChange,
  } = useSwarmForm();

  if (swarmState === SWARM_STATE.READY) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', columnGap: 2, marginY: 'auto', height: '50px' }}>
      {swarmState === SWARM_STATE.STOPPED ? (
        <NewTestButton
          alert={newTestFormAlert}
          isDisabled={shouldDisableNewTestForm}
          onFormChange={handleNewTestFormChange}
        />
      ) : (
        <>
          <EditButton
            alert={editFormAlert}
            isDisabled={shouldDisableEditForm}
            onFormChange={handleEditFormChange}
          />
          <StopButton />
        </>
      )}
      {viewType == UI_VIEW_TYPES.CLASSIC && <ResetButton />}
    </Box>
  );
}
