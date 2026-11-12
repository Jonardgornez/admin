FROM node:22-alpine

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the React application
COPY . .

# Expose Vite development server
EXPOSE 5173

# Start Vite and allow access outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]