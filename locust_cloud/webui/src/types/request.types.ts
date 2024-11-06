export interface IPerRequestResponse {
  name: string;
  time: string;
}

export type IPerRequestData = {
  [key: string]: (string | null)[][];
} & { time: string[] };

export interface IRequestLinesResponse {
  name: string;
}

export interface IRequestLines {
  name: string;
  key: string;
}

export interface IRpsPerRequestResponse extends IPerRequestResponse {
  throughput: number;
}

export interface IAvgResponseTimesResponse extends IPerRequestResponse {
  responseTime: number;
}

export interface IErrorsPerRequestResponse extends IPerRequestResponse {
  errorRate: number;
}

export interface IPerc99ResponseTimesResponse extends IPerRequestResponse {
  perc99: number;
}

export interface IResponseLengthResponse extends IPerRequestResponse {
  responseLength: number;
}

export interface IRequestBody {
  start?: string;
  end?: string;
  resolution?: number;
  testrun?: string;
}

export interface IRpsResponse {
  users: string | null;
  rps: string | null;
  errorRate: string | null;
  time: string;
}

export interface IRpsData {
  users: [string, string][];
  rps: [string, string][];
  errorRate: [string, string][];
  time: string[];
}

export interface IStatsData {
  method: string;
  name: string;
  average: number;
  requests: number;
  failed: number;
  min: number;
  max: number;
  errorPercentage: number;
}

export interface IFailuresData {
  name: string;
  exception: string;
  count: number;
}

export interface ITotalRequestsResponse {
  totalRequests: number;
}

export interface IVuhResponse {
  totalVuh: string;
}

export interface IScatterplotData {
  name: string;
  responseTime: number;
  time: string;
}
