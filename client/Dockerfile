FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port (Vite default is 5173)
EXPOSE 5173

# Start Vite in development mode, binding to 0.0.0.0 so it's accessible from outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
