import { Action } from 'redux/store';

export function updateStateWithPayload<ReducerState, ActionType extends Action = Action>(
  state: ReducerState,
  { payload }: ActionType,
) {
  return { ...state, ...payload };
}
