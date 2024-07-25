-- this needs to be in a different file/session, so that timescale extension is properly initialized

SELECT create_hypertable('request', 'time');

CREATE MATERIALIZED VIEW request_summary
WITH (timescaledb.continuous) AS
SELECT 
    name,
    request_type,
    time_bucket(INTERVAL '1s', time) AS bucket,
    AVG(response_length) as "responseLength",
    AVG(response_time) as "average",
    MAX(response_time),
    MIN(response_time),
    PERCENTILE_CONT(0.95) within GROUP (order by response_time) as "perc95",
    PERCENTILE_CONT(0.99) within GROUP (order by response_time) as "perc99",
    count(*),
    count(exception) as "failedCount"
FROM request
GROUP BY name, bucket, request_type;

ALTER MATERIALIZED VIEW request_summary set (timescaledb.materialized_only = true);
ALTER MATERIALIZED VIEW request_summary set (timescaledb.materialized_only = false);
