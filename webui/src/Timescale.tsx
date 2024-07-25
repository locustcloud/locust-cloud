import { Box, Typography } from "@mui/material";
import Gauge from "components/Gauge/Gauge";
import { LineChart, Table, useInterval } from "locust-ui";
import { useState } from "react";

const startTime = new Date(new Date().getTime() - 5 * 60 * 1000).toISOString();

const roundToDecimalPlaces = (n: number, decimalPlaces = 0) => {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(n * factor) / factor;
};

interface IRequestBody {
  start: string;
  end: string;
}

interface IRequestLines {
  name: string;
  key: string;
}

interface IStatsData {
  method: string;
  name: string;
  average: number;
  requests: number;
  failed: number;
  min: number;
  max: number;
  errorPercentage: number;
}

interface IFailuresData {
  name: string;
  exception: string;
  count: number;
}

interface IRpsResponse {
  users: number;
  rps: number;
  time: string;
}

interface IRpsData {
  users: number[];
  rps: number[];
  time: string[];
}

interface IErrorPerSecondResponse {
  errorRate: number;
  time: string;
}

interface IErrorPerSecondData {
  errorRate: number[];
  time: string[];
}

interface IPerRequestResponse {
  name: string;
  time: string;
}

type IPerRequestData = {
  [key: string]: number[];
} & { time: string[] };

interface IRpsPerRequestResponse extends IPerRequestResponse {
  throughput: number;
}

interface IAvgResponseTimesResponse extends IPerRequestResponse {
  responseTime: number;
}

interface IErrorsPerRequestResponse extends IPerRequestResponse {
  errorRate: number;
}

interface IPerc99ResponseTimesResponse extends IPerRequestResponse {
  perc99: number;
}

interface IResponseLengthResponse extends IPerRequestResponse {
  responseLength: number;
}

interface IErrorPercentageResponse {
  errorPercentage: number;
}

function makeRequest<ResponseType>(
  url: string,
  body: IRequestBody,
  onSuccess: (response: ResponseType) => void
) {
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
    .then((res) => res.json())
    .then(onSuccess)
    .catch(console.error);
}

