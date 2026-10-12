# Gateway image. Built from a binary produced by
#   make platform GOOS=linux GOARCH=arm64   (or amd64)
# copied here as ./rwd. The binary embeds the console and the page SDK.
FROM alpine:3.22
RUN adduser -D -u 10001 rwd && mkdir /data && chown rwd /data
COPY rwd /usr/local/bin/rwd
USER rwd
ENV RWD_ADDR=:8080 RWD_DATA=/data/rwd.db RWD_TRUST_PROXY=1
VOLUME /data
EXPOSE 8080
CMD ["rwd", "serve"]
