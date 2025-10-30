# Dockerfile for TraceNet Railway Deployment

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /app

# Copy server project
COPY server/*.csproj ./server/
WORKDIR /app/server
RUN dotnet restore

# Copy everything and build
WORKDIR /app
COPY server/ ./server/
WORKDIR /app/server
RUN dotnet publish -c Release -o out

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app/server/out .

# Railway will provide PORT env var
# ASPNETCORE_URLS is set via Railway environment variables

ENTRYPOINT ["dotnet", "server.dll"]