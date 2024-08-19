import { useCallback } from 'react';
import { ActionCreator } from '@reduxjs/toolkit';
import { IRootState as ILocustState, locustStore } from 'locust-ui';
import { TypedUseSelectorHook } from 'react-redux';

import { IRootState, Action, store } from 'redux/store';

export const useLocustSelector: TypedUseSelectorHook<ILocustState> = (
  selector: (state: ILocustState) => any,
) => selector(locustStore.getState());
export const useSelector: TypedUseSelectorHook<IRootState> = (
  selector: (state: IRootState) => any,
) => selector(store.getState());
export const useDispatch = () => (action: Action) => store.dispatch(action);

export function useAction<T extends ActionCreator<Action>>(action: T, dispatch?: any) {
  const dispatchAction = dispatch ? dispatch : useDispatch();

  return useCallback(
    (payload?: Parameters<T>[0]) => {
      dispatchAction(action(payload));
    },
    [action, dispatchAction],
  );
}
