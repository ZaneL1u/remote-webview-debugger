# Gateway image. Built from a binary produced by
#   make platform GOOS=linux GOARCH=arm64   (or amd64)
# copied here as ./rwd. The binary embeds the console and the page SDK.
# Runs on its own (docker run -p 8080:8080 -v rwd-data:/data …); behind a
# reverse proxy, set RWD_TRUST_PROXY=1 as compose.yml does.
FROM alpine:3.22
RUN adduser -D -u 10001 rwd && mkdir /data && chown rwd /data
COPY rwd /usr/local/bin/rwd
USER rwd
ENV RWD_ADDR=:8080 RWD_DATA=/data/rwd.db
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO /dev/null http://127.0.0.1:8080/v1/healthz || exit 1
CMD ["rwd", "serve"]
