export interface ITestrun {
  runId: string;
  endTime: string;
  index: number;
}

export interface ITestrunsMap {
  [key: string]: ITestrun;
}
