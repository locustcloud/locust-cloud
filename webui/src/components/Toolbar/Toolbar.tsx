import { Container, Paper, SelectChangeEvent } from '@mui/material';
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
    <Paper elevation={3}>
      <Container maxWidth='xl' sx={{ display: 'flex', alignItems: 'center', columnGap: 2, py: 2 }}>
        <Select
          defaultValue={TOOLBAR_DEFAULT_RESOLUTION}
          label='Resolution'
          name='resolution'
          onChange={(e: SelectChangeEvent<string>) =>
            setToolbar({ resolution: Number(e.target.value) })
          }
          options={TOOLBAR_RESOLUTION_OPTIONS}
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
            sx={{ width: '250px' }}
          />
        )}
      </Container>
    </Paper>
  );
}
