#!/bin/bash

docker build --platform linux/amd64 -t deck/desktop-runtime-dev:latest -f Dockerfile .