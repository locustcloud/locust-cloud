import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { updateStateWithPayload } from 'redux/utils';

export interface ITestrunsMap {
  [key: string]: {
    runId: string;
    endTime: string;
  };
}

export interface IToolbarState {
  resolution: number;
  currentTestrun?: string;
  previousTestrun?: string;
  testruns: ITestrunsMap;
  testrunsForDisplay: string[];
}

export type ToolbarAction = PayloadAction<Partial<IToolbarState>>;

const initialState = {
  resolution: 5,
  testruns: {},
  testrunsForDisplay: [] as string[],
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
