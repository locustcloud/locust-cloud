import { Button, Container } from '@mui/material';

import { useAction, useSelector } from 'redux/hooks';
import { UI_VIEW_TYPES, uiActions } from 'redux/slice/ui.slice';

export default function ViewTypeSelector() {
  const setUi = useAction(uiActions.setUi);
  const { viewType } = useSelector(({ ui }) => ui);

  const nextViewType =
    viewType === UI_VIEW_TYPES.CLOUD ? UI_VIEW_TYPES.CLASSIC : UI_VIEW_TYPES.CLOUD;

  return (
    <Container maxWidth='xl' sx={{ position: 'relative' }}>
      <Button
        onClick={() =>
          setUi({
            viewType: nextViewType,
          })
        }
        sx={{
          position: 'absolute',
          mt: '4px',
          right: 16,
          zIndex: 1,
        }}
      >
        {nextViewType}
      </Button>
    </Container>
  );
}
