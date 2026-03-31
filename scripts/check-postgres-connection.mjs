#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function loadDatabaseUrlFromEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return null;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.startsWith("DATABASE_URL=")) {
      continue;
    }

    return line.slice("DATABASE_URL=".length);
  }

  return null;
}

const databaseUrl = process.env.DATABASE_URL || loadDatabaseUrlFromEnvFile();

function getConnectionErrorMessage(error) {
  if (!databaseUrl) {
    return "DATABASE_URL is required";
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = rawMessage.toLowerCase();

  if (
    message.includes("password authentication failed")
    || (message.includes("autentica") && message.includes("senha"))
  ) {
    return "Falha ao autenticar no Postgres com o DATABASE_URL atual. Alinhe usuario, senha e host com o stack Docker.";
  }

  if (
    message.includes("econnrefused")
    || message.includes("connect")
    || message.includes("timeout")
    || message.includes("getaddrinfo")
    || message.includes("no such host")
  ) {
    return "Nao foi possivel conectar ao Postgres com o DATABASE_URL atual. Verifique host, porta e disponibilidade do banco.";
  }

  return `Falha ao conectar ao Postgres: ${rawMessage}`;
}

if (!databaseUrl) {
  console.error(getConnectionErrorMessage(new Error("DATABASE_URL is required")));
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 20,
});

try {
  const ping = await sql`SELECT 1 AS ok`;
  console.log(`Postgres conectado: ok=${ping[0]?.ok ?? 0}`);

  const tables = ["projects", "tasks", "vault_entries"];
  for (const table of tables) {
    try {
      const rows = await sql.unsafe(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      console.log(`${table}: ${rows[0]?.count ?? 0} registro(s)`);
    } catch (error) {
      console.log(`${table}: erro ao consultar (${error instanceof Error ? error.message : String(error)})`);
    }
  }
} catch (error) {
  console.error(getConnectionErrorMessage(error));
  process.exitCode = 1;
} finally {
  await sql.end();
}
