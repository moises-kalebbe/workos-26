export interface CUStatus {
  status: string;
  color: string;
  type: string;
  orderindex: number;
}

export interface CUPriority {
  id: string;
  priority: string;
  color: string;
  orderindex: string;
}

export interface CUMember {
  id: number;
  username: string;
  email: string;
  profilePicture: string | null;
  color: string;
}

export interface CUTag {
  name: string;
  tag_fg: string;
  tag_bg: string;
}

export interface CUTask {
  id: string;
  name: string;
  description?: string;
  status: CUStatus;
  priority: CUPriority | null;
  due_date: string | null;
  assignees: CUMember[];
  tags: CUTag[];
  subtasks_count: number;
  list: { id: string; name: string };
  url: string;
  date_created: string;
  date_updated: string;
  orderindex: string;
}

export interface CUView {
  id: string;
  name: string;
  type: string;
  parent: {
    id: string;
    type: number;
  };
  grouping?: {
    field: string;
    dir: number;
    collapsed: string[];
    ignore: boolean;
  };
  list?: {
    id: string;
    name: string;
    statuses: CUStatus[];
  };
}

export interface CUTasksResponse {
  tasks: CUTask[];
}

export interface CUViewResponse {
  view: CUView;
}

export interface CUSpaceViewsResponse {
  views: CUView[];
}

export interface CUListResponse {
  id: string;
  name: string;
  statuses: CUStatus[];
}

export type CUTaskUpdate = {
  name?: string;
  description?: string;
  status?: string;
  priority?: number | null;
  due_date?: number | null;
  assignees?: { add?: number[]; rem?: number[] };
};

export type CUTaskCreate = {
  name: string;
  description?: string;
  status?: string;
  priority?: number;
  due_date?: number;
  assignees?: number[];
};
