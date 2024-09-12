FROM locustio/locust:latest

RUN pip install locust-cloud

ADD run.sh .

ENTRYPOINT ["bash", "./run.sh"]
