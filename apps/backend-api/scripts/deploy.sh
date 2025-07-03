#!/bin/bash
set -e

IMAGE_TAG=$1
CONTAINER_NAME=backend-api
DOCKER_REPO=mydockerhub/backend-api
PORT=3000

# Pull the new image
docker pull $DOCKER_REPO:$IMAGE_TAG

# Stop and remove the current container if it exists
if [ $(docker ps -q -f name=$CONTAINER_NAME) ]; then
  docker stop $CONTAINER_NAME
  docker rm $CONTAINER_NAME
fi

# Run the new container
docker run -d --name $CONTAINER_NAME -p 80:$PORT $DOCKER_REPO:$IMAGE_TAG

# Health check
sleep 10
if ! curl -f http://localhost/health; then
  echo "Health check failed, rolling back"
  # Rollback: run the previous image (assumes previous tag is available)
  PREV_IMAGE=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep $DOCKER_REPO | head -n 2 | tail -n 1)
  if [ -n "$PREV_IMAGE" ]; then
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
    docker run -d --name $CONTAINER_NAME -p 80:$PORT $PREV_IMAGE
    echo "Rolled back to $PREV_IMAGE"
  else
    echo "No previous image found to roll back to."
  fi
  exit 1
fi

echo "Deployment successful." 