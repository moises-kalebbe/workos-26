#!/usr/bin/env node

import postgres from "postgres";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://workos-user:workos_secure_password_2026@workos-postgres:5432/workos-db";
const OLD_USER_ID = process.env.OLD_USER_ID || "e5670cb0-69eb-4e8c-a170-bac28fa0a7cc";
const MIGRATION_USER_ID = process.env.MIGRATION_USER_ID;

if (!MIGRATION_USER_ID) {
  console.error("Missing MIGRATION_USER_ID environment variable");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  idle_timeout: 20,
  transform: postgres.camel,
});

const tableConfigs = [
  {
    table: "profiles",
    file: "profiles",
    conflict: ["id"],
    transform(record) {
      return {
        ...record,
        id: MIGRATION_USER_ID,
      };
    },
  },
  {
    table: "projects",
    file: "projects",
    conflict: ["id"],
  },
  {
    table: "skill_categories",
    file: "skill_categories",
    conflict: ["id"],
  },
  {
    table: "skill_documents",
    file: "skill_documents",
    conflict: ["id"],
  },
  {
    table: "tasks",
    file: "tasks",
    conflict: ["id"],
    transform(record) {
      return {
        ...record,
        urgency: normalizeUrgency(record.urgency),
        importance: normalizeImportance(record.importance),
      };
    },
  },
  {
    table: "subtasks",
    file: "subtasks",
    conflict: ["id"],
    filter: (record, state) => state.taskIds.has(record.task_id),
  },
  {
    table: "time_sessions",
    file: "time_sessions",
    conflict: ["id"],
    filter: (record, state) => state.projectIds.has(record.project_id),
  },
  {
    table: "second_brain_notes",
    file: "second_brain_notes",
    conflict: ["id"],
  },
  {
    table: "second_brain_links",
    file: "second_brain_links",
    conflict: ["id"],
    filter: (record, state) => state.noteIds.has(record.source_note_id) && state.noteIds.has(record.target_note_id),
  },
  {
    table: "vault_repositories",
    file: "vault_repositories",
    conflict: ["id"],
  },
  {
    table: "vault_entries",
    file: "vault_entries",
    conflict: ["id"],
  },
  {
    table: "vault_environment_entries",
    file: "vault_environment_entries",
    conflict: ["id"],
    filter: (record, state) => !record.repository_id || state.repositoryIds.has(record.repository_id),
  },
  {
    table: "vault_sync_runs",
    file: "vault_sync_runs",
    conflict: ["id"],
    transform(record) {
      return {
        ...record,
        run_type: record.run_type === "keepalive" ? "env_scan" : record.run_type,
      };
    },
    filter: (record, state) =>
      (!record.repository_id || state.repositoryIds.has(record.repository_id)) &&
      (!record.project_id || state.projectIds.has(record.project_id)),
  },
  {
    table: "agenda_preferences",
    file: "agenda_preferences",
    conflict: ["user_id"],
  },
  {
    table: "agenda_event_metadata",
    file: "agenda_event_metadata",
    conflict: ["id"],
  },
  {
    table: "google_tokens",
    file: "google_tokens",
    conflict: ["id"],
  },
];

function normalizeUrgency(value) {
  if (value === "urgent" || value === "not_urgent") {
    return value;
  }
  return value === "urgent" ? "urgent" : "not_urgent";
}

function normalizeImportance(value) {
  if (value === "important" || value === "not_important") {
    return value;
  }
  return value === "not_important" ? "not_important" : "important";
}

function loadJsonFile(fileName) {
  const filePath = join(__dirname, "data-export", `${fileName}.json`);
  if (!existsSync(filePath)) {
    return [];
  }

  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  return Array.isArray(raw) ? raw : [];
}

function remapUser(record) {
  const next = { ...record };

  if (Object.hasOwn(next, "user_id") && next.user_id === OLD_USER_ID) {
    next.user_id = MIGRATION_USER_ID;
  }

  return next;
}

