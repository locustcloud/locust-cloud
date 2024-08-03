import { Box, Button, Typography } from "@mui/material";
import Gauge from "components/Gauge/Gauge";
import {
  LineChart,
  Table,
  useInterval,
  roundToDecimalPlaces,
  IRootState,
  SWARM_STATE,
} from "locust-ui";
import { useState } from "react";
import { useSelector } from "react-redux";

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
  errorRate: number;
  time: string;
}

interface IRpsData {
  users: number[];
  rps: number[];
  errorRate: number[];
  time: string[];
}

interface IPerRequestResponse {
  name: string;
  time: string;
}

type IPerRequestData = {
  [key: string]: string[][];
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

interface ITotalRequestsResponse {
  totalRequests: number;
}

interface ITotalFailuresResponse {
  totalFailures: number;
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
    .then((data) => data && data.length && onSuccess(data))
    .catch(console.error);
}

function perRequestValueFormatter(
  value: string | number | string[] | number[]
) {
  return Number((value as string[])[1]), 2;
}

export default function Timescale() {
  const swarmState = useSelector(({ swarm }: IRootState) => swarm.state);
  const startTime = useSelector(({ swarm }: IRootState) => swarm.startTime);

  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [totalRequests, setTotalRequests] = useState<number>();
  const [totalFailures, setTotalFailures] = useState<number>();
  const [errorPercentage, setErrorPercentage] = useState<number>();
  const [requestLines, setRequestLines] = useState<IRequestLines[]>();
  const [statsData, setStatsData] = useState<IStatsData[]>();
  const [failuresData, setFailuresData] = useState<IFailuresData[]>();
  const [rpsData, setRpsData] = useState<IRpsData>();
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
          (rpsChart, { users, rps, errorRate, time }) => ({
            users: [...(rpsChart.users || []), users],
            rps: [...(rpsChart.rps || []), rps],
            errorRate: [...(rpsChart.errorRate || []), errorRate],
            time: [...(rpsChart.time || []), time],
          }),
          {} as IRpsData
        )
      )
    );

  const adaptPerNameChartData = <ChartType extends IPerRequestResponse>(
    chartData: ChartType[],
    key: keyof ChartType
  ) =>
    chartData.reduce((chart, data) => {
      const { name, time } = data;
      const value = data[key] as string;
      const timeAxis = chart.time || [];
      timeAxis.push(time);

      if (!chart[name]) {
        return {
          ...chart,
          [name]: [[time, value]],
          time: timeAxis,
        } as IPerRequestData;
      }

      chart[name].push([time, value]);

      return {
        ...chart,
        time: timeAxis,
      } as IPerRequestData;
    }, {} as IPerRequestData);

  const getRpsPerRequest = (body: IRequestBody) =>
    makeRequest<IRpsPerRequestResponse[]>(
      "/cloud-stats/rps-per-request",
      body,
      (rpsPerRequest) =>
        setRpsPerRequest(
          adaptPerNameChartData<IRpsPerRequestResponse>(
            rpsPerRequest,
            "throughput"
          )
        )
    );
  const getAvgResponseTimes = (body: IRequestBody) =>
    makeRequest<IAvgResponseTimesResponse[]>(
      "/cloud-stats/avg-response-times",
      body,
      (avgResponseTimes) =>
        setAvgResponseTimes(
          adaptPerNameChartData<IAvgResponseTimesResponse>(
            avgResponseTimes,
            "responseTime"
          )
        )
    );
  const getErrorsPerRequest = (body: IRequestBody) =>
    makeRequest<IErrorsPerRequestResponse[]>(
      "/cloud-stats/errors-per-request",
      body,
      (errorsPerRequest) =>
        setErrorsPerRequest(
          adaptPerNameChartData<IErrorsPerRequestResponse>(
            errorsPerRequest,
            "errorRate"
          )
        )
    );
  const getPerc99ResponseTimes = (body: IRequestBody) =>
    makeRequest<IPerc99ResponseTimesResponse[]>(
      "/cloud-stats/perc99-response-times",
      body,
      (perc99ResponseTimes) =>
        setPerc99ResponseTimes(
          adaptPerNameChartData<IPerc99ResponseTimesResponse>(
            perc99ResponseTimes,
            "perc99"
          )
        )
    );
  const getResponseLength = (body: IRequestBody) =>
    makeRequest<IResponseLengthResponse[]>(
      "/cloud-stats/response-length",
      body,
      (responseLength) =>
        setResponseLength(
          adaptPerNameChartData<IResponseLengthResponse>(
            responseLength,
            "responseLength"
          )
        )
    );

  const getTotalRequests = (body: IRequestBody) =>
    makeRequest<ITotalRequestsResponse[]>(
      "/cloud-stats/total-requests",
      body,
      ([{ totalRequests }]) => setTotalRequests(totalRequests)
    );
  const getTotalFailures = (body: IRequestBody) =>
    makeRequest<ITotalFailuresResponse[]>(
      "/cloud-stats/total-failures",
      body,
      ([{ totalFailures }]) => setTotalFailures(totalFailures)
    );
  const getErrorPercentage = (body: IRequestBody) =>
    makeRequest<IErrorPercentageResponse[]>(
      "/cloud-stats/error-percentage",
      body,
      ([{ errorPercentage }]) =>
        setErrorPercentage(roundToDecimalPlaces(errorPercentage, 2))
    );

  useInterval(
    () => {
      const currentTimestamp = new Date().toISOString();

      getTotalRequests({ start: startTime, end: timestamp });
      getTotalFailures({ start: startTime, end: timestamp });
      getErrorPercentage({ start: startTime, end: timestamp });
      getRequestNames({ start: startTime, end: timestamp });
      getRequests({ start: startTime, end: timestamp });
      getFailures({ start: startTime, end: timestamp });
      getAvgResponseTimes({ start: startTime, end: timestamp });
      getErrorsPerRequest({ start: startTime, end: timestamp });
      getPerc99ResponseTimes({ start: startTime, end: timestamp });
      getResponseLength({ start: startTime, end: timestamp });
      getRps({ start: startTime, end: timestamp });
      getRpsPerRequest({ start: startTime, end: timestamp });

      setTimestamp(currentTimestamp);
    },
    1000,
    {
      shouldRunInterval:
        swarmState === SWARM_STATE.SPAWNING ||
        swarmState == SWARM_STATE.RUNNING,
      immediate: true,
    }
  );

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
      <Box sx={{ display: "flex", justifyContent: "space-between", px: 4 }}>
        {!!totalRequests && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography noWrap component="p" mb={1} variant="h6">
              Total Requests
            </Typography>
            <Typography component="p" mb={1} variant="h6" color="success.main">
              {totalRequests}
            </Typography>
          </Box>
        )}
        {statsData && errorPercentage !== undefined && (
          <Box sx={{ display: "flex", flex: 0.5 }}>
            <Gauge name="Error Rate" gaugeValue={errorPercentage} />
          </Box>
        )}
        {!!totalFailures && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography noWrap component="p" mb={1} variant="h6">
              Total Failures
            </Typography>
            <Typography component="p" mb={1} variant="h6" color="error">
              {totalFailures}
            </Typography>
          </Box>
        )}
      </Box>
      {rpsData && (
        <LineChart<IRpsData>
          colors={["#00ca5a", "#ff6d6d", "#0099ff"]}
          lines={[
            {
              name: "Users",
              key: "users",
              yAxisIndex: 0,
            },
            {
              name: "Error Rate",
              key: "errorRate",
              yAxisIndex: 1,
              stack: "requests",
              areaStyle: {},
            },
            {
              name: "RPS",
              key: "rps",
              yAxisIndex: 1,
              stack: "requests",
              areaStyle: {},
            },
          ]}
          title="Total throughput / active users"
          charts={rpsData}
          splitAxis
          yAxisLabels={["Users", "RPS"]}
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
          chartValueFormatter={perRequestValueFormatter}
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
          chartValueFormatter={perRequestValueFormatter}
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
          chartValueFormatter={perRequestValueFormatter}
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
          chartValueFormatter={perRequestValueFormatter}
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
          chartValueFormatter={perRequestValueFormatter}
        />
      )}
    </div>
  );
}
