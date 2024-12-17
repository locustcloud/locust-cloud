from typing import LiteralString

requests_query = """
SELECT
	name,
  request_type as method,
	countMerge(count) as requests,
	countMerge(failed_count) as failed,
	maxMerge(max_state),
	countMerge(failed_count) / countMerge(count) * 100 as "errorPercentage"
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
GROUP BY name, method
"""


failures_query = """
SELECT
  name as name,
  exception,
  count()
FROM requests
WHERE time BETWEEN %(start)s AND %(end)s AND
  success = 0
AND run_id = %(testrun)s
GROUP BY name, exception
"""


requests_per_second = """
WITH request_count_agg AS (
  SELECT
    toStartOfInterval(bucket, INTERVAL 5 SECOND) AS time,
    ifNull(countMerge(count), 0) AS rps
  FROM requests_summary
  WHERE bucket BETWEEN %(start)s AND toDateTime(%(end)s)
  AND run_id = %(testrun)s
  GROUP BY time
  ORDER BY time
),
user_count_agg AS (
  SELECT
    toStartOfInterval(time, INTERVAL 5 SECOND) AS time,
    ifNull(avg(user_count), 0) AS users
  FROM number_of_users
  WHERE time BETWEEN %(start)s AND toDateTime(%(end)s)
  AND run_id = %(testrun)s
  GROUP BY time
  ORDER BY time
),
errors_per_s_agg AS (
  SELECT
    toStartOfInterval(bucket, INTERVAL 5 SECOND) AS time,
    ifNull(countMerge(failed_count), 0) AS error_rate
  FROM requests_summary
  WHERE bucket BETWEEN %(start)s AND toDateTime(%(end)s)
  AND run_id = %(testrun)s
  GROUP BY time
  ORDER BY time
)
SELECT
  r.time AS time,
  u.users,
  r.rps,
  e.error_rate AS "errorRate"
FROM request_count_agg r
LEFT JOIN user_count_agg u ON r.time = u.time
LEFT JOIN errors_per_s_agg e ON r.time = e.time
ORDER BY r.time
"""


total_requests = """
SELECT
 countMerge(count) as "totalRequests"
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
"""


total_failed = """
SELECT
 countMerge(failed_count) as "totalFailures"
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
"""


error_percentage = """
SELECT
	ifNull(countMerge(failed_count) / nullif(countMerge(count), 0), 0) * 100 as "errorPercentage"
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
"""

rps_per_request = """
SELECT
  toStartOfInterval(bucket, INTERVAL %(resolution)s SECOND) AS time,
  name,
  ifNull(countMerge(count)/%(resolution)s, 0) as throughput
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
GROUP BY 1, name
ORDER BY 1,2
"""


avg_response_times = """
SELECT
  toStartOfInterval(bucket, INTERVAL %(resolution)s SECOND) AS time,
  avgMerge(response_time_state) as responseTime,
  name
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
GROUP BY time, name
ORDER BY 1, 2
"""

errors_per_request = """
SELECT
  toStartOfInterval(bucket, INTERVAL %(resolution)s SECOND) AS time,
  name,
  countMerge(failed_count)/%(resolution)s as "errorRate"
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
GROUP BY 1, name
ORDER BY 1
"""


perc99_response_times = """
SELECT
  toStartOfInterval(bucket, INTERVAL %(resolution)s SECOND) AS time,
  name,
  quantileMerge(perc99_state) as perc99
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
GROUP BY 1, name
ORDER BY 1
"""


response_length = """
SELECT
  toStartOfInterval(bucket, INTERVAL %(resolution)s SECOND) AS time,
  avgMerge(response_length_state) as "responseLength",
  name
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
GROUP BY 1, name
ORDER BY 1
"""


request_names = """
SELECT DISTINCT name
FROM requests_summary
"""

scatterplot = """
SELECT
 time,
 name,
 response_time as "responseTime"
FROM requests
WHERE time BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
ORDER BY 1,2
"""

