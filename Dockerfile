FROM locustio/locust:latest

ADD run.sh .

ENTRYPOINT ["bash", "./run.sh"]
