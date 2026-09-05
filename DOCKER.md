# Docker

Create a `.env` file containing `mongoUri` (or `MONGO_URI`) for MongoDB Atlas
and `JWT_SECRET`, then run:

```bash
docker compose up --build
```

The API will be available at http://localhost:8081. This Compose file does not
start MongoDB; it uses the Atlas connection in `.env`.
