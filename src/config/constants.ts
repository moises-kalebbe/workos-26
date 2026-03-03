export const GENERAL_PROJECT_VALUE = "__general__";

export function projectSelectValue(projectId: string | null) {
  return projectId ?? GENERAL_PROJECT_VALUE;
}

export function projectIdFromSelectValue(value: string) {
  return value === GENERAL_PROJECT_VALUE ? null : value;
}

