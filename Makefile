IMAGE_NAME = santaman
CONTAINER_NAME = santaman-inst
PORT = 3000

.PHONY: build run stop clean test lint

# Build the Docker image
build:
	docker build -t $(IMAGE_NAME) .

# Run the game in container (accessible at localhost:3000)
run:
	docker run --rm -p $(PORT):$(PORT) --name $(CONTAINER_NAME) $(IMAGE_NAME)

# Run in background
up:
	docker run -d --rm -p $(PORT):$(PORT) --name $(CONTAINER_NAME) $(IMAGE_NAME)

# Stop the running container
stop:
	docker stop $(CONTAINER_NAME)

# Remove the image
clean:
	docker rmi $(IMAGE_NAME)

# Run tests inside the container
test:
	docker run --rm $(IMAGE_NAME) npm test

# Run lint inside the container
lint:
	docker run --rm $(IMAGE_NAME) npm run lint
