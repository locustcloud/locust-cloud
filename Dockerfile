FROM locustio/locust:latest

COPY dist /dist

RUN pip install /dist/*

ADD run.sh .

# add locustfile as an example. this is actually just used by the viewer.
ADD locustfile.py example_locustfile.py

ENTRYPOINT ["bash", "./run.sh"]
