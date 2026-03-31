import { sql } from "./db";
import type { Project, TimeSession, Task, Profile } from "@/types";

export const db = {
  async getProjects(userId: string): Promise<Project[]> {
    const result = await sql`
      SELECT * FROM projects 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    return result as unknown as Project[];
  },

  async getProject(userId: string, projectId: string): Promise<Project | null> {
    const [result] = await sql`
      SELECT * FROM projects 
      WHERE id = ${projectId} AND user_id = ${userId}
    `;
    return result as unknown as Project | null;
  },

  async createProject(data: {
    userId: string;
    name: string;
    client?: string;
    hourlyRate: number;
    color: string;
  }): Promise<Project> {
    const [result] = await sql`
      INSERT INTO projects (user_id, name, client, hourly_rate, color)
      VALUES (${data.userId}, ${data.name}, ${data.client || null}, ${data.hourlyRate}, ${data.color})
      RETURNING *
    `;
    return result as unknown as Project;
  },

  async updateProject(data: {
    id: string;
    userId: string;
    name: string;
    client?: string;
    hourlyRate: number;
    color: string;
  }): Promise<void> {
    await sql`
      UPDATE projects 
      SET name = ${data.name}, 
          client = ${data.client || null}, 
          hourly_rate = ${data.hourlyRate}, 
          color = ${data.color}
      WHERE id = ${data.id} AND user_id = ${data.userId}
    `;
  },

  async deleteProject(projectId: string, userId: string): Promise<void> {
    await sql`DELETE FROM projects WHERE id = ${projectId} AND user_id = ${userId}`;
  },

  async getSessions(userId: string): Promise<TimeSession[]> {
    const result = await sql`
      SELECT ts.*, p.name as project_name, p.client as project_client, p.hourly_rate, p.color
      FROM time_sessions ts
      LEFT JOIN projects p ON ts.project_id = p.id
      WHERE ts.user_id = ${userId} AND ts.ended_at IS NOT NULL
      ORDER BY ts.started_at DESC
    `;
    return result as unknown as TimeSession[];
  },

  async getActiveSession(userId: string): Promise<TimeSession | null> {
    const [result] = await sql`
      SELECT * FROM time_sessions 
      WHERE user_id = ${userId} AND ended_at IS NULL 
      ORDER BY started_at DESC LIMIT 1
    `;
    return result as unknown as TimeSession | null;
  },

  async startSession(projectId: string, userId: string): Promise<TimeSession> {
    const [result] = await sql`
      INSERT INTO time_sessions (project_id, user_id, started_at)
      VALUES (${projectId}, ${userId}, NOW())
      RETURNING *
    `;
    return result as unknown as TimeSession;
  },

  async stopSession(sessionId: string): Promise<TimeSession> {
    const [result] = await sql`
      UPDATE time_sessions 
      SET ended_at = NOW()
      WHERE id = ${sessionId}
      RETURNING *
    `;
    
    if (result.ended_at && result.started_at) {
      const startedAt = new Date(result.started_at);
      const endedAt = new Date(result.ended_at);
      const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
      
      await sql`
        UPDATE time_sessions 
        SET duration_seconds = ${durationSeconds}
        WHERE id = ${sessionId}
      `;
    }
    
    return result as unknown as TimeSession;
  },

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    await sql`DELETE FROM time_sessions WHERE id = ${sessionId} AND user_id = ${userId}`;
  },

  async getTasks(userId: string, columnIndex?: number): Promise<Task[]> {
    if (columnIndex !== undefined) {
      const result = await sql`
        SELECT t.*, p.name as project_name, p.color as project_color
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.user_id = ${userId} AND t.column_index = ${columnIndex}
        ORDER BY t.position ASC
      `;
      return result as unknown as Task[];
    }
    
    const result = await sql`
      SELECT t.*, p.name as project_name, p.color as project_color
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.user_id = ${userId}
      ORDER BY t.column_index ASC, t.position ASC
    `;
    return result as unknown as Task[];
  },

  async createTask(data: {
    userId: string;
    projectId?: string;
    title: string;
    columnIndex: number;
    priority?: string;
    position?: number;
    client?: string;
    dueDate?: string;
  }): Promise<Task> {
    const [result] = await sql`
      INSERT INTO tasks (user_id, project_id, title, column_index, priority, position, client, due_date)
      VALUES (
        ${data.userId}, 
        ${data.projectId || null}, 
        ${data.title}, 
        ${data.columnIndex}, 
        ${data.priority || 'normal'}, 
        ${data.position || 0}, 
        ${data.client || null}, 
        ${data.dueDate || null}
      )
      RETURNING *
    `;
    return result as unknown as Task;
  },

  async updateTask(data: {
    id: string;
    userId: string;
    title?: string;
    columnIndex?: number;
    priority?: string;
    position?: number;
    dueDate?: string;
  }): Promise<void> {
    const title = data.title ?? sql`title`;
    const columnIndex = data.columnIndex ?? sql`column_index`;
    const priority = data.priority ?? sql`priority`;
    const position = data.position ?? sql`position`;
    const dueDate = data.dueDate ?? sql`due_date`;

    await sql`
      UPDATE tasks SET
        title = ${title},
        column_index = ${columnIndex},
        priority = ${priority},
        position = ${position},
        due_date = ${dueDate}
      WHERE id = ${data.id} AND user_id = ${data.userId}
    `;
  },

  async deleteTask(taskId: string, userId: string): Promise<void> {
    await sql`DELETE FROM tasks WHERE id = ${taskId} AND user_id = ${userId}`;
  },

  async getProfile(userId: string): Promise<Profile | null> {
    const [result] = await sql`
      SELECT * FROM profiles WHERE id = ${userId}
    `;
    return result as unknown as Profile | null;
  },

  async upsertProfile(userId: string, data: { email?: string; name?: string; timezone?: string }): Promise<void> {
    const email = data.email ?? sql`email`;
    const name = data.name ?? sql`name`;
    const timezone = data.timezone ?? 'America/Sao_Paulo';

    await sql`
      INSERT INTO profiles (id, email, name, timezone)
      VALUES (${userId}, ${email}, ${name}, ${timezone})
      ON CONFLICT (id) DO UPDATE SET
        email = COALESCE(${email}, profiles.email),
        name = COALESCE(${name}, profiles.name),
        timezone = COALESCE(${timezone}, profiles.timezone),
        updated_at = NOW()
    `;
  },
};
