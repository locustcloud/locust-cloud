import { Box, SelectChangeEvent, Typography } from "@mui/material";
import Gauge from "components/Gauge/Gauge";
import {
  LineChart,
  Table,
  useInterval,
  roundToDecimalPlaces,
  IRootState,
  SWARM_STATE,
  Select,
} from "locust-ui";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  IRequestBody,
  adaptPerNameChartData,
  fetchQuery,
  IPerRequestResponse,
  IPerRequestData,
  chartValueFormatter,
} from "utils/api";

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
  users: [string, number][];
  rps: [string, number][];
  errorRate: [string, number][];
}

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

export default function Timescale() {
  const swarmState = useSelector(({ swarm }: IRootState) => swarm.state);
  const startTime = useSelector(({ swarm }: IRootState) => swarm.startTime);

  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [resolution, setResolution] = useState(5);
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
    fetchQuery<{ name: string }[]>(
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
    fetchQuery<IStatsData[]>("/cloud-stats/requests", body, setStatsData);
  const getFailures = (body: IRequestBody) =>
    fetchQuery<IFailuresData[]>("/cloud-stats/failures", body, setFailuresData);
  const getRps = (body: IRequestBody) =>
    fetchQuery<IRpsResponse[]>("/cloud-stats/rps", body, (rps) =>
      setRpsData(
        rps.reduce(
          (rpsChart, { users, rps, errorRate, time }) => ({
            users: [...(rpsChart.users || []), [time, users]],
            rps: [...(rpsChart.rps || []), [time, rps]],
            errorRate: [...(rpsChart.errorRate || []), [time, errorRate]],
          }),
          {} as IRpsData
        )
      )
    );

  const getRpsPerRequest = (body: IRequestBody) =>
    fetchQuery<IRpsPerRequestResponse[]>(
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
    fetchQuery<IAvgResponseTimesResponse[]>(
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
    fetchQuery<IErrorsPerRequestResponse[]>(
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
    fetchQuery<IPerc99ResponseTimesResponse[]>(
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
    fetchQuery<IResponseLengthResponse[]>(
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
    fetchQuery<ITotalRequestsResponse[]>(
      "/cloud-stats/total-requests",
      body,
      ([{ totalRequests }]) => setTotalRequests(totalRequests)
    );
  const getTotalFailures = (body: IRequestBody) =>
    fetchQuery<ITotalFailuresResponse[]>(
      "/cloud-stats/total-failures",
      body,
      ([{ totalFailures }]) => setTotalFailures(totalFailures)
    );
  const getErrorPercentage = (body: IRequestBody) =>
    fetchQuery<IErrorPercentageResponse[]>(
      "/cloud-stats/error-percentage",
      body,
      ([{ errorPercentage }]) =>
        setErrorPercentage(roundToDecimalPlaces(errorPercentage, 2))
    );

  const fetchTimescaleGraphs = () => {
    const currentTimestamp = new Date().toISOString();

    getTotalRequests({ start: startTime, end: timestamp });
    getTotalFailures({ start: startTime, end: timestamp });
    getErrorPercentage({ start: startTime, end: timestamp });
    getRequestNames({ start: startTime, end: timestamp });
    getRequests({ start: startTime, end: timestamp });
    getFailures({ start: startTime, end: timestamp });
    getRpsPerRequest({ start: startTime, end: timestamp, resolution });
    getAvgResponseTimes({ start: startTime, end: timestamp });
    getErrorsPerRequest({ start: startTime, end: timestamp, resolution });
    getPerc99ResponseTimes({ start: startTime, end: timestamp, resolution });
    getResponseLength({ start: startTime, end: timestamp });
    getRps({ start: startTime, end: timestamp, resolution });

    setTimestamp(currentTimestamp);
  };

  useInterval(fetchTimescaleGraphs, 1000, {
    shouldRunInterval:
      swarmState === SWARM_STATE.SPAWNING || swarmState == SWARM_STATE.RUNNING,
  });

  useEffect(() => {
    fetchTimescaleGraphs();
  }, []);

  return (
    <div>
      <Box sx={{ my: 4 }}>
        <Select
          defaultValue={"5"}
          label="Resolution"
          name="resolution"
          sx={{ width: "150px" }}
          onChange={(e: SelectChangeEvent<unknown>) =>
            setResolution(Number(e.target.value))
          }
          options={["1", "2", "5", "10", "30"]}
        />
      </Box>

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
          colors={["#00ca5a", "#0099ff", "#ff6d6d"]}
          lines={[
            {
              name: "Users",
              key: "users",
              yAxisIndex: 0,
            },
            {
              name: "Requests per Second",
              key: "rps",
              yAxisIndex: 1,
              areaStyle: {},
            },
            {
              name: "Errors per Second",
              key: "errorRate",
              yAxisIndex: 1,
              areaStyle: {},
            },
          ]}
          title="Throughput / active users"
          charts={rpsData}
          splitAxis
          yAxisLabels={["Users", "RPS"]}
          chartValueFormatter={chartValueFormatter}
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
          chartValueFormatter={(v) =>
            `${roundToDecimalPlaces(Number((v as string[])[1]), 2)}ms`
          }
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
          chartValueFormatter={chartValueFormatter}
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
          chartValueFormatter={chartValueFormatter}
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
          chartValueFormatter={chartValueFormatter}
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
          chartValueFormatter={chartValueFormatter}
        />
      )}
    </div>
  );
}
