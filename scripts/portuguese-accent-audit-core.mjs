import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export const DEFAULT_SCAN_DIRECTORIES = ["app", "src"];
export const DEFAULT_FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mdx"]);

const TOKEN_REPLACEMENTS = Object.freeze({
  acao: "ação",
  acoes: "ações",
  analise: "análise",
  analises: "análises",
  aprovacao: "aprovação",
  aprovacoes: "aprovações",
  area: "área",
  areas: "áreas",
  ate: "até",
  atraves: "através",
  autenticacao: "autenticação",
  autorizacao: "autorização",
  autorizacoes: "autorizações",
  avaliacao: "avaliação",
  avaliacoes: "avaliações",
  basica: "básica",
  basicas: "básicas",
  basico: "básico",
  basicos: "básicos",
  botao: "botão",
  botoes: "botões",
  calendario: "calendário",
  colecao: "coleção",
  colecoes: "coleções",
  configuracao: "configuração",
  configuracoes: "configurações",
  conexao: "conexão",
  conexoes: "conexões",
  confirmacao: "confirmação",
  confirmacoes: "confirmações",
  conclusao: "conclusão",
  conclusoes: "conclusões",
  codigo: "código",
  codigos: "códigos",
  conteudo: "conteúdo",
  conteudos: "conteúdos",
  criacao: "criação",
  criacoes: "criações",
  credito: "crédito",
  creditos: "créditos",
  criterio: "critério",
  criterios: "critérios",
  definicao: "definição",
  definicoes: "definições",
  dependencia: "dependência",
  dependencias: "dependências",
  demonstracao: "demonstração",
  demonstracoes: "demonstrações",
  descricao: "descrição",
  descricoes: "descrições",
  diagnostico: "diagnóstico",
  diagnosticos: "diagnósticos",
  diario: "diário",
  diarios: "diários",
  diaria: "diária",
  diarias: "diárias",
  diretorio: "diretório",
  diretorios: "diretórios",
  disponivel: "disponível",
  edicao: "edição",
  edicoes: "edições",
  especificacao: "especificação",
  especificacoes: "especificações",
  estao: "estão",
  execucao: "execução",
  execucoes: "execuções",
  exclusao: "exclusão",
  exclusoes: "exclusões",
  expressao: "expressão",
  expressoes: "expressões",
  evolucao: "evolução",
  extensao: "extensão",
  extensoes: "extensões",
  formulario: "formulário",
  formularios: "formulários",
  frequencia: "frequência",
  funcao: "função",
  funcoes: "funções",
  grafico: "gráfico",
  graficos: "gráficos",
  historico: "histórico",
  historicos: "históricos",
  horario: "horário",
  horarios: "horários",
  informacao: "informação",
  informacoes: "informações",
  integracao: "integração",
  integracoes: "integrações",
  introducao: "introdução",
  introducoes: "introduções",
  ja: "já",
  localizacao: "localização",
  localizacoes: "localizações",
  manutencao: "manutenção",
  logica: "lógica",
  media: "média",
  medias: "médias",
  metrica: "métrica",
  metricas: "métricas",
  migracao: "migração",
  minimo: "mínimo",
  minima: "mínima",
  minimos: "mínimos",
  minimas: "mínimas",
  modulo: "módulo",
  modulos: "módulos",
  nao: "não",
  necessaria: "necessária",
  necessarias: "necessárias",
  necessario: "necessário",
  necessarios: "necessários",
  negocio: "negócio",
  negocios: "negócios",
  numero: "número",
  numeros: "números",
  obrigatoria: "obrigatória",
  obrigatorias: "obrigatórias",
  obrigatorio: "obrigatório",
  obrigatorios: "obrigatórios",
  observacao: "observação",
  observacoes: "observações",
  opcao: "opção",
  opcoes: "opções",
  pagina: "página",
  paginas: "páginas",
  padrao: "padrão",
  padroes: "padrões",
  painel: "painel",
  paineis: "painéis",
  pendencia: "pendência",
  pendencias: "pendências",
  periodo: "período",
  periodos: "períodos",
  permissao: "permissão",
  permissoes: "permissões",
  possivel: "possível",
  pratica: "prática",
  praticas: "práticas",
  pratico: "prático",
  praticos: "práticos",
  previsao: "previsão",
  previsoes: "previsões",
  projecao: "projeção",
  projecoes: "projeções",
  proxima: "próxima",
  proximas: "próximas",
  proximo: "próximo",
  proximos: "próximos",
  publico: "público",
  publicos: "públicos",
  publica: "pública",
  publicas: "públicas",
  rapida: "rápida",
  rapidas: "rápidas",
  rapido: "rápido",
  rapidos: "rápidos",
  referencia: "referência",
  referencias: "referências",
  relatorio: "relatório",
  relatorios: "relatórios",
  requisicao: "requisição",
  requisicoes: "requisições",
  responsavel: "responsável",
  responsaveis: "responsáveis",
  reuniao: "reunião",
  reunioes: "reuniões",
  reutilizacao: "reutilização",
  reutilizacoes: "reutilizações",
  reutilizavel: "reutilizável",
  reutilizaveis: "reutilizáveis",
  revisao: "revisão",
  revisoes: "revisões",
  secao: "seção",
  secoes: "seções",
  selecao: "seleção",
  selecoes: "seleções",
  sequencia: "sequência",
  sequencias: "sequências",
  sessao: "sessão",
  sessoes: "sessões",
  so: "só",
  solucao: "solução",
  solucoes: "soluções",
  tecnica: "técnica",
  tecnicas: "técnicas",
  tecnico: "técnico",
  tecnicos: "técnicos",
  titulo: "título",
  titulos: "títulos",
  transacao: "transação",
  transacoes: "transações",
  usuario: "usuário",
  usuarios: "usuários",
  validacao: "validação",
  validacoes: "validações",
  variacao: "variação",
  variacoes: "variações",
  video: "vídeo",
  videos: "vídeos",
  videoconferencia: "videoconferência",
  vinculo: "vínculo",
  vinculos: "vínculos",
  visao: "visão",
  visoes: "visões",
  visivel: "visível",
  visiveis: "visíveis",
  voce: "você",
  voces: "vocês",
});

