import Gauge from "components/Gauge/Gauge";
import { LineChart, Table, useInterval } from "locust-ui";
import { useEffect, useState } from "react";

const startTime = new Date(new Date().getTime() - 5 * 60 * 1000).toISOString();

const roundToDecimalPlaces = (n: number, decimalPlaces = 0) => {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(n * factor) / factor;
};

export default function Timescale() {
  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [totalRequests, setTotalRequests] = useState();
  const [totalFailures, setTotalFailures] = useState();
  const [errorPercentage, setErrorPercentage] = useState();
  const [requestLines, setRequestLines] = useState();
  const [statsData, setStatsData] = useState();
  const [failuresData, setFailuresData] = useState();
  const [rpsData, setRpsData] = useState();
  const [errorsPerSecond, setErrorsPerSecond] = useState();
  const [rpsPerRequest, setRpsPerRequest] = useState();
  const [avgResponseTimes, setAvgResponseTimes] = useState();
  const [errorsPerRequest, setErrorsPerRequest] = useState();
  const [responseTimes, setResponseTimes] = useState();
  const [perc99ResponseTimes, setPerc99ResponseTimes] = useState();
  const [responseLength, setResponseLength] = useState();

  const makeRequest = (url, body, onSuccess) =>
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

  const getRequestNames = (body) =>
    makeRequest("/cloud-stats/request-names", body, (requestNames) =>
      setRequestLines(
        requestNames.map(({ name: requestName }) => ({
          name: `${requestName}`,
          key: requestName,
        }))
      )
    );
  const getRequests = (body) =>
    makeRequest("/cloud-stats/requests", body, setStatsData);
  const getFailures = (body) =>
    makeRequest("/cloud-stats/failures", body, setFailuresData);
  const getRps = (body) =>
    makeRequest("/cloud-stats/rps", body, (rps) =>
      setRpsData(
        rps.reduce(
          (rpsChart, { users, rps, time }) => ({
            users: [...(rpsChart.users || []), users],
            rps: [...(rpsChart.rps || []), rps],
            time: [...(rpsChart.time || []), time],
          }),
          {}
        )
      )
    );
  const getErrorPerSecond = (body) =>
    makeRequest("/cloud-stats/errors-per-second", body, (errorsPerSecond) =>
      setErrorsPerSecond(
        errorsPerSecond.reduce(
          (errorChart, { errorRate, time }) => ({
            errorRate: [...(errorChart.errorRate || []), errorRate],
            time: [...(errorChart.time || []), time],
          }),
          {}
        )
      )
    );
  const getRpsPerRequest = (body) =>
    makeRequest("/cloud-stats/rps-per-request", body, (rpsPerRequest) =>
      setRpsPerRequest(
        rpsPerRequest.reduce(
          (rpsChart, { name, throughput, time }) => ({
            ...rpsChart,
            [name]: [...(rpsChart[name] || []), throughput],
            time: [...(rpsChart.time || []), time],
          }),
          {}
        )
      )
    );
  const getAvgResponseTimes = (body) =>
    makeRequest("/cloud-stats/avg-response-times", body, (avgResponseTimes) =>
      setAvgResponseTimes(
        avgResponseTimes.reduce(
          (avgChart, { name, responseTime, time }) => ({
            ...avgChart,
            [name]: [...(avgChart[name] || []), responseTime],
            time: [...(avgChart.time || []), time],
          }),
          {}
        )
      )
    );
  const getErrorsPerRequest = (body) =>
    makeRequest("/cloud-stats/errors-per-request", body, (errorsPerRequest) =>
      setErrorsPerRequest(
        errorsPerRequest.reduce(
          (errorChart, { name, errorRate, time }) => ({
            ...errorChart,
            [name]: [...(errorChart[name] || []), errorRate],
            time: [...(errorChart.time || []), time],
          }),
          {}
        )
      )
    );
  const getResponseTimes = (body) =>
    makeRequest("/cloud-stats/response-times", body, (responseTimes) =>
      setResponseTimes(
        responseTimes.reduce(
          (responseTimeChart, { name, avg, time }) => ({
            ...responseTimeChart,
            [name]: [...(responseTimeChart[name] || []), avg],
            time: [...(responseTimeChart.time || []), time],
          }),
          {}
        )
      )
    );
  const getPerc99ResponseTimes = (body) =>
    makeRequest(
      "/cloud-stats/perc99-response-times",
      body,
      (perc99ResponseTimes) =>
        setPerc99ResponseTimes(
          perc99ResponseTimes.reduce(
            (perc99Chart, { name, perc99, time }) => ({
              ...perc99Chart,
              [name]: [...(perc99Chart[name] || []), perc99],
              time: [...(perc99Chart.time || []), time],
            }),
            {}
          )
        )
    );
  const getResponseLength = (body) =>
    makeRequest("/cloud-stats/response-length", body, (responseLength) =>
      setResponseLength(
        responseLength.reduce(
          (responseLengthChart, { name, avg, time }) => ({
            ...responseLengthChart,
            [name]: [...(responseLengthChart[name] || []), avg],
            time: [...(responseLengthChart.time || []), time],
          }),
          {}
        )
      )
    );

  const getTotalRequests = (body) =>
    makeRequest("/cloud-stats/total-requests", body, setTotalRequests);
  const getTotalFailures = (body) =>
    makeRequest("/cloud-stats/total-failures", body, setTotalFailures);
  const getErrorPercentage = (body) =>
    makeRequest(
      "/cloud-stats/error-percentage",
      body,
      ([{ errorPercentage }]) =>
        setErrorPercentage(roundToDecimalPlaces(errorPercentage * 100, 2))
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
    getResponseTimes({ start: startTime, end: timestamp });
    getPerc99ResponseTimes({ start: startTime, end: timestamp });
    getResponseLength({ start: startTime, end: timestamp });

    setTimestamp(currentTimestamp);
  }, 1000);

  return (
    <div>
      {statsData && (
        <Table
          structure={[
            { key: "name", title: "Name" },
            { key: "method", title: "Type" },
            { key: "requests", title: "Requests" },
            { key: "failed", title: "Failed" },
            { key: "max", title: "Max", round: 2 },
            { key: "errorPercentage", title: "Error Percentage (%)", round: 2 },
          ]}
          rows={statsData}
        />
      )}
      {failuresData && (
        <Table
          structure={[
            { key: "name", title: "Name" },
            { key: "exception", title: "Message" },
            { key: "count", title: "Count" },
          ]}
          rows={failuresData}
        />
      )}
      {!!errorPercentage && (
        <Gauge name="Error Rate" gaugeValue={errorPercentage} />
      )}
      {rpsData && (
        <LineChart
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
        <LineChart
          colors={["#ff6d6d"]}
          lines={[{ name: "Error Rate", key: "errorRate" }]}
          title="Errors/s"
          charts={errorsPerSecond}
        />
      )}
      {rpsPerRequest && requestLines && (
        <LineChart
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
        <LineChart
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
        <LineChart
          colors={[
            "#9966CC",
            "#8A2BE2",
            "#8E4585",
            "#E0B0FF",
            "#C8A2C8",
            "#E6E6FA",
          ]}
          lines={requestLines}
          title="Errors per Request"
          charts={errorsPerRequest}
        />
      )}
      {responseTimes && requestLines && (
        <LineChart
          colors={[
            "#9966CC",
            "#8A2BE2",
            "#8E4585",
            "#E0B0FF",
            "#C8A2C8",
            "#E6E6FA",
          ]}
          lines={requestLines}
          title="Response Times"
          charts={responseTimes}
        />
      )}
      {perc99ResponseTimes && requestLines && (
        <LineChart
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
        <LineChart
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
