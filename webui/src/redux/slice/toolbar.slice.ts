import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { updateStateWithPayload } from 'redux/utils';

export interface IToolbarState {
  resolution: number;
  currentTestrun?: string;
  previousTestrun?: string;
  testruns?: string[];
  testrunsForDisplay?: string[];
}

export type ToolbarAction = PayloadAction<Partial<IToolbarState>>;

const initialState = {
  resolution: 5,
};

const toolbarSlice = createSlice({
  name: 'toolbar',
  initialState,
  reducers: {
    setToolbar: updateStateWithPayload,
  },
});

export const toolbarActions = toolbarSlice.actions;
export default toolbarSlice.reducer;