const TOKEN_REGEX = new RegExp(
  `(?<![A-Za-z])(${Object.keys(TOKEN_REPLACEMENTS).sort((left, right) => right.length - left.length).join("|")})(?![A-Za-z])`,
  "giu",
);

const NON_UI_PROPERTY_NAMES = new Set([
  "aria-controls",
  "aria-describedby",
  "aria-labelledby",
  "className",
  "classes",
  "component",
  "field",
  "fields",
  "href",
  "icon",
  "icons",
  "id",
  "ids",
  "key",
  "keys",
  "name",
  "names",
  "path",
  "paths",
  "role",
  "route",
  "routes",
  "size",
  "sizes",
  "slug",
  "slugs",
  "src",
  "step",
  "steps",
  "testId",
  "to",
  "type",
  "types",
  "url",
  "urls",
  "value",
  "values",
  "variant",
  "variants",
]);

const UI_ATTRIBUTE_NAMES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "caption",
  "description",
  "emptyMessage",
  "error",
  "helperText",
  "label",
  "message",
  "placeholder",
  "subtitle",
  "summary",
  "text",
  "title",
]);

const SKIPPED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
  "test",
  "test-results",
  "__tests__",
]);

function getScriptKind(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".tsx") {
    return ts.ScriptKind.TSX;
  }
  if (extension === ".jsx") {
    return ts.ScriptKind.JSX;
  }
  if (extension === ".js" || extension === ".mjs") {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function getPropertyNameText(nameNode) {
  if (!nameNode) {
    return null;
  }

  if (ts.isIdentifier(nameNode) || ts.isPrivateIdentifier(nameNode)) {
    return nameNode.text;
  }

  if (ts.isStringLiteralLike(nameNode)) {
    return nameNode.text;
  }

  return null;
}

function applyCasePattern(sourceToken, replacement) {
  if (sourceToken.toLocaleUpperCase("pt-BR") === sourceToken) {
    return replacement.toLocaleUpperCase("pt-BR");
  }

  const isCapitalized =
    sourceToken.charAt(0).toLocaleUpperCase("pt-BR") === sourceToken.charAt(0) &&
    sourceToken.slice(1).toLocaleLowerCase("pt-BR") === sourceToken.slice(1);

  if (isCapitalized) {
    return replacement.charAt(0).toLocaleUpperCase("pt-BR") + replacement.slice(1);
  }

  return replacement;
}

function replaceSuspiciousTokens(text) {
  const replacements = [];

  const output = text.replace(TOKEN_REGEX, (match, token) => {
    const replacement = TOKEN_REPLACEMENTS[token.toLocaleLowerCase("pt-BR")];

    if (!replacement) {
      return match;
    }

    const nextValue = applyCasePattern(match, replacement);

    if (nextValue !== match) {
      replacements.push({ from: match, to: nextValue });
    }

    return nextValue;
  });

  return {
    changed: output !== text,
    output: output.normalize("NFC"),
    replacements,
  };
}

function isPathLike(text) {
  if (!text || /\s/.test(text)) {
    return false;
  }

  return (
    text.startsWith("/") ||
    text.startsWith("./") ||
    text.startsWith("../") ||
    text.startsWith("@/") ||
    /^[a-z]+:\/\//i.test(text) ||
    /^[a-z]+:/i.test(text) ||
    /^[a-z0-9/_-]+$/i.test(text) && (text.includes("/") || text.includes("-") || text.includes("_")) ||
    /\.[a-z0-9]+$/i.test(text)
  );
}

function isProbablyCssTokenList(text) {
  if (!text.includes(" ")) {
    return false;
  }

  const tokens = text.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return false;
  }

  return (
    tokens.every((token) => /^[a-z0-9:_/[\]-]+$/i.test(token)) &&
    tokens.some((token) => /[-:/[\]]/.test(token))
  );
}

