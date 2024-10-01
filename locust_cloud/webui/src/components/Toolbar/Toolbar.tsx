import { Box, SelectChangeEvent } from '@mui/material';
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
}

export default function Toolbar({ onSelectTestRun }: IToolbar) {
  const setToolbar = useAction(toolbarActions.setToolbar);
  const { testruns, testrunsForDisplay } = useSelector(({ toolbar }) => toolbar);

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
          onChange={handleTestrunChange}
          options={testrunsForDisplay}
          size='small'
          sx={{ width: '250px' }}
        />
      )}
    </Box>
  );
}
