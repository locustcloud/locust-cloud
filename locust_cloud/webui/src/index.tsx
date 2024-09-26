import { locustStore } from 'locust-ui';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';

import App from 'App';
import { ReduxContext } from 'redux/slice/root.slice';
import { Action, IRootState, store } from 'redux/store';

import { setApiBaseUrl } from './config';

declare global {
  interface Window {
    templateArgs: {
      api_base_url: string;
    };
  }
}

if (window.templateArgs && window.templateArgs.api_base_url) {
  setApiBaseUrl(window.templateArgs.api_base_url);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider<Action, IRootState> context={ReduxContext} store={store}>
    <Provider store={locustStore}>
      <App />
    </Provider>
  </Provider>
);