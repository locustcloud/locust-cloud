import { useCallback } from 'react';
import { Alert, Snackbar as MuiSnackbar } from '@mui/material';

import { useAction, useSelector } from 'redux/hooks';
import { snackbarActions } from 'redux/slice/snackbar.slice';

export default function Snackbar() {
  const handleClose = useCallback(() => setSnackbar({ message: null }), []);

  const snackbarMessage = useSelector(({ snackbar }) => snackbar.message);
  const setSnackbar = useAction(snackbarActions.setSnackbar);

  return (
    <MuiSnackbar autoHideDuration={5000} onClose={handleClose} open={!!snackbarMessage}>
      <Alert onClose={handleClose} severity='error' sx={{ width: '100%' }} variant='filled'>
        {snackbarMessage}
      </Alert>
    </MuiSnackbar>
  );
}
