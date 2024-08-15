requests_query = """
SELECT
	name,
  request_type as method,
	SUM(average * count) / SUM(count) as average,
	SUM(count) as requests,
	SUM(failed_count) as failed,
	MIN(min),
	MAX(max),
	SUM(failed_count) / SUM(count) * 100 as "errorPercentage"
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
GROUP BY name, method
"""


failures_query = """
SELECT
  name as name,
  left(exception,300) as exception,
  count(*)
FROM requests
WHERE time BETWEEN %(start)s AND %(end)s AND
 exception is not null
GROUP BY "name",left(exception,300)
"""


requests_per_second = """
WITH user_count_agg AS (
  SELECT
    time_bucket('%(resolution)ss', time) AS time,
    avg(user_count) as users
  FROM number_of_users
  WHERE time BETWEEN %(start)s AND %(end)s
  GROUP BY 1
  ORDER BY 1
),
request_count_agg AS (
  SELECT
    time_bucket('%(resolution)ss', bucket) AS time,
    SUM(count)/%(resolution)s as rps
  FROM requests_summary
  WHERE bucket BETWEEN %(start)s AND %(end)s
  GROUP BY 1
  ORDER BY 1
),
errors_per_s_agg AS (
  SELECT
    time_bucket('%(resolution)ss', bucket) AS time,
    SUM(failed_count)/%(resolution)s as error_rate
  FROM requests_summary
  WHERE bucket BETWEEN %(start)s AND %(end)s
  GROUP BY 1
  ORDER BY 1
)
SELECT
  u.time,
  u.users,
  r.rps,
  e.error_rate as "errorRate"
FROM user_count_agg u
JOIN request_count_agg r ON u.time = r.time
JOIN errors_per_s_agg e on u.time = e.time
ORDER BY u.time;
"""


total_requests = """
SELECT
 SUM(count) as "totalRequests"
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
"""


total_failed = """
SELECT
 SUM(failed_count) as "totalFailures"
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
"""


error_percentage = """
SELECT
	SUM(failed_count) / SUM(count) * 100 "errorPercentage"
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
 """

rps_per_request = """
SELECT
    time_bucket_gapfill('%(resolution)ss', bucket) AS time,
    name,
    COALESCE(SUM(count)/%(resolution)s, 0) as throughput
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
GROUP BY 1, name
ORDER BY 1,2
"""


avg_response_times = """
SELECT
    bucket as time,
    name,
    avg(average) as "responseTime"
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
GROUP BY 1, name
ORDER BY 1, 2
"""

errors_per_request = """
SELECT
    time_bucket_gapfill('%(resolution)ss', bucket) AS time,
    name,
    COALESCE(SUM(failed_count)/%(resolution)s, 0) as "errorRate"
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
GROUP BY 1, name
ORDER BY 1
"""


perc99_response_times = """
SELECT time_bucket('%(resolution)ss', time) AS time,
  name,
  percentile_cont(0.99) within group (order by response_time) as perc99
FROM requests
WHERE time BETWEEN %(start)s AND %(end)s
GROUP BY 1, name
"""


response_length = """
SELECT
    bucket as time,
    response_length as "responseLength",
    name
FROM requests_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
ORDER BY 1
"""


request_names = """
SELECT DISTINCT name
FROM requests
WHERE time BETWEEN %(start)s AND %(end)s
"""

scatterplot = """
SELECT
 time,
 name,
 response_time as "responseTime"
FROM requests
WHERE time BETWEEN %(start)s AND %(end)s
ORDER BY 1,2
"""

testruns = """
SELECT
  id
FROM testruns
ORDER BY id ASC
"""

queries = {
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
}
