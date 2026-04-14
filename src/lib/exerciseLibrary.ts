export type ExerciseInfo = {
  description: string;
  youtubeSearch: string;
};

function yt(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

const LIBRARY = {
  "Supino com barra": {
    description: "Deite no banco com os pes apoiados no chao. Segure a barra na largura dos ombros, cotovelos a ~45 graus do tronco. Desca controlado em 2 segundos ate a barra tocar levemente o peito e pressione de forma explosiva. Mantenha as escapulas retraidas e a lombar neutra durante todo o movimento.",
    youtubeSearch: yt("supino com barra tecnica"),
  },
  "Supino com halteres": {
    description: "Deite no banco segurando um halter em cada mao na altura do peito. Abaixe os halteres controladamente abrindo levemente os cotovelos e pressione de volta juntando os halteres no topo. O movimento livre permite maior amplitude e trabalha a estabilidade escapular.",
    youtubeSearch: yt("supino com halteres tecnica"),
  },
  "Supino com halteres neutros": {
    description: "Igual ao supino com halteres, mas com as palmas voltadas uma para a outra (pegada neutra). Reduz o estresse no ombro e e indicado para quem tem historico de dor no ombro ou cotovelo. Desca os halteres ao lado do peito e pressione de volta.",
    youtubeSearch: yt("supino neutro halteres tecnica"),
  },
  "Supino inclinado com halteres": {
    description: "Banco inclinado entre 30 e 45 graus. Segure os halteres na altura do peito, desca controlado e pressione para cima e levemente para dentro. O angulo de inclinacao recruta mais a cabeca clavicular do peitoral e o deltoid anterior. Nao deixe os cotovelos ultrapassar a linha do banco.",
    youtubeSearch: yt("supino inclinado halteres tecnica"),
  },
  "Landmine press": {
    description: "Com uma barra fixada no corner ou ancorada no chao, segure a extremidade livre com uma mao na altura do ombro. Pressione em diagonal para cima ate a extensao total do cotovelo, mantendo o core ativado. Excelente para ombro por respeitar o plano escapular. Pode ser feito em pe ou ajoelhado.",
    youtubeSearch: yt("landmine press tecnica"),
  },
  "Remada apoiada": {
    description: "Apoie o peito no banco inclinado ou use o suporte. Segure os halteres ou a barra com os bracos pendentes. Puxe em direcao ao quadril retraindo as escapulas, mantendo os cotovelos proximos ao tronco. Pause no topo por 1 segundo. O apoio elimina o balanco e isola bem o dorsal e os romboides.",
    youtubeSearch: yt("remada apoiada tecnica"),
  },
  "Remada unilateral no cabo": {
    description: "De pe ou levemente inclinado, puxe o cabo de baixo para o quadril de forma unilateral. Retrai a escapula do lado trabalhado no final do movimento. O cabo mantem tensao constante ao longo de toda a amplitude, diferente dos halteres. Excelente para correcao de assimetrias.",
    youtubeSearch: yt("remada unilateral cabo tecnica"),
  },
  "Puxada vertical": {
    description: "Sentado na maquina, segure a barra em largura um pouco maior que os ombros com pegada pronada. Puxe a barra em direcao a clavicula enquanto retrai as escapulas e abre levemente o peito. Controle a subida. Evite balanco excessivo do tronco e mantenha os cotovelos apontando para baixo.",
    youtubeSearch: yt("puxada vertical lat pulldown tecnica"),
  },
  "Face pull": {
    description: "Com o cabo na altura da testa e a corda, puxe em direcao ao rosto dividindo a corda ao meio. Os cotovelos sobem para os lados e ficam acima dos ombros no final. Movimento fundamental para saude do manguito e postura escapular. Use carga leve com alto controle, sem rotacao de tronco.",
    youtubeSearch: yt("face pull exercicio tecnica"),
  },
  "Rotacao externa com cabo": {
    description: "De pe de lado para o cabo, cotovelo a 90 graus junto ao tronco. Gire o antebraco para fora contra a resistencia, mantendo o cotovelo fixo. Fundamental para saude do manguito rotador, muito usado em prevencao de lesoes de ombro em atletas de raquete. Use carga muito leve.",
    youtubeSearch: yt("rotacao externa manguito rotador cabo tecnica"),
  },
  "Pronacao e supinacao de antebraco": {
    description: "Sentado com o antebraco apoiado na coxa, segure um halter leve na extremidade ou uma faixa elastica. Gire o antebraco para baixo (pronacao) e para cima (supinacao) de forma controlada. Fortalece musculatura que estabiliza o cotovelo e previne lesoes de epicondilo, essencial para jogadores de raquete.",
    youtubeSearch: yt("pronacao supinacao antebraco exercicio"),
  },
  "Front squat": {
    description: "Barra apoiada sobre os deltoides anteriores com cotovelos altos (posicao de rack frontal) ou com pegada cruzada. Desca com o tronco mais vertical possivel ate a dobra do joelho atingir ou superar o paralelo. O centro de massa frontal exige maior ativacao de quadriceps e core. Cotovelos altos durante todo o movimento.",
    youtubeSearch: yt("front squat agachamento frontal tecnica"),
  },
  "Safety bar squat": {
    description: "Similar ao agachamento com barra, mas com a barra especial que distribui o peso pelas alcas laterais, reduzindo estresse nos ombros e cotovelos. Permite tronco mais vertical. Indicado para quem tem limitacoes de mobilidade de ombro. Desca controlado e empurre o chao no retorno.",
    youtubeSearch: yt("safety bar squat tecnica"),
  },
  "Trap-bar deadlift": {
    description: "Fique no centro da barra hexagonal, pegada nas alcas laterais, quadris entre a posicao de agachamento e deadlift convencional. Empurre o chao afastando-se dele. A posicao mais simetrica reduz estresse na lombar e permite mais carga que o deadlift convencional. Optima escolha para potencia de membros inferiores.",
    youtubeSearch: yt("trap bar deadlift hexagonal tecnica"),
  },
  RDL: {
    description: "Romanian deadlift. Segure a barra ou os halteres com os joelhos levemente flexionados, empurre o quadril para tras e desca mantendo a coluna neutra ate sentir alongamento forte nos posteriores. Suba trazendo o quadril para frente sem perder a tensao no core. Priorize controle e amplitude limpa, sem arredondar a lombar.",
    youtubeSearch: yt("romanian deadlift RDL tecnica"),
  },
  "Hip thrust": {
    description: "Apoie a escapula no banco, barra sobre os quadris com acolchoamento. Parta com os quadris baixos e empurre para cima ate a extensao completa, apertando os gluteos no topo por 1 segundo. Joelhos a 90 graus no topo. Melhor exercicio isolado para gluteo maximo. Mantenha o queixo recolhido para nao hiperextender a cervical.",
    youtubeSearch: yt("hip thrust gluteo tecnica"),
  },
  "Bulgarian split squat": {
    description: "Pe traseiro apoiado no banco, pe da frente a um passo a frente. Desca verticalmente ate o joelho da frente atingir 90 graus. Mantenha o tronco levemente inclinado a frente e o joelho alinhado com o pe. Excelente para equilibrio, correcao de assimetrias e mobilidade de quadril. Exigente em estabilidade.",
    youtubeSearch: yt("bulgarian split squat agachamento bulgaro tecnica"),
  },
  "Box jump baixo": {
    description: "De pe a frente de uma caixa baixa (30-40cm). Faca um contra-movimento rapido e salte sobre a caixa aterrissando suavemente com os dois pes ao mesmo tempo, amortecendo na aterrissagem (joelhos levemente flexionados). Desempe da caixa andando, nao saltando. O objetivo e explosividade, nao altura maxima.",
    youtubeSearch: yt("box jump tecnica iniciante"),
  },
  "Hamstring curl": {
    description: "Deitado de brucos na maquina, envolva as canelas no rolete. Flexione os joelhos puxando os calcanhares em direcao aos gluteos de forma controlada. Desca lentamente (2-3 segundos). Essencial para balancear a forca entre quadriceps e isquiotibiais, reduzindo risco de lesao no esporte.",
    youtubeSearch: yt("hamstring curl flexao joelho maquina tecnica"),
  },
  "Calf raise": {
    description: "Em pe na ponta dos pes (borda de um step ou maquina), suba o maximo possivel e desca controlando ate sentir o alongamento. Pausa no topo por 1 segundo. Amplitude completa em cada repeticao. Pode ser feito unilateral para maior intensidade. Fundamental para saude do tornozelo e Aquiles.",
    youtubeSearch: yt("calf raise panturrilha tecnica amplitude"),
  },
  "Step-up": {
    description: "Apoie um pe sobre um step ou banco (altura de 40-50cm). Empurre pelo calcanhar do pe que esta no step para subir, sem usar impulso da perna de baixo. Desca controlado. Trabalha unilateralmente quadriceps, gluteos e estabilidade pelvica. Mantenha o joelho alinhado sobre o segundo dedo do pe.",
    youtubeSearch: yt("step up exercicio tecnica"),
  },
  CMJ: {
    description: "Counter Movement Jump. De pe ereto, faca um rapido agachamento parcial (contra-movimento) e salte verticalmente o mais alto possivel com os bracos auxiliando. Aterrisse suavemente amortecendo o impacto. Mede e desenvolve potencia explosiva de membros inferiores. Pare se sentir queda na altura do salto.",
    youtubeSearch: yt("counter movement jump CMJ tecnica"),
  },
  "Lateral bound": {
    description: "Salto lateral em uma perna so. Empurre lateralmente com uma perna e aterrisse suavemente na outra, amortecendo o impacto no quadril e joelho. Mantenha o tronco levemente inclinado a frente. Desenvolve potencia lateral e estabilidade de tornozelo, movimentos fundamentais no beach tennis.",
    youtubeSearch: yt("lateral bound salto lateral pliometria tecnica"),
  },
  "Jump shrug com barra": {
    description: "Segure a barra nas coxas com carga leve. Faca um dip curto de joelhos e quadril e exploda para cima estendendo tornozelos, joelhos e quadris, terminando com um encolhimento forte dos ombros. A barra sobe pela aceleracao, nao por puxada de braco. Foque em velocidade e postura. E um substituto de potencia quando nao ha medicine ball ou espaco para arremessos.",
    youtubeSearch: yt("barbell jump shrug tecnica"),
  },
  "Rotacao explosiva no cabo": {
    description: "Com o cabo regulado na altura do peito, fique de lado para a polia, segure o puxador com as duas maos e gire quadril e tronco de forma explosiva levando as maos a frente do corpo. Controle a volta sem deixar a pilha bater. O objetivo e transferir forca do chao pelo tronco ate os bracos, sem precisar arremessar bola na parede.",
    youtubeSearch: yt("cable rotational punch woodchop power tecnica"),
  },
  "Bike sprint": {
    description: "Na bike ergometrica, alterne 10 segundos de pedalo maximo (sprint total) com 50 segundos em ritmo leve. Mantenha a postura ereta ou levemente inclinada. Ajuste a resistencia para que o sprint seja realmente dificil. Desenvolve capacidade anaerobica e RSA (Repeated Sprint Ability).",
    youtubeSearch: yt("bike ergometrica sprint HIIT tecnica"),
  },
  "Bike sprint estendido": {
    description: "Na bike ergometrica, alterne 15 segundos muito forte com 45 segundos leves. O bloco e um pouco mais longo que o sprint curto e serve para substituir tiros livres quando a academia nao tem espaco para correr. Mantenha cadencia alta e tente repetir a mesma potencia em todas as series.",
    youtubeSearch: yt("bike sprint 15 45 hiit tecnica"),
  },
  "Bike finisher": {
    description: "Na bike ergometrica, alterne 30 segundos forte com 30 segundos leve. Intensidade moderada a alta no periodo forte, nao e um sprint maximo como o bike sprint. Serve como acabamento metabolico para fechar a sessao. Reduza ou pule se a recuperacao estiver comprometida.",
    youtubeSearch: yt("bike ergometrica cardio finisher"),
  },
  "Farmer carry": {
    description: "Segure um halter pesado em cada mao ao lado do corpo. Caminhe mantendo os ombros de volta, core ativado e passada controlada. Desenvolve forca de grip, estabilidade escapular e core lateral. 30 metros por serie. Aumente a carga progressivamente sem perder a postura.",
    youtubeSearch: yt("farmer carry farmer walk tecnica"),
  },
  "Pallof press": {
    description: "De pe de lado para o cabo, segure o cabo na altura do peito com as duas maos. Empurre para a frente estendendo os bracos e retorne. O core trabalha em anti-rotacao resistindo ao puxao lateral do cabo. Quanto mais longe do cabo, maior a exigencia. Essencial para estabilidade rotacional no esporte.",
    youtubeSearch: yt("pallof press anti rotacao tecnica"),
  },
  "Zone 2 bike": {
    description: "Pedalo na bike em ritmo confortavelmente conversavel (voce consegue falar frases completas). Frequencia cardiaca entre 60-70% do maximo. Desenvolve base aerobia, melhora recuperacao entre treinos e aumenta densidade mitocondrial. Resista a tentacao de ir mais rapido, a eficacia esta no ritmo leve.",
    youtubeSearch: yt("zone 2 training bike aerobio base"),
  },
  "Mobilidade quadril, tornozelo e toracica": {
    description: "Circuito de mobilidade articular: 90/90 stretch para rotacao interna e externa de quadril, mobilizacao de tornozelo em cadeia fechada e rotacao toracica com suporte. Realize cada exercicio por 10 repeticoes controladas. Priorize qualidade de movimento e amplitude sem dor.",
    youtubeSearch: yt("mobilidade quadril tornozelo toracica circuito"),
  },
  "Trap-3 raise": {
    description: "Deitado de brucos em banco inclinado a 45 graus, segure halteres leves. Eleve os bracos em Y (diagonal a 135 graus do tronco) com o polegar apontando para o teto. Movimento pequeno e controlado que ativa o trapezio inferior e medio. Fundamental para saude do ombro em atletas de raquete. Use cargas muito leves.",
    youtubeSearch: yt("trap 3 raise Y raise trapezio inferior tecnica"),
  },
  "Copenhagen plank": {
    description: "Deite de lado com o pe de cima apoiado na borda de um banco. Eleve o quadril formando uma linha reta do pe ao ombro. Mantenha por 20-30 segundos. Trabalha adutores e estabilidade lateral do quadril de forma muito eficaz. Comece com a versao joelho apoiado no banco se for muito dificil.",
    youtubeSearch: yt("copenhagen plank prancha lateral adutor tecnica"),
  },
  "Beach tennis": {
    description: "Sessao na quadra de beach tennis. Registre a duracao real da sessao e o sRPE (percepcao subjetiva de esforco de 1 a 10) ao final. Esses dados alimentam o calculo de carga semanal e ajudam a balancear a carga total entre musculacao e esporte.",
    youtubeSearch: yt("beach tennis treino tecnica"),
  },
} satisfies Record<string, ExerciseInfo>;

const EXERCISE_NAME_ALIASES: Record<string, keyof typeof LIBRARY> = {
  "Rotação externa com cabo": "Rotacao externa com cabo",
  "Pronação e supinação de antebraço": "Pronacao e supinacao de antebraco",
  "Mobilidade quadril, tornozelo e torácica": "Mobilidade quadril, tornozelo e toracica",
  "Mobilidade quadril tornozelo e toracica": "Mobilidade quadril, tornozelo e toracica",
};

const NORMALIZED_LIBRARY = new Map<string, keyof typeof LIBRARY>(
  Object.keys(LIBRARY).map((name) => [normalizeExerciseName(name), name as keyof typeof LIBRARY]),
);

function normalizeExerciseName(exerciseName: string) {
  return exerciseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function getExerciseInfo(exerciseName: string): ExerciseInfo | null {
  const directMatch = LIBRARY[exerciseName];
  if (directMatch) return directMatch;

  const alias = EXERCISE_NAME_ALIASES[exerciseName];
  if (alias) return LIBRARY[alias];

  const normalizedMatch = NORMALIZED_LIBRARY.get(normalizeExerciseName(exerciseName));
  return normalizedMatch ? LIBRARY[normalizedMatch] : null;
}
