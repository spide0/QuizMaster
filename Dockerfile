# Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy rest of the project
COPY . .

# Build frontend
RUN npm run build

# Expose desired port (adjust if different)
EXPOSE 3000

# Start the server
CMD ["npm", "run", "start"]