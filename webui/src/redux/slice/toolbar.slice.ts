import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export interface IToolbarState {
  resolution?: string;
}

export type ToolbarAction = PayloadAction<IToolbarState>;

const initialState = {
  resolution: '5',
};

const toolbarSlice = createSlice({
  name: 'toolbar',
  initialState,
  reducers: {
    setToolbar: (_, { payload }) => payload,
  },
});

export const toolbarActions = toolbarSlice.actions;
export default toolbarSlice.reducer;
