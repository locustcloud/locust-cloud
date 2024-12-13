CREATE TABLE requests (
    time DateTime('UTC') NOT NULL,
    run_id DateTime('UTC') NOT NULL,
    customer text NOT NULL DEFAULT currentUser(),
    exception Nullable(String),
    greenlet_id integer NOT NULL,
    loadgen text NOT NULL,
    name text NOT NULL,
    request_type text NOT NULL,
    response_length integer,
    response_time double precision,
    success smallint NOT NULL,
    pid integer,
    url Nullable(String)
) ENGINE = MergeTree
ORDER BY time

CREATE TABLE requests_summary (
    bucket DateTime('UTC') NOT NULL,
    name text NOT NULL,
    run_id DateTime('UTC') NOT NULL,
    customer text NOT NULL DEFAULT currentUser(),
    request_type text NOT NULL,
    response_length_state AggregateFunction(avg, Int32),
    response_time_state AggregateFunction(avg, Float64),
    min_state AggregateFunction(min, Float64),
    max_state AggregateFunction(max, Float64),
    perc95_state AggregateFunction(quantile(0.95), Float64),
    perc99_state AggregateFunction(quantile(0.99), Float64),
    count AggregateFunction(count, integer),
    failed_count AggregateFunction(count, integer),
) ENGINE = AggregatingMergeTree
ORDER BY (bucket, name, run_id, customer, request_type)

CREATE MATERIALIZED VIEW requests_summary_mv
TO requests_summary
AS
SELECT
    toStartOfInterval(time, INTERVAL 1 SECOND) AS bucket,
    name,
    run_id,
    customer,
    request_type,
    avgState(response_length) AS response_length_state,
    avgState(response_time) AS response_time_state,
    minState(response_time) AS min_state,
    maxState(response_time) AS max_state,
    quantileState(0.95)(response_time) AS perc95_state,
    quantileState(0.99)(response_time) AS perc99_state,
    countState() AS count,
    countState(exception) AS failed_count
FROM requests
GROUP BY name, run_id, customer, request_type, bucket;

CREATE TABLE testruns (
    id DateTime('UTC') NOT NULL,
    num_users integer NOT NULL,
    worker_count integer,
    locustfile text,
    username text,
    description text,
    end_time DateTime('UTC'),
    rps_avg numeric,
    resp_time_avg numeric,
    fail_ratio Float64,
    requests integer,
    arguments text,
    exit_code integer,
    refund boolean NOT NULL DEFAULT false,
    customer text NOT NULL,
    profile text,
)
ORDER BY id

CREATE TABLE number_of_users (
    user_count integer NOT NULL,
    time DateTime('UTC') NOT NULL,
    run_id DateTime('UTC'),
    customer text NOT NULL DEFAULT currentUser()
)
ORDER BY time

CREATE TABLE customers (
    id text UNIQUE NOT NULL,
    email text UNIQUE NOT NULL,
    name text,
    ts_username text NOT NULL,
    ts_password text NOT NULL,
    cluster_name text NOT NULL,
    namespace text NOT NULL DEFAULT 'default',
    users_per_worker integer NOT NULL DEFAULT 500,
    max_workers integer NOT NULL DEFAULT 20,
    max_users integer NOT NULL DEFAULT 10000,
    max_vuh integer NOT NULL DEFAULT 10000
    tier customer_tiers NOT NULL DEFAULT 'FREE'
)
ORDER BY id

CREATE TABLE customers (
    id text NOT NULL,
    email text NOT NULL,
    name text,
    ts_username text NOT NULL,
    ts_password text NOT NULL,
    cluster_name text NOT NULL,
    namespace text NOT NULL DEFAULT 'default',
    users_per_worker integer NOT NULL DEFAULT 500,
    max_workers integer NOT NULL DEFAULT 20,
    max_users integer NOT NULL DEFAULT 10000,
    max_vuh integer NOT NULL DEFAULT 10000,
    tier text NOT NULL DEFAULT 'FREE'
)
PRIMARY KEY (id)
ORDER BY (id, email)

CREATE TABLE events (
    time DateTime('UTC') NOT NULL,
    text text NOT NULL,
    run_id DateTime('UTC'),
    customer text NOT NULL
)
ORDER BY run_id