function isSkippableStringNode(node, text) {
  if (!text.trim()) {
    return true;
  }

  if (!/[A-Za-z]/.test(text)) {
    return true;
  }

  if (isPathLike(text) || isProbablyCssTokenList(text)) {
    return true;
  }

  if (isClassNameFactoryCall(node)) {
    return true;
  }

  const parent = node.parent;

  if (
    ts.isImportDeclaration(parent) ||
    ts.isExportDeclaration(parent) ||
    ts.isExternalModuleReference(parent) ||
    ts.isLiteralTypeNode(parent)
  ) {
    return true;
  }

  if (ts.isJsxAttribute(parent)) {
    const attributeName = parent.name.text;

    if (NON_UI_PROPERTY_NAMES.has(attributeName)) {
      return true;
    }

    return !UI_ATTRIBUTE_NAMES.has(attributeName) && isPathLike(text);
  }

  if (ts.isPropertyAssignment(parent)) {
    const propertyName = getPropertyNameText(parent.name);

    if (propertyName && NON_UI_PROPERTY_NAMES.has(propertyName)) {
      return true;
    }
  }

  if (ts.isVariableDeclaration(parent)) {
    const variableName = getPropertyNameText(parent.name);

    if (variableName && /(className|href|icon|id|key|name|path|route|slug|src|type|url|value|variant)$/i.test(variableName)) {
      return true;
    }
  }

  return false;
}

function isClassNameFactoryCall(node) {
  let current = node.parent;

  while (current) {
    if (ts.isCallExpression(current)) {
      if (ts.isIdentifier(current.expression) && (current.expression.text === "cn" || current.expression.text === "cva")) {
        return true;
      }

      return false;
    }

    if (
      ts.isBinaryExpression(current) ||
      ts.isConditionalExpression(current) ||
      ts.isArrayLiteralExpression(current) ||
      ts.isObjectLiteralExpression(current) ||
      ts.isPropertyAssignment(current) ||
      ts.isTemplateSpan(current)
    ) {
      current = current.parent;
      continue;
    }

    return false;
  }

  return false;
}

function getLiteralContentRange(node, sourceFile) {
  if (ts.isStringLiteral(node)) {
    return {
      start: node.getStart(sourceFile) + 1,
      end: node.getEnd() - 1,
    };
  }

  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return {
      start: node.getStart(sourceFile) + 1,
      end: node.getEnd() - 1,
    };
  }

  return null;
}

function getNodeTextSegment(node, sourceFile, sourceText) {
  if (ts.isJsxText(node)) {
    const text = node.getText(sourceFile);
    const start = node.getStart(sourceFile);

    return {
      start,
      end: start + text.length,
      text,
    };
  }

  if (ts.isStringLiteralLike(node)) {
    const range = getLiteralContentRange(node, sourceFile);

    if (!range) {
      return null;
    }

    return {
      start: range.start,
      end: range.end,
      text: sourceText.slice(range.start, range.end),
    };
  }

  return null;
}

