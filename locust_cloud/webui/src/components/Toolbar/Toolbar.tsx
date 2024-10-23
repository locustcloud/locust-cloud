import { useEffect, useState } from 'react';
import { Box, Checkbox, FormControlLabel, SelectChangeEvent } from '@mui/material';
import { Select } from 'locust-ui';

import {
  TOOLBAR_DEFAULT_RESOLUTION,
  TOOLBAR_RESOLUTION_OPTIONS,
} from 'components/Toolbar/Toolbar.constants';
import { useAction, useSelector } from 'redux/hooks';
import { toolbarActions } from 'redux/slice/toolbar.slice';
import { pushQuery } from 'utils/url';

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
  const { testruns, testrunsForDisplay, currentTestrunIndex } = useSelector(
    ({ toolbar }) => toolbar,
  );
  const [currentTestrunDisplayValue, setCurrentTestrunDisplayValue] = useState(
    testrunsForDisplay[0],
  );

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
  };

  useEffect(() => {
    if (currentTestrunIndex) {
      setCurrentTestrunDisplayValue(testrunsForDisplay[currentTestrunIndex]);
    }
  }, [currentTestrunIndex, testrunsForDisplay]);

  return (
    <Box
      sx={{
        display: 'flex',
        columnGap: 2,
        mb: 1,
      }}
    >
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
      {showHideAdvanced && (
        <FormControlLabel
          control={<Checkbox onChange={handleShowHideAdvanced} />}
          label='Advanced'
        />
      )}
    </Box>
  );
}
