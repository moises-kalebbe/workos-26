import { ensureDatabaseConnection, sql } from "@/lib/db";

export type LocalDbFilter =
  | { type: "eq"; column: string; value: unknown }
  | { type: "in"; column: string; values: unknown[] }
  | { type: "lt"; column: string; value: unknown }
  | { type: "lte"; column: string; value: unknown }
  | { type: "gte"; column: string; value: unknown }
  | { type: "is"; column: string; value: unknown }
  | { type: "not"; column: string; operator: string; value: unknown };

export type LocalDbPayload = {
  action: "select" | "insert" | "update" | "delete" | "upsert";
  select?: string;
  filters?: LocalDbFilter[];
  order?: Array<{ column: string; ascending: boolean }>;
  limit?: number;
  values?: Record<string, unknown> | Array<Record<string, unknown>>;
  onConflict?: string;
};

export const LOCAL_DB_TABLES = new Set([
  "profiles",
  "projects",
  "financial_entries",
  "financial_contracts",
  "time_sessions",
  "tasks",
  "subtasks",
  "second_brain_notes",
  "second_brain_links",
  "skill_categories",
  "skill_documents",
  "vault_entries",
  "vault_repositories",
  "vault_environment_entries",
  "vault_sync_runs",
  "vault_github_connections",
  "agenda_event_metadata",
  "agenda_preferences",
  "agenda_meeting_topics",
  "google_tokens",
]);

function isSafeIdentifier(value: string) {
  return /^[a-z_][a-z0-9_]*$/i.test(value);
}

function quoteIdentifier(value: string) {
  if (!isSafeIdentifier(value)) {
    throw new Error(`Invalid identifier: ${value}`);
  }

  return `"${value}"`;
}

function getOwnershipClause(table: string, userId: string, values: unknown[]) {
  if (table === "profiles") {
    values.push(userId);
    return `t."id" = $${values.length}`;
  }

  if (table === "subtasks") {
    values.push(userId);
    return `EXISTS (SELECT 1 FROM "tasks" owner_task WHERE owner_task."id" = t."task_id" AND owner_task."user_id" = $${values.length})`;
  }

  values.push(userId);
  return `t."user_id" = $${values.length}`;
}

