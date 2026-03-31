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

if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 20,
  transform: postgres.camel,
});

const expectedTables = {
  profiles: ["id", "email", "name", "avatar_url", "plan", "timezone", "created_at", "updated_at"],
  projects: ["id", "user_id", "name", "client", "hourly_rate", "color", "status", "monthly_agreed_amount", "monthly_agreed_hours", "daily_agreed_hours", "workdays", "daily_rate", "created_at", "updated_at"],
  time_sessions: ["id", "project_id", "user_id", "started_at", "ended_at", "duration_seconds", "notes", "created_at"],
  tasks: ["id", "user_id", "project_id", "skill_document_id", "title", "description", "column_index", "priority", "urgency", "importance", "position", "client", "due_date", "completed_at", "created_at", "updated_at"],
  subtasks: ["id", "task_id", "title", "completed", "position", "created_at"],
  google_tokens: ["id", "user_id", "access_token", "refresh_token", "expires_at", "created_at", "updated_at"],
  agenda_event_metadata: ["id", "user_id", "series_key", "priority", "tags", "project_id", "created_at", "updated_at"],
  agenda_preferences: ["user_id", "sort_mode", "status_filter", "priority_filter", "tag_filter", "show_declined", "updated_at"],
  second_brain_notes: ["id", "user_id", "project_id", "title", "slug", "content_md", "source_url", "source_type", "source_metadata", "tags", "status", "captured_at", "created_at", "updated_at"],
  second_brain_links: ["id", "user_id", "source_note_id", "target_note_id", "link_type", "created_at"],
  skill_categories: ["id", "user_id", "name", "slug", "description", "created_at", "updated_at"],
  skill_documents: ["id", "user_id", "category_id", "project_id", "title", "slug", "summary", "content_md", "source_type", "created_at", "updated_at", "last_downloaded_at"],
  vault_entries: ["id", "user_id", "project_id", "client", "service", "url", "username", "encrypted_password", "iv", "notes", "created_at", "updated_at"],
  vault_repositories: ["id", "user_id", "project_id", "local_path", "remote_url", "repo_name", "owner_name", "provider", "default_branch", "detected_environment_count", "last_scanned_at", "last_scan_status", "notes", "created_at", "updated_at", "source_type", "external_id", "html_url", "is_remote_only"],
  vault_environment_entries: ["id", "user_id", "project_id", "repository_id", "env_key", "env_scope", "source_path", "encrypted_value", "iv", "detected_provider", "created_at", "updated_at"],
  vault_sync_runs: ["id", "user_id", "project_id", "repository_id", "run_type", "status", "summary", "details", "created_at"],
  vault_github_connections: ["id", "user_id", "display_name", "encrypted_token", "iv", "github_user_id", "github_login", "github_name", "avatar_url", "scopes", "is_active", "last_synced_at", "last_sync_status", "created_at", "updated_at"],
};

async function fetchColumns(table) {
  return sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position
  `;
}

async function fetchTriggers(table) {
  return sql`
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = 'public' AND event_object_table = ${table}
    ORDER BY trigger_name
  `;
}

async function fetchIndexes(table) {
  return sql`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ${table}
    ORDER BY indexname
  `;
}

async function fetchRowCount(table) {
  const rows = await sql.unsafe(`SELECT COUNT(*)::bigint AS count FROM "${table}"`);
  return Number(rows[0]?.count || 0);
}

async function main() {
  const report = [];

  for (const [table, expectedColumns] of Object.entries(expectedTables)) {
    const columns = await fetchColumns(table);
    const actualColumns = columns.map((row) => row.columnName);
    const missingColumns = expectedColumns.filter((column) => !actualColumns.includes(column));
    const extraColumns = actualColumns.filter((column) => !expectedColumns.includes(column));
    const triggers = (await fetchTriggers(table)).map((row) => row.triggerName);
    const indexes = (await fetchIndexes(table)).map((row) => row.indexname);
    const rowCount = await fetchRowCount(table).catch(() => -1);

    report.push({
      table,
      exists: actualColumns.length > 0,
      rowCount,
      missingColumns,
      extraColumns,
      triggerCount: triggers.length,
      indexCount: indexes.length,
      triggers,
      indexes,
    });
  }

  const missingTables = report.filter((item) => !item.exists).map((item) => item.table);
  const mismatchedTables = report.filter(
    (item) => item.exists && (item.missingColumns.length > 0 || item.extraColumns.length > 0),
  );

  console.log(JSON.stringify({ missingTables, mismatchedTables, report }, null, 2));
}

main()
  .catch((error) => {
    console.error("Schema audit failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
