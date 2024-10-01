import { IWindow } from 'locust-ui';

interface ITemplateArgs extends IWindow['templateArgs'] {
  isGraphViewer: boolean;
  apiBaseUrl: string;
}

declare global {
  interface Window extends IWindow {
    templateArgs: ITemplateArgs;
  }
}

export {};
