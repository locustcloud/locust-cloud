-- this needs to be in a different file/session, so that timescale extension is properly initialized

SELECT create_hypertable('requests', 'time');

CREATE MATERIALIZED VIEW requests_summary
WITH (timescaledb.continuous) AS
SELECT 
    name,
    run_id,
    request_type,
    time_bucket(INTERVAL '1s', time) AS bucket,
    AVG(response_length) as response_length,
    AVG(response_time) as average,
    MAX(response_time),
    MIN(response_time),
    PERCENTILE_CONT(0.95) within GROUP (order by response_time) as perc95,
    PERCENTILE_CONT(0.99) within GROUP (order by response_time) as perc99,
    count(*),
    count(exception) as failed_count
FROM requests
GROUP BY name, run_id, bucket, request_type;

ALTER MATERIALIZED VIEW requests_summary set (timescaledb.materialized_only = false);