async function insertRow(table, record, conflictColumns) {
  const allowedColumns = await getTableColumns(table);
  const filteredRecord = Object.fromEntries(
    Object.entries(record).filter(([column]) => allowedColumns.has(column)),
  );

  const columns = Object.keys(filteredRecord);
  if (columns.length === 0) {
    return false;
  }

  const values = Object.values(filteredRecord);
  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
  const conflict = conflictColumns.map((column) => `"${column}"`).join(", ");
  const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
  const updateClause = updateColumns.length
    ? updateColumns.map((column) => `"${column}" = EXCLUDED."${column}"`).join(", ")
    : `${conflictColumns[0]} = EXCLUDED.${conflictColumns[0]}`;

  await sql.unsafe(
    `INSERT INTO "${table}" (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT (${conflict}) DO UPDATE SET ${updateClause}`,
    values,
  );

  return true;
}

const tableColumnsCache = new Map();

async function getTableColumns(table) {
  if (tableColumnsCache.has(table)) {
    return tableColumnsCache.get(table);
  }

  const result = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
  `;

  const columns = new Set(result.map((row) => row.columnName));
  tableColumnsCache.set(table, columns);
  return columns;
}

async function clearUserData() {
  const userTables = [
    "vault_sync_runs",
    "vault_environment_entries",
    "vault_github_connections",
    "vault_repositories",
    "vault_entries",
    "second_brain_links",
    "second_brain_notes",
    "skill_documents",
    "skill_categories",
    "agenda_event_metadata",
    "agenda_preferences",
    "google_tokens",
    "subtasks",
    "tasks",
    "time_sessions",
    "projects",
    "profiles",
  ];

  for (const table of userTables) {
    if (table === "profiles") {
      await sql`DELETE FROM profiles WHERE id = ${MIGRATION_USER_ID}`;
      continue;
    }

    if (table === "subtasks") {
      await sql`DELETE FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE user_id = ${MIGRATION_USER_ID})`;
      continue;
    }

    if (table === "second_brain_links") {
      await sql`DELETE FROM second_brain_links WHERE user_id = ${MIGRATION_USER_ID}`;
      continue;
    }

    await sql.unsafe(`DELETE FROM "${table}" WHERE user_id = $1`, [MIGRATION_USER_ID]);
  }
}

async function migrate() {
  const state = {
    projectIds: new Set(),
    taskIds: new Set(),
    noteIds: new Set(),
    repositoryIds: new Set(),
  };

  try {
    console.log("WorkOS 26 - Data Migration");
    console.log(`Database: ${DATABASE_URL.split("@")[1] || DATABASE_URL}`);
    console.log(`Old user: ${OLD_USER_ID}`);
    console.log(`New user: ${MIGRATION_USER_ID}`);
    console.log("");

    await sql`SELECT 1`;
    await clearUserData();

    let totalInserted = 0;

    for (const config of tableConfigs) {
      const sourceRows = loadJsonFile(config.file);
      if (sourceRows.length === 0) {
        console.log(`- ${config.table}: no source data`);
        continue;
      }

      let inserted = 0;
      let skipped = 0;

      for (const sourceRow of sourceRows) {
        if (Object.hasOwn(sourceRow, "user_id") && sourceRow.user_id !== OLD_USER_ID) {
          skipped += 1;
          continue;
        }

        let row = remapUser(sourceRow);
        if (config.transform) {
          row = config.transform(row);
        }

        if (config.filter && !config.filter(row, state)) {
          skipped += 1;
          continue;
        }

        const didInsert = await insertRow(config.table, row, config.conflict);
        if (!didInsert) {
          skipped += 1;
          continue;
        }

        inserted += 1;

        if (config.table === "projects") state.projectIds.add(row.id);
        if (config.table === "tasks") state.taskIds.add(row.id);
        if (config.table === "second_brain_notes") state.noteIds.add(row.id);
        if (config.table === "vault_repositories") state.repositoryIds.add(row.id);
      }

      totalInserted += inserted;
      console.log(`- ${config.table}: inserted ${inserted}, skipped ${skipped}`);
    }

    console.log("");
    console.log(`Done. Inserted ${totalInserted} records.`);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

await migrate();