testruns = """
SELECT
  id as "runId",
  end_time as "endTime",
  locustfile,
  profile
FROM testruns
ORDER BY id DESC
"""

testruns_table = """
SELECT
 id as "runId",
 profile,
 num_users as "numUsers",
 round(rps_avg, 1) as "rpsAvg",
 round(resp_time_avg, 1) as "respTime",
 fail_ratio as "failRatio",
 requests,
 end_time - id AS "runTime",
 exit_code as "exitCode",
 username,
 worker_count as "workerCount",
 locustfile
FROM testruns
WHERE %(profile)s IS NULL or profile = %(profile)s
OR locustfile = %(profile)s
ORDER BY id DESC
"""

testruns_rps = """
WITH avg_rps AS (
  SELECT
    id AS time,
    rps_avg AS avg_rps
  FROM testruns
  WHERE %(profile)s IS NULL or profile = %(profile)s
  OR locustfile = %(profile)s
  ORDER BY id
),
avg_rps_failed AS (
  SELECT
    id AS time,
    CASE
      WHEN exit_code > 0 THEN rps_avg
      ELSE 0
    END AS avg_rps_failed
  FROM testruns
  WHERE %(profile)s IS NULL or profile = %(profile)s
  OR locustfile = %(profile)s
  ORDER BY id
)
SELECT
  a.time,
  a.avg_rps as "avgRps",
  f.avg_rps_failed as "avgRpsFailed"
FROM avg_rps a
JOIN avg_rps_failed f ON a.time = f.time
ORDER BY a.time
"""

testruns_response_time = """
WITH avg_response_time AS (
  SELECT
    id AS time,
    resp_time_avg AS avg_response_time
  FROM testruns
  WHERE %(profile)s IS NULL or profile = %(profile)s
  OR locustfile = %(profile)s
  ORDER BY id
),
avg_response_time_failed AS (
  SELECT
    id AS time,
    CASE
      WHEN exit_code > 0 THEN resp_time_avg
      ELSE 0
    END AS avg_response_time_failed
  FROM testruns
  WHERE %(profile)s IS NULL or profile = %(profile)s
  OR locustfile = %(profile)s
  ORDER BY id
)
SELECT
  a.time,
  a.avg_response_time as "avgResponseTime",
  f.avg_response_time_failed as "avgResponseTimeFailed"
FROM avg_response_time a
JOIN avg_response_time_failed f ON a.time = f.time
ORDER BY a.time
"""

total_vuh = """
SELECT
  ifNull(sum((end_time - id) * num_users), '0') AS "totalVuh"
FROM testruns
WHERE id >= date_trunc('month', NOW()) AND NOT refund
"""

customer = """
SELECT
  max_vuh as "maxVuh",
  max_workers as "maxWorkers",
  max_users as "maxUsers",
  users_per_worker as "usersPerWorker"
FROM customers
"""

profiles = """
SELECT DISTINCT
CASE
  WHEN profile IS NOT NULL AND profile != '' THEN profile
  ELSE locustfile
END AS profile
FROM testruns
WHERE locustfile IS NOT NULL
"""

queries: dict["str", LiteralString] = {
    "request-names": request_names,
    "requests": requests_query,
    "failures": failures_query,
    "rps": requests_per_second,
    "total-requests": total_requests,
    "total-failures": total_failed,
    "error-percentage": error_percentage,
    "rps-per-request": rps_per_request,
    "avg-response-times": avg_response_times,
    "errors-per-request": errors_per_request,
    "perc99-response-times": perc99_response_times,
    "response-length": response_length,
    "scatterplot": scatterplot,
    "testruns": testruns,
    "testruns-table": testruns_table,
    "testruns-rps": testruns_rps,
    "testruns-response-time": testruns_response_time,
    "total-vuh": total_vuh,
    "customer": customer,
    "profiles": profiles,
}