function collectSourceSegments(sourceFile, sourceText) {
  const segments = [];

  function visit(node) {
    if (ts.isJsxText(node) || ts.isStringLiteralLike(node)) {
      const segment = getNodeTextSegment(node, sourceFile, sourceText);

      if (segment && !isSkippableStringNode(node, segment.text)) {
        const correction = replaceSuspiciousTokens(segment.text);

        if (correction.changed) {
          const position = sourceFile.getLineAndCharacterOfPosition(segment.start);

          segments.push({
            before: segment.text,
            after: correction.output,
            column: position.character + 1,
            end: segment.end,
            line: position.line + 1,
            replacements: correction.replacements,
            start: segment.start,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return segments;
}

export function analyzeSourceText(sourceText, filePath = "unknown.tsx") {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, getScriptKind(filePath));

  return collectSourceSegments(sourceFile, sourceText).map((segment) => ({
    after: segment.after,
    before: segment.before,
    column: segment.column,
    filePath,
    line: segment.line,
    replacements: segment.replacements,
  }));
}

export function fixSourceText(sourceText, filePath = "unknown.tsx") {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, getScriptKind(filePath));
  const segments = collectSourceSegments(sourceFile, sourceText);

  if (segments.length === 0) {
    return {
      changed: false,
      findings: [],
      output: sourceText,
    };
  }

  let output = sourceText;

  for (const segment of [...segments].sort((left, right) => right.start - left.start)) {
    output = `${output.slice(0, segment.start)}${segment.after}${output.slice(segment.end)}`;
  }

  return {
    changed: output !== sourceText,
    findings: segments.map((segment) => ({
      after: segment.after,
      before: segment.before,
      column: segment.column,
      filePath,
      line: segment.line,
      replacements: segment.replacements,
    })),
    output,
  };
}

function collectProjectFiles(projectRoot, directories) {
  const files = [];

  function visit(currentPath) {
    const stats = fs.statSync(currentPath);

    if (stats.isDirectory()) {
      if (SKIPPED_DIRECTORY_NAMES.has(path.basename(currentPath))) {
        return;
      }

      for (const childName of fs.readdirSync(currentPath)) {
        visit(path.join(currentPath, childName));
      }

      return;
    }

    if (DEFAULT_FILE_EXTENSIONS.has(path.extname(currentPath).toLowerCase())) {
      files.push(currentPath);
    }
  }

  for (const directory of directories) {
    const absoluteDirectory = path.resolve(projectRoot, directory);

    if (fs.existsSync(absoluteDirectory)) {
      visit(absoluteDirectory);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

export function scanProject({
  directories = DEFAULT_SCAN_DIRECTORIES,
  fix = false,
  projectRoot = process.cwd(),
} = {}) {
  const files = collectProjectFiles(projectRoot, directories);
  const allFindings = [];
  const changedFiles = [];

  for (const absoluteFilePath of files) {
    const relativeFilePath = path.relative(projectRoot, absoluteFilePath);
    const sourceText = fs.readFileSync(absoluteFilePath, "utf8");
    const result = fix ? fixSourceText(sourceText, relativeFilePath) : {
      changed: false,
      findings: analyzeSourceText(sourceText, relativeFilePath),
      output: sourceText,
    };

    if (result.findings.length > 0) {
      allFindings.push(...result.findings);
    }

    if (fix && result.changed) {
      fs.writeFileSync(absoluteFilePath, result.output, "utf8");
      changedFiles.push(relativeFilePath);
    }
  }

  return {
    changedFiles,
    directories,
    filesScanned: files.length,
    findings: allFindings,
    fixApplied: fix,
    projectRoot,
  };
}

export function formatFindingsReport(result) {
  const findingsByFile = new Map();

  for (const finding of result.findings) {
    const bucket = findingsByFile.get(finding.filePath) ?? [];
    bucket.push(finding);
    findingsByFile.set(finding.filePath, bucket);
  }

  const lines = [
    `Portuguese Accent Audit (${result.fixApplied ? "fix" : "audit"})`,
    `Diretorios: ${result.directories.join(", ")}`,
    `Arquivos analisados: ${result.filesScanned}`,
    `Arquivos com ocorrencias: ${findingsByFile.size}`,
    `Ocorrencias: ${result.findings.length}`,
  ];

  if (result.fixApplied) {
    lines.push(`Arquivos alterados: ${result.changedFiles.length}`);
  }

  if (result.findings.length === 0) {
    lines.push("Nenhuma ocorrência suspeita encontrada.");
    return lines.join("\n");
  }

  for (const [filePath, fileFindings] of [...findingsByFile.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    lines.push("");
    lines.push(`${filePath} (${fileFindings.length})`);

    for (const finding of fileFindings) {
      lines.push(`  ${finding.line}:${finding.column} ${finding.before} -> ${finding.after}`);
    }
  }

  return lines.join("\n");
}
