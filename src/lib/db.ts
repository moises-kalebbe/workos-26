import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
let connectionCheckPromise: Promise<void> | null = null;

if (!connectionString) {
  console.warn("DATABASE_URL not configured - database queries will fail");
}

export const sql = postgres(connectionString!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

function getDatabaseConnectionErrorMessage(error: unknown) {
  if (!connectionString) {
    return "DATABASE_URL não configurado. Configure o Postgres antes de iniciar o app.";
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = rawMessage.toLowerCase();

  if (
    message.includes("password authentication failed")
    || (message.includes("autentica") && message.includes("senha"))
  ) {
    return "Falha ao autenticar no Postgres com o DATABASE_URL atual. Alinhe usuário, senha e host com o stack Docker.";
  }

  if (
    message.includes("econnrefused")
    || message.includes("connect")
    || message.includes("timeout")
    || message.includes("getaddrinfo")
    || message.includes("no such host")
  ) {
    return "Não foi possível conectar ao Postgres com o DATABASE_URL atual. Verifique host, porta e disponibilidade do banco.";
  }

  return `Falha ao conectar ao Postgres: ${rawMessage}`;
}

export async function ensureDatabaseConnection(force = false) {
  if (!connectionString) {
    throw new Error(getDatabaseConnectionErrorMessage(new Error("DATABASE_URL not configured")));
  }

  if (!connectionCheckPromise || force) {
    connectionCheckPromise = sql`SELECT 1`
      .then(() => undefined)
      .catch((error) => {
        connectionCheckPromise = null;
        throw new Error(getDatabaseConnectionErrorMessage(error));
      });
  }

  return connectionCheckPromise;
}

export async function testConnection(force = true) {
  try {
    await ensureDatabaseConnection(force);
    console.log("Database connected");
    return true;
  } catch (error) {
    console.error(getDatabaseConnectionErrorMessage(error));
    return false;
  }
}
