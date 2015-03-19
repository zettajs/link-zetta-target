#!/bin/sh

docker rm zetta-target
docker rmi mdobson/zetta-target-server

docker build -t mdobson/zetta-target-server .

