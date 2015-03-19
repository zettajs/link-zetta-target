FROM mdobson/node-zetta-docker

MAINTAINER Matthew Dobson <mdobson@apigee.com>

ADD     . /zetta_target
WORKDIR /zetta_target
RUN     npm install

ENV    PORT 3000
EXPOSE 3000

CMD        ["target_server.js"]
ENTRYPOINT ["node"]
