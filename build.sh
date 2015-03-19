#!/bin/sh

docker rm zetta-target
docker rmi zetta/zetta-target-server

docker build -t zetta/zetta-target-server .

