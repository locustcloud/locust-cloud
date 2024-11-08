FROM locustio/locust:2.32.2

COPY dist /dist

RUN pip install /dist/*

ADD run.sh .

ENTRYPOINT ["bash", "./run.sh"]