function buildWhereClause(table: string, userId: string, filters: LocalDbFilter[]) {
  const values: unknown[] = [];
  const clauses = [getOwnershipClause(table, userId, values)];

  for (const filter of filters) {
    const column = `t.${quoteIdentifier(filter.column)}`;

    if (filter.type === "eq") {
      values.push(filter.value);
      clauses.push(`${column} = $${values.length}`);
      continue;
    }

    if (filter.type === "lt") {
      values.push(filter.value);
      clauses.push(`${column} < $${values.length}`);
      continue;
    }

    if (filter.type === "lte") {
      values.push(filter.value);
      clauses.push(`${column} <= $${values.length}`);
      continue;
    }

    if (filter.type === "gte") {
      values.push(filter.value);
      clauses.push(`${column} >= $${values.length}`);
      continue;
    }

    if (filter.type === "is") {
      values.push(filter.value);
      clauses.push(`${column} IS NOT DISTINCT FROM $${values.length}`);
      continue;
    }

    if (filter.type === "in") {
      if (!filter.values.length) {
        clauses.push("1 = 0");
        continue;
      }

      const placeholders = filter.values.map((value) => {
        values.push(value);
        return `$${values.length}`;
      });

      clauses.push(`${column} IN (${placeholders.join(", ")})`);
      continue;
    }

    if (filter.type === "not") {
      if (filter.operator === "is") {
        clauses.push(filter.value === null ? `${column} IS NOT NULL` : `${column} IS DISTINCT FROM NULL`);
        continue;
      }

      values.push(filter.value);
      clauses.push(`NOT (${column} = $${values.length})`);
    }
  }

  return {
    clause: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

function buildOrderClause(order: Array<{ column: string; ascending: boolean }>) {
  if (!order.length) return "";

  return `ORDER BY ${order
    .map((item) => `t.${quoteIdentifier(item.column)} ${item.ascending ? "ASC" : "DESC"}`)
    .join(", ")}`;
}

function maybeProjectJoin(table: string, select: string | undefined) {
  if (!select?.includes("project:projects")) {
    return {
      join: "",
      projectSelect: "",
    };
  }

  if (!["time_sessions", "agenda_event_metadata"].includes(table)) {
    return {
      join: "",
      projectSelect: "",
    };
  }

  return {
    join: 'LEFT JOIN "projects" project_rel ON project_rel."id" = t."project_id"',
    projectSelect: ', to_jsonb(project_rel) AS "project"',
  };
}

function sanitizeRow(table: string, userId: string, row: Record<string, unknown>) {
  const next = { ...row };

  if (table === "profiles") {
    next.id = userId;
    return next;
  }

  if (table !== "subtasks") {
    next.user_id = userId;
  }

  if (table === "agenda_preferences") {
    next.user_id = userId;
  }

  return next;
}

async function assertSubtaskOwnership(row: Record<string, unknown>, userId: string) {
  const taskId = typeof row.task_id === "string" ? row.task_id : null;
  if (!taskId) {
    throw new Error("task_id is required");
  }

  const owned = await sql<{ id: string }[]>`
    SELECT id
    FROM tasks
    WHERE id = ${taskId} AND user_id = ${userId}
    LIMIT 1
  `;

  if (!owned[0]) {
    throw new Error("Unauthorized task reference");
  }
}

async function insertRows(table: string, rows: Array<Record<string, unknown>>, conflictColumns?: string[]) {
  const inserted: unknown[] = [];

  await sql.begin(async (tx) => {
    for (const row of rows) {
      const columns = Object.keys(row);
      const values = Object.values(row);
      const quotedColumns = columns.map(quoteIdentifier).join(", ");
      const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
      const base = `INSERT INTO ${quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders})`;
      const conflict = conflictColumns?.length
        ? ` ON CONFLICT (${conflictColumns.map(quoteIdentifier).join(", ")}) DO UPDATE SET ${columns
            .filter((column) => !conflictColumns.includes(column))
            .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
            .join(", ") || `${quoteIdentifier(conflictColumns[0])} = EXCLUDED.${quoteIdentifier(conflictColumns[0])}`}`
        : "";

      const result = await tx.unsafe(`${base}${conflict} RETURNING *`, values as any[]);
      inserted.push(result[0]);
    }
  });

  return inserted;
}

export async function executeLocalDbQuery(table: string, userId: string, payload: LocalDbPayload) {
  if (!LOCAL_DB_TABLES.has(table)) {
    throw new Error("Table not allowed");
  }

  await ensureDatabaseConnection();

  const filters = payload.filters || [];
  const order = payload.order || [];

  if (payload.action === "select") {
    const where = buildWhereClause(table, userId, filters);
    const orderClause = buildOrderClause(order);
    const project = maybeProjectJoin(table, payload.select);
    const limitClause = payload.limit ? `LIMIT ${Number(payload.limit)}` : "";

    return sql.unsafe(
      `SELECT t.*${project.projectSelect} FROM ${quoteIdentifier(table)} t ${project.join} ${where.clause} ${orderClause} ${limitClause}`,
      where.values as any[],
    );
  }

  if (payload.action === "insert" || payload.action === "upsert") {
    const rawRows = Array.isArray(payload.values) ? payload.values : payload.values ? [payload.values] : [];
    const rows = rawRows.map((row) => sanitizeRow(table, userId, row));

    if (table === "subtasks") {
      for (const row of rows) {
        await assertSubtaskOwnership(row, userId);
      }
    }

    const conflictColumns = payload.action === "upsert" && payload.onConflict
      ? payload.onConflict.split(",").map((item) => item.trim()).filter(Boolean)
      : undefined;

    return insertRows(table, rows, conflictColumns);
  }

  if (payload.action === "update") {
    const values = payload.values && !Array.isArray(payload.values) ? { ...payload.values } : null;
    if (!values) {
      throw new Error("Missing update payload");
    }

    delete values.user_id;
    delete values.id;

    if (table === "subtasks" && typeof values.task_id === "string") {
      await assertSubtaskOwnership(values, userId);
    }

    const columns = Object.keys(values);
    if (!columns.length) {
      return [];
    }

    const setValues = Object.values(values);
    const assignments = columns.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`);
    const where = buildWhereClause(table, userId, filters);

    return sql.unsafe(
      `UPDATE ${quoteIdentifier(table)} SET ${assignments.join(", ")} ${where.clause.replaceAll("t.", "")} RETURNING *`,
      [...setValues, ...where.values] as any[],
    );
  }

  if (payload.action === "delete") {
    const where = buildWhereClause(table, userId, filters);
    return sql.unsafe(
      `DELETE FROM ${quoteIdentifier(table)} ${where.clause.replaceAll("t.", "")} RETURNING *`,
      where.values as any[],
    );
  }

  throw new Error("Unsupported action");
}
