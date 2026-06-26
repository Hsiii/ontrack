.PHONY: build deploy dev format ios-archive ios-build ios-check ios-export ios-release lint preview worker-build web-build

dev:
	bun run dev

build:
	bun run build

web-build:
	bun run build:web

worker-build:
	bun run build:worker

lint:
	bun run lint

format:
	bun run format

preview:
	bun run preview

deploy:
	bun run deploy

ios-check:
	bun run ios:check

ios-build:
	bun run ios:build

ios-archive:
	bun run ios:archive

ios-export:
	bun run ios:export

ios-release:
	bun run ios:release
