import { useEffect, useState } from 'react';
import { Box, Checkbox, FormControlLabel, SelectChangeEvent } from '@mui/material';
import { Select, SWARM_STATE } from 'locust-ui';

import {
  TOOLBAR_DEFAULT_RESOLUTION,
  TOOLBAR_RESOLUTION_OPTIONS,
} from 'components/Toolbar/Toolbar.constants';
import { useGetProfilesMutation } from 'redux/api/cloud-stats';
import { useAction, useLocustSelector, useSelector } from 'redux/hooks';
import { toolbarActions } from 'redux/slice/toolbar.slice';
import { pushQuery, removeQuery } from 'utils/url';

interface IToolbar {
  onSelectTestRun?: (runId: string) => void;
  showHideAdvanced?: boolean;
  shouldShowResolution?: boolean;
}

export default function Toolbar({
  onSelectTestRun,
  showHideAdvanced,
  shouldShowResolution = false,
}: IToolbar) {
  const setToolbar = useAction(toolbarActions.setToolbar);
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const { hasDismissedSwarmForm } = useSelector(({ ui }) => ui);
  const { testruns, testrunsForDisplay, currentTestrunIndex } = useSelector(
    ({ toolbar }) => toolbar,
  );
  const shouldShowAdvancedFromUrl = useLocustSelector(
    ({ url }) => (url.query && url.query.showAdvanced === 'true') || false,
  );
  const profileFromUrl = useLocustSelector(({ url }) => url.query && url.query.profile);
  const [currentTestrunDisplayValue, setCurrentTestrunDisplayValue] = useState(
    testrunsForDisplay[0],
  );
  const [profiles, setProfiles] = useState<string[]>();

  const [getProfiles] = useGetProfilesMutation();

  const handleTestrunChange = (e: SelectChangeEvent<string>) => {
    // find in test runs to get correct date format
    onSelectTestRun && onSelectTestRun(e.target.value);
    const currentTestrun = testruns[e.target.value];
    setToolbar({
      currentTestrun: currentTestrun.runId,
      currentTestrunIndex: currentTestrun.index,
    });
    pushQuery({ testrun: e.target.value });
  };

  const handleShowHideAdvanced = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToolbar({ shouldShowAdvanced: e.target.checked });
    pushQuery({ showAdvanced: String(e.target.checked) });
  };

  const handleSelectProfile = (e: SelectChangeEvent<string>) => {
    const currentProfile = e.target.value;

    if (currentProfile === 'None') {
      setToolbar({ profile: undefined });
      removeQuery('profile');
      return;
    }

    setToolbar({ profile: currentProfile });
    pushQuery({ profile: currentProfile });
  };

  useEffect(() => {
    if (currentTestrunIndex !== undefined && currentTestrunIndex >= 0) {
      setCurrentTestrunDisplayValue(testrunsForDisplay[currentTestrunIndex]);
    }
  }, [currentTestrunIndex, testrunsForDisplay]);

  useEffect(() => {
    if (shouldShowAdvancedFromUrl) {
      setToolbar({ shouldShowAdvanced: shouldShowAdvancedFromUrl });
    }
  }, [shouldShowAdvancedFromUrl]);

  useEffect(() => {
    getProfiles().then(({ data = [] }) => setProfiles(['None'].concat(data)));
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        columnGap: 2,
        mb: 1,
      }}
    >
      {profiles && (
        <Select
          defaultValue={
            (swarmState === SWARM_STATE.STOPPED ||
              window.templateArgs.isGraphViewer ||
              hasDismissedSwarmForm) &&
            profileFromUrl
          }
          displayEmpty
          label='Profile'
          name='profile'
          onChange={handleSelectProfile}
          options={profiles}
          size='small'
          sx={{ width: '250px' }}
        />
      )}
      {!!testrunsForDisplay.length && (
        <Select
          label='Test Run'
          name='testrun'
          onChange={handleTestrunChange}
          options={testrunsForDisplay}
          size='small'
          sx={{ width: '250px' }}
          value={currentTestrunDisplayValue}
        />
      )}
      {shouldShowResolution && (
        <Select
          defaultValue={TOOLBAR_DEFAULT_RESOLUTION}
          label='Resolution'
          name='resolution'
          onChange={(e: SelectChangeEvent<string>) =>
            setToolbar({ resolution: Number(e.target.value) })
          }
          options={TOOLBAR_RESOLUTION_OPTIONS}
          size='small'
          sx={{ width: '150px' }}
        />
      )}
      {showHideAdvanced && (
        <FormControlLabel
          control={
            <Checkbox
              defaultChecked={shouldShowAdvancedFromUrl}
              onChange={handleShowHideAdvanced}
            />
          }
          label='Advanced'
        />
      )}
    </Box>
  );
}
