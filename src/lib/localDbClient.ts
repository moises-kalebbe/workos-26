import { getClerkToken, getClerkUserId } from "@/lib/clerkBridge";

const DEV_AUTH_USER_ID = process.env.NEXT_PUBLIC_DEV_AUTH_USER_ID || null;

type Filter =
  | { type: "eq"; column: string; value: unknown }
  | { type: "in"; column: string; values: unknown[] }
  | { type: "lt"; column: string; value: unknown }
  | { type: "lte"; column: string; value: unknown }
  | { type: "gte"; column: string; value: unknown }
  | { type: "is"; column: string; value: unknown }
  | { type: "not"; column: string; operator: string; value: unknown };

type Order = {
  column: string;
  ascending: boolean;
};

type QueryAction = "select" | "insert" | "update" | "delete" | "upsert";

type QueryPayload = {
  action: QueryAction;
  select?: string;
  filters: Filter[];
  order: Order[];
  limit?: number;
  values?: unknown;
  onConflict?: string;
};

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

function isMutationAction(action: QueryAction) {
  return action === "insert" || action === "update" || action === "delete" || action === "upsert";
}

async function waitForClerkSession() {
  if (DEV_AUTH_USER_ID) {
    return {
      userId: DEV_AUTH_USER_ID,
      token: null,
    };
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const userId = getClerkUserId();
    const token = await getClerkToken();

    if (userId && token) {
      return { userId, token };
    }

    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  return {
    userId: getClerkUserId(),
    token: await getClerkToken(),
  };
}

class LocalQueryBuilder<T> implements PromiseLike<QueryResult<T>> {
  private readonly filters: Filter[] = [];
  private readonly orderBy: Order[] = [];
  private action: QueryAction = "select";
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
    this.values = undefined;
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

  private async execute(): Promise<QueryResult<T>> {
    const { token } = await waitForClerkSession();

    const payload: QueryPayload = {
      action: this.action,
      select: this.selectClause,
      filters: this.filters,
      order: this.orderBy,
      limit: this.limitValue,
      values: this.values,
      onConflict: this.onConflict,
    };

    const response = await fetch(`/api/db/${this.table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => ({}))) as {
      data?: unknown;
      error?: string;
    };

    if (!response.ok) {
      const baseMessage = json.error || "Request failed";
      return {
        data: null,
        error: { message: `${baseMessage} (${response.status})` },
      };
    }

    const rawData = json.data;

    if (this.rowMode === "many") {
      return { data: (rawData ?? null) as T, error: null };
    }

    const rows = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];

    if (this.rowMode === "maybeSingle") {
      return { data: ((rows[0] ?? null) as T) ?? null, error: null };
    }

    if (!rows[0]) {
      return { data: null, error: { message: "Row not found" } };
    }

    return { data: rows[0] as T, error: null };
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

type SessionLike = {
  access_token: string;
  user: {
    id: string;
  };
  provider_token: null;
  provider_refresh_token: null;
  expires_at: null;
};

export const localDbClient = {
  from<T = any>(table: string) {
    return new LocalQueryBuilder<T>(table);
  },
  auth: {
    async getSession() {
      const token = await getClerkToken();
      const userId = getClerkUserId();

      const session: SessionLike | null = token && userId
        ? {
            access_token: token,
            user: { id: userId },
            provider_token: null,
            provider_refresh_token: null,
            expires_at: null,
          }
        : null;

      return {
        data: { session },
        error: null,
      };
    },
    async signInWithOAuth() {
      return {
        data: null,
        error: {
          message: "OAuth legado nao esta disponivel apos a migracao para Clerk.",
        },
      };
    },
    async getUser() {
      if (DEV_AUTH_USER_ID) {
        return {
          data: {
            user: { id: DEV_AUTH_USER_ID },
          },
          error: null,
        };
      }

      const userId = getClerkUserId();
      return {
        data: {
          user: userId ? { id: userId } : null,
        },
        error: null,
      };
    },
  },
};
