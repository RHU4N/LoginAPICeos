#!/usr/bin/env bash
set -euo pipefail
image=ceos-loginapiceos:qa
build_image=ceos-loginapiceos:qa-build
container=ceos-qa-app-$$
mongo=ceos-qa-mongo-$$
network=ceos-qa-network-$$
test ! -e .env.ceos-docker-smoke
test ! -e .ceos-docker-smoke.key
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then docker logs --tail 40 "$container" 2>/dev/null || true; fi
  docker rm -f "$container" "$mongo" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -f .env.ceos-docker-smoke .ceos-docker-smoke.key
  exit "$status"
}
trap cleanup EXIT
printf 'DOCKER_CONTEXT_SENTINEL=not-a-real-secret\n' > .env.ceos-docker-smoke
printf 'not-a-real-private-key\n' > .ceos-docker-smoke.key
docker build -t "$image" .
docker run --rm --entrypoint sh "$image" -ec 'node --version | grep -q "^v24."; test "$(id -u)" != 0; test ! -e /app/.env.ceos-docker-smoke; test ! -e /app/.ceos-docker-smoke.key'
docker network create "$network" >/dev/null
docker run -d --name "$mongo" --network "$network" --network-alias mongo mongo:8.0 >/dev/null
for attempt in $(seq 1 40); do
  if docker exec "$mongo" mongosh --quiet --eval 'quit(db.runCommand({ping:1}).ok ? 0 : 1)' >/dev/null 2>&1; then break; fi
  sleep 1
done
docker run -d --name "$container" --network "$network" -p 127.0.0.1:18081:8081 \
  -e NODE_ENV=production -e MONGO_URI=mongodb://mongo:27017 -e MONGODB_DATABASE=ceos_docker_qa \
  -e JWT_SECRET=docker-smoke-only-key-32-characters-no-production-access -e ENABLE_SWAGGER=false \
  -e CORS_ORIGIN=https://docker-qa.example.invalid "$image" >/dev/null
port=18081
route=/health
ready=false
for attempt in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$port$route" >/dev/null; then ready=true; break; fi
  sleep 1
done
test "$ready" = true
test "$(curl -s -o /tmp/qa-denied.json -w '%{http_code}' http://127.0.0.1:$port/auth/me)" = 401
test "$(curl -s -o /tmp/qa-swagger.html -w '%{http_code}' http://127.0.0.1:$port/api-docs/)" = 404
status=$(curl -s -o /tmp/qa-user.json -w '%{http_code}' -H 'Content-Type: application/json' -d '{"nome":"Docker QA","email":"docker-qa@example.invalid","senha":"DockerQa!7264Safe","confirmaSenha":"DockerQa!7264Safe","telefone":"11999999999"}' http://127.0.0.1:$port/users)
if [ "$status" != 201 ]; then echo "Isolated signup expected 201, received $status"; exit 1; fi
curl -fsS -H 'Content-Type: application/json' -d '{"email":"docker-qa@example.invalid","senha":"DockerQa!7264Safe"}' http://127.0.0.1:$port/auth/login -D /tmp/qa-session.headers -o /tmp/qa-session.json
grep -qi 'HttpOnly' /tmp/qa-session.headers
echo 'Login: production startup, isolated Mongo persistence, cookie login, auth denial and Swagger disabled passed.'
