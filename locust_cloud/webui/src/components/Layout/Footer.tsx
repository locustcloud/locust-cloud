import { Button, Container } from '@mui/material';

import { useAction, useSelector } from 'redux/hooks';
import { UI_VIEW_TYPES, uiActions } from 'redux/slice/ui.slice';

export default function Footer() {
  const setUi = useAction(uiActions.setUi);
  const { viewType } = useSelector(({ ui }) => ui);

  const nextViewType =
    viewType === UI_VIEW_TYPES.CLOUD ? UI_VIEW_TYPES.CLASSIC : UI_VIEW_TYPES.CLOUD;

  return (
    <Container
      maxWidth='xl'
      sx={{
        display: 'flex',
        height: 'var(--footer-height)',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      <Button
        onClick={() =>
          setUi({
            viewType: nextViewType,
          })
        }
        variant='text'
      >
        {nextViewType}
      </Button>
    </Container>
  );
}
