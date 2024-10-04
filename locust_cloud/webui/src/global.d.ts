import { IWindow } from 'locust-ui';

interface ITemplateArgs extends IWindow['templateArgs'] {
  isGraphViewer: boolean;
  username: string;
}

declare global {
  interface Window extends IWindow {
    templateArgs: ITemplateArgs;
  }
}

export {};
