import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { updateStateWithPayload } from 'redux/utils';

export interface ISnackbarSlice {
  message: string | null;
}

export type SnackbarAction = PayloadAction<Partial<ISnackbarSlice>>;

const initialState: ISnackbarSlice = {
  message: null,
};

const snackbarSlice = createSlice({
  name: 'snackbar',
  initialState,
  reducers: {
    setSnackbar: updateStateWithPayload,
  },
});

export const snackbarActions = snackbarSlice.actions;
export default snackbarSlice.reducer;
