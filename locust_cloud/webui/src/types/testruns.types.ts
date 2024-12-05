export interface ITestrun {
  runId: string;
  endTime: string;
  index: number;
  profile?: string;
  locustfile?: string;
}

export interface ITestrunsMap {
  [key: string]: ITestrun;
}

export interface ITestrunsTable {
  runId: string;
  profile: string;
  numUsers: string;
  rpsAvg: string;
  respTime: string;
  failRatio: string;
  requests: string;
  runTime: string;
  exitCode: string;
  username: string;
  workerCount: string;
  locustfile: string;
}

export interface ITestrunsRpsResponse {
  avgRps: string;
  avgRpsFailed: string;
  time: string;
}

export interface ITestrunsRps {
  avgRps: [string, string][];
  avgRpsFailed: [string, string][];
  time: string[];
}

export interface ITestrunsResponseTimeResponse {
  avgResponseTime: string;
  avgResponseTimeFailed: string;
  time: string;
}

export interface ITestrunsResponseTime {
  avgResponseTime: [string, string][];
  avgResponseTimeFailed: [string, string][];
  time: string[];
}

export interface ITestrunsPayload {
  profile: string | null;
}
