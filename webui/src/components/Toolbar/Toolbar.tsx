import { Box, SelectChangeEvent } from '@mui/material';
import { Select } from 'locust-ui';

import {
  TOOLBAR_DEFAULT_RESOLUTION,
  TOOLBAR_RESOLUTION_OPTIONS,
} from 'components/Toolbar/Toolbar.constants';
import { useAction, useSelector } from 'redux/hooks';
import { toolbarActions } from 'redux/slice/toolbar.slice';

export default function Toolbar() {
  const setToolbar = useAction(toolbarActions.setToolbar);
  const { testruns, testrunsForDisplay } = useSelector(({ toolbar }) => toolbar);

  return (
    <Box
      sx={{
        display: 'flex',
        columnGap: 2,
        mb: 1,
      }}
    >
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
      {!!testrunsForDisplay.length && (
        <Select
          label='Test Run'
          name='testrun'
          onChange={(e: SelectChangeEvent<string>) => {
            // find in test runs to get correct date format
            setToolbar({ currentTestrun: testruns[testrunsForDisplay.indexOf(e.target.value)] });
          }}
          options={testrunsForDisplay}
          size='small'
          sx={{ width: '250px' }}
        />
      )}
    </Box>
  );
}
