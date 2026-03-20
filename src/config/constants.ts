export const GENERAL_PROJECT_VALUE = "__general__";
export const GENERAL_PROJECT_LABEL = "Moisés Kalebbe";
export const GENERAL_PROJECT_DESCRIPTION = "Projetos pessoais do Moisés Kalebbe";

export function projectSelectValue(projectId: string | null) {
  return projectId ?? GENERAL_PROJECT_VALUE;
}

export function projectIdFromSelectValue(value: string) {
  return value === GENERAL_PROJECT_VALUE ? null : value;
}

