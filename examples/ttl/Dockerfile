FROM node:10

# Create app directory
WORKDIR /usr/src/app

# Copy the project
COPY . .

# Compile the library and link the library
RUN npm install && npm run compile && npm prune --production && npm link

# Installation of package to run the application
RUN cd examples/ttl && npm link "express-idempotency-mongo-adapter" && npm install --only=prod

EXPOSE 8080

# Run the application
CMD ["node", "./examples/ttl/src/index.js"]

