# 1) Build client (Vite)
FROM node:20-alpine AS client-build
WORKDIR /app/client

# install deps 
COPY client/package.json client/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline --no-audit; else npm i; fi

# build
COPY client/ .
RUN npm run build

# 2) Build server (.NET)
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /app

# restore (cache)
COPY server/*.csproj ./server/
RUN dotnet restore ./server/server.csproj

# copy sources
COPY server/ ./server/

# put built client into server/wwwroot
COPY --from=client-build /app/client/dist ./server/wwwroot

# publish
WORKDIR /app/server
RUN dotnet publish -c Release -o out

# 3) Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app/server/out .

ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "server.dll"]
