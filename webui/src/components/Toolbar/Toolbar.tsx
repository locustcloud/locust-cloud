import { Container, Paper, SelectChangeEvent } from '@mui/material';
import { Select } from 'locust-ui';

import {
  TOOLBAR_DEFAULT_RESOLUTION,
  TOOLBAR_RESOLUTION_OPTIONS,
} from 'components/Toolbar/Toolbar.constants';
import { useAction } from 'redux/hooks';
import { toolbarActions } from 'redux/slice/toolbar.slice';

export default function Toolbar() {
  const setToolbar = useAction(toolbarActions.setToolbar);

  return (
    <Paper elevation={3} sx={{ display: 'flex' }}>
      <Container maxWidth='xl'>
        <Select
          defaultValue={TOOLBAR_DEFAULT_RESOLUTION}
          label='Resolution'
          name='resolution'
          onChange={(e: SelectChangeEvent<string>) =>
            setToolbar({ resolution: Number(e.target.value) })
          }
          options={TOOLBAR_RESOLUTION_OPTIONS}
          sx={{ width: '150px', my: 4 }}
        />
      </Container>
    </Paper>
  );
}