export default function Timescale() {
  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [totalRequests, setTotalRequests] = useState<number>();
  const [totalFailures, setTotalFailures] = useState<number>();
  const [errorPercentage, setErrorPercentage] = useState<number>();
  const [requestLines, setRequestLines] = useState<IRequestLines[]>();
  const [statsData, setStatsData] = useState<IStatsData[]>();
  const [failuresData, setFailuresData] = useState<IFailuresData[]>();
  const [rpsData, setRpsData] = useState<IRpsData>();
  const [errorsPerSecond, setErrorsPerSecond] = useState<IErrorPerSecondData>();
  const [rpsPerRequest, setRpsPerRequest] = useState<IPerRequestData>();
  const [avgResponseTimes, setAvgResponseTimes] = useState<IPerRequestData>();
  const [errorsPerRequest, setErrorsPerRequest] = useState<IPerRequestData>();
  const [perc99ResponseTimes, setPerc99ResponseTimes] =
    useState<IPerRequestData>();
  const [responseLength, setResponseLength] = useState<IPerRequestData>();

  const getRequestNames = (body: IRequestBody) =>
    makeRequest<{ name: string }[]>(
      "/cloud-stats/request-names",
      body,
      (requestNames) =>
        setRequestLines(
          requestNames.map(({ name: requestName }) => ({
            name: `${requestName}`,
            key: requestName,
          }))
        )
    );
  const getRequests = (body: IRequestBody) =>
    makeRequest<IStatsData[]>("/cloud-stats/requests", body, setStatsData);
  const getFailures = (body: IRequestBody) =>
    makeRequest<IFailuresData[]>(
      "/cloud-stats/failures",
      body,
      setFailuresData
    );
  const getRps = (body: IRequestBody) =>
    makeRequest<IRpsResponse[]>("/cloud-stats/rps", body, (rps) =>
      setRpsData(
        rps.reduce(
          (rpsChart, { users, rps, time }) => ({
            users: [...(rpsChart.users || []), users],
            rps: [...(rpsChart.rps || []), rps],
            time: [...(rpsChart.time || []), time],
          }),
          {} as IRpsData
        )
      )
    );
  const getErrorPerSecond = (body: IRequestBody) =>
    makeRequest<IErrorPerSecondResponse[]>(
      "/cloud-stats/errors-per-second",
      body,
      (errorsPerSecond) =>
        setErrorsPerSecond(
          errorsPerSecond.reduce(
            (errorChart, { errorRate, time }) => ({
              errorRate: [...(errorChart.errorRate || []), errorRate],
              time: [...(errorChart.time || []), time],
            }),
            {} as IErrorPerSecondData
          )
        )
    );
  const getRpsPerRequest = (body: IRequestBody) =>
    makeRequest<IRpsPerRequestResponse[]>(
      "/cloud-stats/rps-per-request",
      body,
      (rpsPerRequest) =>
        setRpsPerRequest(
          rpsPerRequest.reduce(
            (rpsChart, { name, throughput, time }) =>
              ({
                ...rpsChart,
                [name]: [...(rpsChart[name] || []), throughput],
                time: [...(rpsChart.time || []), time],
              } as IPerRequestData),
            {} as IPerRequestData
          )
        )
    );
  const getAvgResponseTimes = (body: IRequestBody) =>
    makeRequest<IAvgResponseTimesResponse[]>(
      "/cloud-stats/avg-response-times",
      body,
      (avgResponseTimes) =>
        setAvgResponseTimes(
          avgResponseTimes.reduce(
            (avgChart, { name, responseTime, time }) =>
              ({
                ...avgChart,
                [name]: [...(avgChart[name] || []), responseTime],
                time: [...(avgChart.time || []), time],
              } as IPerRequestData),
            {} as IPerRequestData
          )
        )
    );
  const getErrorsPerRequest = (body: IRequestBody) =>
    makeRequest<IErrorsPerRequestResponse[]>(
      "/cloud-stats/errors-per-request",
      body,
      (errorsPerRequest) =>
        setErrorsPerRequest(
          errorsPerRequest.reduce(
            (errorChart, { name, errorRate, time }) =>
              ({
                ...errorChart,
                [name]: [...(errorChart[name] || []), errorRate],
                time: [...(errorChart.time || []), time],
              } as IPerRequestData),
            {} as IPerRequestData
          )
        )
    );
  const getPerc99ResponseTimes = (body: IRequestBody) =>
    makeRequest<IPerc99ResponseTimesResponse[]>(
      "/cloud-stats/perc99-response-times",
      body,
      (perc99ResponseTimes) =>
        setPerc99ResponseTimes(
          perc99ResponseTimes.reduce(
            (perc99Chart, { name, perc99, time }) =>
              ({
                ...perc99Chart,
                [name]: [...(perc99Chart[name] || []), perc99],
                time: [...(perc99Chart.time || []), time],
              } as IPerRequestData),
            {} as IPerRequestData
          )
        )
    );
  const getResponseLength = (body: IRequestBody) =>
    makeRequest<IResponseLengthResponse[]>(
      "/cloud-stats/response-length",
      body,
      (responseLength) =>
        setResponseLength(
          responseLength.reduce(
            (responseLengthChart, { name, responseLength, time }) =>
              ({
                ...responseLengthChart,
                [name]: [...(responseLengthChart[name] || []), responseLength],
                time: [...(responseLengthChart.time || []), time],
              } as IPerRequestData),
            {} as IPerRequestData
          )
        )
    );

  const getTotalRequests = (body: IRequestBody) =>
    makeRequest<number>("/cloud-stats/total-requests", body, setTotalRequests);
  const getTotalFailures = (body: IRequestBody) =>
    makeRequest<number>("/cloud-stats/total-failures", body, setTotalFailures);
  const getErrorPercentage = (body: IRequestBody) =>
    makeRequest<IErrorPercentageResponse[]>(
      "/cloud-stats/error-percentage",
      body,
      ([{ errorPercentage }]) =>
        setErrorPercentage(roundToDecimalPlaces(errorPercentage, 2))
    );

  useInterval(() => {
    const currentTimestamp = new Date().toISOString();
    getTotalRequests({ start: startTime, end: timestamp });
    getTotalFailures({ start: startTime, end: timestamp });
    getErrorPercentage({ start: startTime, end: timestamp });
    getRequestNames({ start: startTime, end: timestamp });
    getRequests({ start: startTime, end: timestamp });
    getFailures({ start: startTime, end: timestamp });
    getRps({ start: startTime, end: timestamp });
    getErrorPerSecond({ start: startTime, end: timestamp });
    getRpsPerRequest({ start: startTime, end: timestamp });
    getAvgResponseTimes({ start: startTime, end: timestamp });
    getErrorsPerRequest({ start: startTime, end: timestamp });
    getPerc99ResponseTimes({ start: startTime, end: timestamp });
    getResponseLength({ start: startTime, end: timestamp });

    setTimestamp(currentTimestamp);
  }, 1000);

  return (
    <div>
      {statsData && (
        <Box mb={2}>
          <Typography component="h2" mb={1} variant="h6">
            Request Statistics
          </Typography>
          <Table
            structure={[
              { key: "name", title: "Name" },
              { key: "method", title: "Type" },
              { key: "requests", title: "Requests" },
              { key: "failed", title: "Failed" },
              { key: "max", title: "Max", round: 2 },
              {
                key: "errorPercentage",
                title: "Error Percentage (%)",
                round: 2,
              },
            ]}
            rows={statsData}
          />
        </Box>
      )}
      {failuresData && (
        <Box mb={2}>
          <Typography component="h2" mb={1} variant="h6">
            Failure Statistics
          </Typography>
          <Table
            structure={[
              { key: "name", title: "Name" },
              { key: "exception", title: "Message" },
              { key: "count", title: "Count" },
            ]}
            rows={failuresData}
          />
        </Box>
      )}
      {!!errorPercentage && (
        <Gauge name="Error Rate" gaugeValue={errorPercentage} />
      )}
      {rpsData && (
        <LineChart<IRpsData>
          colors={["#eeff00", "#0099ff"]}
          lines={[
            { name: "RPS", key: "rps" },
            { name: "Users", key: "users" },
          ]}
          title="RPS per User"
          charts={rpsData}
        />
      )}
      {errorsPerSecond && (
        <LineChart<IErrorPerSecondData>
          colors={["#ff6d6d"]}
          lines={[{ name: "Error Rate", key: "errorRate" }]}
          title="Errors/s"
          charts={errorsPerSecond}
        />
      )}
      {rpsPerRequest && requestLines && (
        <LineChart<IPerRequestData>
          colors={[
            "#9966CC",
            "#8A2BE2",
            "#8E4585",
            "#E0B0FF",
            "#C8A2C8",
            "#E6E6FA",
          ]}
          lines={requestLines}
          title="RPS per Request"
          charts={rpsPerRequest}
        />
      )}
      {avgResponseTimes && requestLines && (
        <LineChart<IPerRequestData>
          colors={[
            "#9966CC",
            "#8A2BE2",
            "#8E4585",
            "#E0B0FF",
            "#C8A2C8",
            "#E6E6FA",
          ]}
          lines={requestLines}
          title="Average Response Times"
          charts={avgResponseTimes}
        />
      )}
      {errorsPerRequest && requestLines && (
        <LineChart<IPerRequestData>
          colors={[
            "#ff8080",
            "#ff4d4d",
            "#ff1a1a",
            "#e60000",
            "#b30000",
            "#800000",
          ]}
          lines={requestLines}
          title="Errors per Request"
          charts={errorsPerRequest}
        />
      )}
      {perc99ResponseTimes && requestLines && (
        <LineChart<IPerRequestData>
          colors={[
            "#9966CC",
            "#8A2BE2",
            "#8E4585",
            "#E0B0FF",
            "#C8A2C8",
            "#E6E6FA",
          ]}
          lines={requestLines}
          title="99th Percentile Response Times"
          charts={perc99ResponseTimes}
        />
      )}
      {responseLength && requestLines && (
        <LineChart<IPerRequestData>
          colors={[
            "#9966CC",
            "#8A2BE2",
            "#8E4585",
            "#E0B0FF",
            "#C8A2C8",
            "#E6E6FA",
          ]}
          lines={requestLines}
          title="Response Length"
          charts={responseLength}
        />
      )}
    </div>
  );
}
