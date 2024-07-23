def requests_query(start, end):
    return f"""
SELECT Req1.name, Req1.request_type as "method",
 count(Req1.*) as "requests",
 count(Req1.exception) as "failed",
 (count(Req1.exception)*100.0/(select count(*) from request Req2 where Req2.request_type = Req1.request_type and Req2.name = Req1.name and Req2.time BETWEEN '2024-07-23T11:29:16.011Z' AND '2024-07-23T11:44:16.011Z' and (Req2.testplan = 'locust-breaking.py' or 'locust-breaking.py' = 'All'))) as "error percentage",
 AVG(Req1.response_time) as "average",
 percentile_cont(0.95) within group (order by Req1.response_time) as "perc95",
 percentile_cont(0.99) within group (order by Req1.response_time) as "perc99",
 max(Req1.response_time)
FROM request Req1
WHERE time BETWEEN '{start}' AND '{end}' AND
 (Req1.testplan = 'locust.py' OR 'locust.py' = 'All')
GROUP BY Req1.request_type, Req1.name
"""


def failures_query(start, end):
    return f"""
SELECT name as "name",
 left(exception,300) as exception,
 count(*)
FROM "request"
WHERE time BETWEEN '{start}' AND '{end}' and
 (testplan = 'locust.py' OR 'locust.py' = 'All') AND
 exception is not null
GROUP BY "name",left(exception,300)
"""


def requests_per_second(start, end):
    return f"""
WITH user_count_agg AS (
  SELECT
    time_bucket('5.000s',"time") AS "time",
    avg(user_count) as users
  FROM user_count
  WHERE time BETWEEN '{start}' AND '{end}'
    AND (testplan = 'locust.py' OR 'locust.py' = '')
  GROUP BY 1
  ORDER BY 1
),
request_count_agg AS (
  SELECT
    time_bucket('5.000s',"time") AS "time",
    count(*)/(5000/1000.0) as "rps"
  FROM request
  WHERE time BETWEEN '{start}' AND '{end}'
    AND (testplan = 'locust.py' OR 'locust.py' = 'All')
  GROUP BY 1
  ORDER BY 1
)
SELECT
  u.time,
  u.users,
  r.rps
FROM user_count_agg u
JOIN request_count_agg r ON u.time = r.time
ORDER BY u.time;
"""


def total_requests(start, end):
    return f"""
SELECT
 time_bucket('60.000s',"time") AS "time",
 count(*)
FROM request
WHERE
 "time" BETWEEN '{start}' AND '{end}' AND
 (testplan = 'locust.py' OR 'locust.py' = 'All')
GROUP BY 1
"""


def total_failed(start, end):
    return f"""
SELECT
 time_bucket('60.000s',"time") AS "time",
 count(*)
FROM request
WHERE
 "time" BETWEEN '{start}' AND '{end}' AND
 (testplan = 'locust.py' OR 'locust.py' = 'All') AND
 exception is not null
GROUP BY 1
"""


def error_percentage(start, end):
    return f"""
SELECT
CASE cast(allRec as numeric)
 WHEN 0 THEN 0
 ELSE cast(errorRec as numeric) / cast(allRec as numeric)
END as "errorPercentage"
FROM (SELECT count(*) as allRec FROM request WHERE time BETWEEN '{start}' AND '{end}' and (testplan = 'locust.py' OR 'locust.py' = 'All')) AS "allRecords",
 (SELECT count(*) as errorRec FROM request WHERE time BETWEEN '{start}' AND '{end}' and (testplan = 'locust.py' OR 'locust.py' = 'All') AND exception is not null) AS "errorRecords"
 """


def errors_per_second(start, end):
    return f"""
SELECT time_bucket('5.000s',"time") AS "time",
 count(*)/(5000/1000.0) as "errorRate"
FROM request
WHERE time BETWEEN '{start}' AND '{end}' and
 (testplan = 'locust.py' OR 'locust.py' = 'All') and
 exception is not null
GROUP BY 1
ORDER BY 1
"""


def rps_per_request(start, end):
    return f"""
SELECT time_bucket('5.000s',time) AS "time",
 name,
 count(*)/(5000/1000.0) as throughput
FROM request
WHERE time BETWEEN '{start}' AND '{end}' and
 (testplan = 'locust.py' OR 'locust.py' = 'All')
GROUP BY 1, name
ORDER BY 1,2
"""


def avg_response_times(start, end):
    return f"""
SELECT time_bucket('5.000s',"time") AS "time",
 name,
 avg(response_time) as "responseTime"
FROM request
WHERE time BETWEEN '{start}' AND '{end}' and
 (testplan = 'locust.py' OR 'locust.py' = 'All')
GROUP BY 1, name
ORDER BY 1, 2
"""


def errors_per_request(start, end):
    return f"""
SELECT time_bucket('5.000s',"time") AS "time",
 name,
 count(*)/(5000/1000.0) as "errorRate"
FROM request
WHERE time BETWEEN '{start}' AND '{end}' and
 (testplan = 'locust.py' OR 'locust.py' = 'All') and
 exception is not null
GROUP BY 1, name
ORDER BY 1
"""


def response_times(start, end):
    return f"""
SELECT time_bucket('5.000s',"time") AS "time",
 name,
 avg(response_time)
FROM request
WHERE time BETWEEN '{start}' AND '{end}' and
 (testplan = 'locust.py' OR 'locust.py' = 'All')
GROUP BY 1, name
ORDER BY 1, 2
"""


def perc99_response_times(start, end):
    return f"""
SELECT time_bucket('5.000s',"time") AS "time",
 name,
 percentile_cont(0.99) within group (order by response_time) as "perc99"
FROM request
WHERE time BETWEEN '{start}' AND '{end}' and
 (testplan = 'locust.py' OR 'locust.py' = 'All')
GROUP BY 1, name
ORDER BY 1, 2
"""


def response_length(start, end):
    return f"""
SELECT time_bucket('5.000s',"time") AS "time",
 avg(response_length),
 name
FROM request
WHERE time BETWEEN '{start}' AND '{end}' and
 (testplan = 'locust.py' OR 'locust.py' = 'All')
GROUP BY 1, name
ORDER BY 1
"""


def request_names(start, end):
    return f"""
SELECT DISTINCT name
FROM request
WHERE time BETWEEN '{start}' AND '{end}' and
 (testplan = 'locust.py' OR 'locust.py' = 'All')
"""


queries = {
    "request-names": request_names,
    "requests": requests_query,
    "failures": failures_query,
    "rps": requests_per_second,
    "total-requests": total_requests,
    "total-failures": total_failed,
    "error-percentage": error_percentage,
    "errors-per-second": errors_per_second,
    "rps-per-request": rps_per_request,
    "avg-response-times": avg_response_times,
    "errors-per-request": errors_per_request,
    "response-times": response_times,
    "perc99-response-times": perc99_response_times,
    "response-length": response_length,
}
