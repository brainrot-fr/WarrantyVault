FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng libtesseract-dev \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app && useradd --system --gid app --home-dir /app app
WORKDIR /app
COPY --from=build /workspace/target/warranty-vault-api-1.0.0.jar app.jar
USER app
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-Xmx350m -XX:+UseSerialGC"
ENTRYPOINT ["java","-jar","/app/app.jar"]
