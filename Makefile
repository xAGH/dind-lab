.PHONY: seed build up down logs restart backup smoke-test hash-password

# Descarga y empaqueta las imagenes del tema de la clase (lab-image/seed-images.txt).
seed:
	./scripts/seed-images.sh

# Construye la imagen del laboratorio y la del orquestador.
build:
	docker compose build --profile build

up:
	mkdir -p data
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f orchestrator

restart:
	docker compose restart orchestrator

# Respaldo manual del roster (ademas del cron, ver README).
backup:
	./scripts/backup-roster.sh

# Enciende N instancias de prueba, mide RAM/tiempo real, y las limpia.
# Uso: make smoke-test COUNT=30 ADMIN_PASSWORD=tu-clave
smoke-test:
	ADMIN_PASSWORD=$(ADMIN_PASSWORD) ./scripts/smoke-test.sh $(or $(COUNT),30)

# Genera el hash bcrypt para ADMIN_PASSWORD_HASH en .env.
# Uso: make hash-password PASSWORD=tu-clave
hash-password:
	docker compose run --rm --no-deps --entrypoint node orchestrator scripts/hash-password.mjs "$(PASSWORD)"
