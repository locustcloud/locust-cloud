import { IWindow } from 'locust-ui';

import { ITemplateArgs } from 'types/window.types';

declare global {
  interface Window extends IWindow {
    templateArgs: IWindow['templateArgs'] & ITemplateArgs;
  }
}

export {};
