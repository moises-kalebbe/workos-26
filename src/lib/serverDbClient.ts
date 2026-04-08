import { executeLocalDbQuery, type LocalDbFilter, type LocalDbPayload } from "@/lib/localDbGateway";

export function createServerDbClient(userId: string | null = null) {
  let authUserId = userId;

  function isMutationAction(action: LocalDbPayload["action"]) {
    return action === "insert" || action === "update" || action === "delete" || action === "upsert";
  }

  function isReadOnlyTable(table: string) {
    return table === "daily_reflection_prompts";
  }

  class ServerQueryBuilder<T> implements PromiseLike<{ data: T | null; error: { message: string } | null }> {
    private readonly filters: LocalDbFilter[] = [];
    private readonly orderBy: Array<{ column: string; ascending: boolean }> = [];
    private action: LocalDbPayload["action"] = "select";
    private selectClause = "*";
    private values: unknown;
    private onConflict?: string;
    private rowMode: "many" | "single" | "maybeSingle" = "many";
    private limitValue?: number;

    constructor(private readonly table: string) {}

    select(columns = "*") {
      this.selectClause = columns;
      if (!isMutationAction(this.action)) {
        this.action = "select";
      }
      return this;
    }

    insert(values: unknown) {
      this.action = "insert";
      this.values = values;
      return this;
    }

    update(values: unknown) {
      this.action = "update";
      this.values = values;
      return this;
    }

    delete() {
      this.action = "delete";
      return this;
    }

    upsert(values: unknown, options?: { onConflict?: string }) {
      this.action = "upsert";
      this.values = values;
      this.onConflict = options?.onConflict;
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ type: "eq", column, value });
      return this;
    }

    in(column: string, values: unknown[]) {
      this.filters.push({ type: "in", column, values });
      return this;
    }

    lt(column: string, value: unknown) {
      this.filters.push({ type: "lt", column, value });
      return this;
    }

    lte(column: string, value: unknown) {
      this.filters.push({ type: "lte", column, value });
      return this;
    }

    gte(column: string, value: unknown) {
      this.filters.push({ type: "gte", column, value });
      return this;
    }

    is(column: string, value: unknown) {
      this.filters.push({ type: "is", column, value });
      return this;
    }

    not(column: string, operator: string, value: unknown) {
      this.filters.push({ type: "not", column, operator, value });
      return this;
    }

    order(column: string, options?: { ascending?: boolean }) {
      this.orderBy.push({ column, ascending: options?.ascending !== false });
      return this;
    }

    limit(value: number) {
      this.limitValue = value;
      return this;
    }

    single() {
      this.rowMode = "single";
      return this;
    }

    maybeSingle() {
      this.rowMode = "maybeSingle";
      return this;
    }

    private async execute() {
      if (!authUserId) {
        return { data: null, error: { message: "Unauthorized" } };
      }

      if (isMutationAction(this.action) && isReadOnlyTable(this.table)) {
        return {
          data: null,
          error: { message: "Prompt catalog is read-only" },
        };
      }

      try {
        const raw = await executeLocalDbQuery(this.table, authUserId, {
          action: this.action,
          select: this.selectClause,
          filters: this.filters,
          order: this.orderBy,
          limit: this.limitValue,
          values: this.values as any,
          onConflict: this.onConflict,
        });

        if (this.rowMode === "many") {
          return { data: raw as T, error: null };
        }

        const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];

        if (this.rowMode === "maybeSingle") {
          return { data: (rows[0] ?? null) as T | null, error: null };
        }

        if (!rows[0]) {
          return { data: null, error: { message: "Row not found" } };
        }

        return { data: rows[0] as T, error: null };
      } catch (error) {
        return {
          data: null,
          error: { message: error instanceof Error ? error.message : "Internal error" },
        };
      }
    }

    then<TResult1 = { data: T | null; error: { message: string } | null }, TResult2 = never>(
      onfulfilled?: ((value: { data: T | null; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return this.execute().then(onfulfilled, onrejected);
    }
  }

  return {
    setAuthUser(nextUserId: string) {
      authUserId = nextUserId;
    },
    from<T = any>(table: string) {
      return new ServerQueryBuilder<T>(table);
    },
  };
}
