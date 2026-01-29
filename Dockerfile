# Build Stage
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production Stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Optional: Add custom nginx config if client-side routing is needed, 
# for now using default which works for basic static serving.

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
