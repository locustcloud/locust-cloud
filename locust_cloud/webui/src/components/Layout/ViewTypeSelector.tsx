import { Button, Container } from '@mui/material';

import { useAction, useSelector } from 'redux/hooks';
import { UI_VIEW_TYPES, uiActions } from 'redux/slice/ui.slice';

export default function ViewTypeSelector() {
  const setUi = useAction(uiActions.setUi);
  const { viewType } = useSelector(({ ui }) => ui);

  const nextViewType =
    viewType === UI_VIEW_TYPES.CLOUD ? UI_VIEW_TYPES.CLASSIC : UI_VIEW_TYPES.CLOUD;

  return (
    <Container
      maxWidth='xl'
      sx={{
        display: 'flex',
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'flex-end',
        pt: '4px',
        zIndex: 1,
      }}
    >
      <Button
        onClick={() =>
          setUi({
            viewType: nextViewType,
          })
        }
      >
        {nextViewType}
      </Button>
    </Container>
  );
}
