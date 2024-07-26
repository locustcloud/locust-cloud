--
-- PostgreSQL database dump
--

-- Dumped from database version 11.3
-- Dumped by pg_dump version 11.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
--
-- Name: timescaledb; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS timescaledb WITH SCHEMA public;

--
-- Name: EXTENSION timescaledb; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION timescaledb IS 'Enables scalable inserts and complex queries for time-series data';

--
-- Name: tablefunc; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS tablefunc WITH SCHEMA public;

--
-- Name: EXTENSION tablefunc; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION tablefunc IS 'functions that manipulate whole tables, including crosstab';


SET default_tablespace = '';

SET default_with_oids = false;
--
-- Name: request; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.requests (
    time timestamp with time zone NOT NULL,
    run_id timestamp with time zone NOT NULL,
    exception text,
    greenlet_id integer NOT NULL,
    loadgen text NOT NULL,
    name text NOT NULL,
    request_type text NOT NULL,
    response_length integer,
    response_time double precision,
    success smallint NOT NULL,
    pid integer,
    context jsonb,
    url character varying(255)
);


ALTER TABLE public.requests OWNER TO postgres;

CREATE TABLE public.testruns (
    id timestamp with time zone NOT NULL,
    num_users integer NOT NULL,
    description text,
    end_time timestamp with time zone,
    rps_avg numeric,
    resp_time_avg numeric,
    fail_ratio double precision,
    requests integer,
    arguments text,
    exit_code integer
);


ALTER TABLE public.testruns OWNER TO postgres;
--
-- Name: user_count; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.number_of_users (
    user_count integer NOT NULL,
    time timestamp with time zone NOT NULL,
    run_id timestamp with time zone
);


ALTER TABLE public.number_of_users OWNER TO postgres;
--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    time timestamp with time zone NOT NULL,
    text text NOT NULL,
    run_id timestamp with time zone
);


ALTER TABLE public.events OWNER TO postgres;
--
-- Name: testrun testrun_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.testruns
    ADD CONSTRAINT testrun_pkey PRIMARY KEY (id);
--
-- Name: request_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX request_time_idx ON public.requests USING btree (time DESC);

--
-- Name: run_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX run_id_idx ON public.requests USING btree (run_id);

--
-- Name: testrun_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX testrun_id_idx ON public.testruns USING btree (id DESC);

--
-- Name: user_count_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_count_time_idx ON public.number_of_users USING btree (time DESC);
