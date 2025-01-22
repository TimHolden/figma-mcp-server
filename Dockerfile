# Use a Node.js image as the base for building the TypeScript project
FROM node:20 AS builder

# Set the working directory in the container
WORKDIR /app

# Copy the package files and install the dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the source code to the working directory
COPY src ./src
COPY tsconfig.json ./

# Build the TypeScript code
RUN npm run build

# Use a smaller Node.js image for running the built server
FROM node:20-slim

# Set the working directory in the container
WORKDIR /app

# Copy the built code and necessary files from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Environment variables for configuration
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port the app runs on
EXPOSE 3000

# Start the server
CMD ["node", "dist/index.js"]