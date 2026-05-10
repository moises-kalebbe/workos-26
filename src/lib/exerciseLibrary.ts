export type ExerciseInfo = {
  description: string;
  youtubeSearch: string;
  videoUrl?: string;
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
  // ── E-book: 227 exercícios de musculação para beach tennis ──────────────
  "Cócoras c/ Fortalecimento de Antebraço": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Cócoras c/ Fortalecimento de Antebraço beach tennis"),
    videoUrl: "https://youtube.com/shorts/Qk6jnGc4kOM",
  },
  "Maior alongamento do mundo": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Maior alongamento do mundo beach tennis"),
    videoUrl: "https://youtube.com/shorts/_Zw2G4_eNOc",
  },
  "TGU parcial": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("TGU parcial beach tennis"),
    videoUrl: "https://youtube.com/shorts/z1w4xHGY5_Y",
  },
  "Smash “deitado”": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Smash deitado beach tennis"),
    videoUrl: "https://youtube.com/shorts/L6LZHugd3LE",
  },
  "Mobilidade ombro e torácica (3 apoios)": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade ombro e torácica 3 apoios beach tennis"),
    videoUrl: "https://youtube.com/shorts/nKaFSiE48ys",
  },
  "Urso parcial touch": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Urso parcial touch beach tennis"),
    videoUrl: "https://youtube.com/shorts/SnnXQfsoH-A",
  },
  "Ativação escapular W e Y": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Ativação escapular W e Y beach tennis"),
    videoUrl: "https://youtube.com/shorts/zxuqjbT7SNA",
  },
  "Mobilidade ombro e torácica": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade ombro e torácica beach tennis"),
    videoUrl: "https://youtube.com/shorts/_f0S1pGviz4",
  },
  "Cócoras com rotação + posterior": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Cócoras com rotação posterior beach tennis"),
    videoUrl: "https://youtube.com/shorts/UpuABosVkVo",
  },
  "Ativação escapular gato": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Ativação escapular gato beach tennis"),
    videoUrl: "https://youtube.com/shorts/Ub7wfMeaOZo",
  },
  "Rotação interna e externa quadril": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Rotação interna externa quadril beach tennis"),
    videoUrl: "https://youtube.com/shorts/2BGQkB4Oz4I",
  },
  "Mobilidade de joelho e tornozelo": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade de joelho e tornozelo beach tennis"),
    videoUrl: "https://youtube.com/shorts/iSuR0_l88MI",
  },
  "Mobilidade de quadril e tornozelo": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade de quadril e tornozelo beach tennis"),
    videoUrl: "https://youtube.com/shorts/eyIe6ercZQs",
  },
  "Alongamento quadríceps, adutor e tornozelo": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Alongamento quadríceps adutor tornozelo beach tennis"),
    videoUrl: "https://youtube.com/shorts/xwTHwnYwnFc",
  },
  "Mobilidade lateral tornozelo + adutor": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade lateral tornozelo adutor beach tennis"),
    videoUrl: "https://youtube.com/shorts/_jrWsic0CMs",
  },
  "Mobilidade quadril unil": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade quadril unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/QAsYn-tn6_g",
  },
  "Desenvolvimento slide": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Desenvolvimento slide beach tennis"),
    videoUrl: "https://youtube.com/shorts/jJHIOcVOu2Q",
  },
  "Rotação interna e externa ombro parede": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Rotação interna externa ombro parede beach tennis"),
    videoUrl: "https://youtube.com/shorts/gHggor8MF0A",
  },
  "Circundução completa ombro parede em pé": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Circundução ombro parede beach tennis"),
    videoUrl: "https://youtube.com/shorts/xyaRk89-DH0",
  },
  "Urso parcial com flexão": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Urso parcial flexão beach tennis"),
    videoUrl: "https://youtube.com/shorts/bn712x54ja0",
  },
  "Mobilidade quadril unil step": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade quadril unil step beach tennis"),
    videoUrl: "https://youtube.com/shorts/tlM6dsvFFWA",
  },
  "Mobilidade quadril + transição step": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade quadril transição step beach tennis"),
    videoUrl: "https://youtube.com/shorts/2ZjXaD_jvQs",
  },
  "Mobilidade quadril alt step": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade quadril alternado step beach tennis"),
    videoUrl: "https://youtube.com/shorts/7HcJK_ZaPOM",
  },
  "Mobilidade saudação": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade saudação beach tennis"),
    videoUrl: "https://youtube.com/shorts/LNSH6N7byB8",
  },
  "Mobilidade quadril anterior alt": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade quadril anterior alternado beach tennis"),
    videoUrl: "https://youtube.com/shorts/v8skot200vg",
  },
  "Mobilidade quadril anterior + posterior": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade quadril anterior posterior beach tennis"),
    videoUrl: "https://youtube.com/shorts/J1MKnYqGNpk",
  },
  "Cócoras e soltura de joelho": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Cócoras soltura joelho beach tennis"),
    videoUrl: "https://youtube.com/shorts/rfQBVVlwrTQ",
  },
  "Mobilidade adutor e torácica": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade adutor torácica beach tennis"),
    videoUrl: "https://youtube.com/shorts/UhzHiaPi3Nk",
  },
  "Maior alongamento do mundo alternado": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Maior alongamento do mundo alternado beach tennis"),
    videoUrl: "https://youtube.com/shorts/ZHaNxmEkSZo",
  },
  "Cócoras HBC + fortalecimento cotovelo": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Cócoras HBC fortalecimento cotovelo beach tennis"),
    videoUrl: "https://youtube.com/shorts/AzD4egaQg0Q",
  },
  "Prancha touch + cócoras": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Prancha touch cócoras beach tennis"),
    videoUrl: "https://youtube.com/shorts/jyFyQzVIt0U",
  },
  "Mobilidade ombro: rotação inter e ext bastão": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade ombro rotação bastão beach tennis"),
    videoUrl: "https://youtube.com/shorts/MCW6cr-bAGc",
  },
  "Ativação escapular na bola": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Ativação escapular bola beach tennis"),
    videoUrl: "https://youtube.com/shorts/wH36uVNVI3o",
  },
  "Ativação ombro na bola": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Ativação ombro bola beach tennis"),
    videoUrl: "https://youtube.com/shorts/ELhFv7teOP4",
  },
  "Mobilidade torácica desce e sobe": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade torácica beach tennis"),
    videoUrl: "https://youtube.com/shorts/hIgWJ0J_oYw",
  },
  "Mob adutor/torácica 3 apoios": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade adutor torácica 3 apoios beach tennis"),
    videoUrl: "https://youtube.com/shorts/hcEtUl1qVoA",
  },
  "Mob adutor/torácica 3 apoios (2 braços)": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade adutor torácica 3 apoios 2 braços beach tennis"),
    videoUrl: "https://youtube.com/shorts/WDEDJABLfpM",
  },
  "Mobilidade quadril alt + bíceps": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade quadril alternado bíceps beach tennis"),
    videoUrl: "https://youtube.com/shorts/ug709c0Yg3Y",
  },
  "Mobilidade quadril alt + desenvolvimento": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade quadril alternado desenvolvimento beach tennis"),
    videoUrl: "https://youtube.com/shorts/RGx2E_95KoY",
  },
  "Mobilidade quadril alt + bíceps/desenv": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Mobilidade quadril alternado bíceps desenvolvimento beach tennis"),
    videoUrl: "https://youtube.com/shorts/81btqRhC5GU",
  },
  "Urso parcial com maior do mundo alt": {
    description: "Exercicio de mobilidade e estabilidade articular para beach tennis. Prepara as articulacoes e reduz o risco de lesao em quadra.",
    youtubeSearch: yt("Urso parcial maior alongamento alternado beach tennis"),
    videoUrl: "https://youtube.com/shorts/zhCxgxCJHH8",
  },
  "Supino em pé (base paralela)": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Supino em pé base paralela beach tennis"),
    videoUrl: "https://youtube.com/shorts/u9Db20w1XQg",
  },
  "Supino em pé (base alternada)": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Supino em pé base alternada beach tennis"),
    videoUrl: "https://youtube.com/shorts/MZrYT2hQQ4Q",
  },
  "Supino em pé explosivo": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Supino em pé explosivo beach tennis"),
    videoUrl: "https://youtube.com/shorts/PoNqpzg48LE",
  },
  "Desenvolvimento unil (base semi ajoelhada)": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Desenvolvimento unilateral semi ajoelhado beach tennis"),
    videoUrl: "https://youtube.com/shorts/YChIyc_0Tfs",
  },
  "Passada para trás alternada": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Passada para trás alternada beach tennis"),
    videoUrl: "https://youtube.com/shorts/S0axh0W8kHg",
  },
  "Desenvolvimento explosivo": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Desenvolvimento explosivo beach tennis"),
    videoUrl: "https://youtube.com/shorts/iOhQC0znlmw",
  },
  "Agachamento com rotação (HBC)": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Agachamento com rotação HBC beach tennis"),
    videoUrl: "https://youtube.com/shorts/DdWwLVX67w8",
  },
  "Desenvolvimento unilateral (ajoelhado)": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Desenvolvimento unilateral ajoelhado beach tennis"),
    videoUrl: "https://youtube.com/shorts/eHwJdZT2l2s",
  },
  "Passada p/ trás alt + agach. c/ panturrilha": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Passada trás alternada agachamento panturrilha beach tennis"),
    videoUrl: "https://youtube.com/shorts/OGY3Imb3YhU",
  },
  "Flexão sproul + ombro": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Flexão sproul ombro beach tennis"),
    videoUrl: "https://youtube.com/shorts/c8x0Z06rglk",
  },
  "Supino em ponte HBC": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Supino em ponte HBC beach tennis"),
    videoUrl: "https://youtube.com/shorts/qKsUq8E6l0w",
  },
  "Pistol alternado": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Pistol alternado beach tennis"),
    videoUrl: "https://youtube.com/shorts/6Up4Y14aaGc",
  },
  "Saltito 3x1 + agachamento": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Saltito 3x1 agachamento beach tennis"),
    videoUrl: "https://youtube.com/shorts/929ENIWs8sg",
  },
  "Flexão pliométrica": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Flexão pliométrica beach tennis"),
    videoUrl: "https://youtube.com/shorts/_WmgwOPbtHw",
  },
  "Agachamento unil + desenv.": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Agachamento unilateral desenvolvimento beach tennis"),
    videoUrl: "https://youtube.com/shorts/2CqieHZjJag",
  },
  "Agachapantu + desenvolvimento pegada": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Agachapantu desenvolvimento pegada beach tennis"),
    videoUrl: "https://youtube.com/shorts/VknQmJzdCRE",
  },
  "Agachapantu pegada": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Agachapantu pegada beach tennis"),
    videoUrl: "https://youtube.com/shorts/wCLK-WGHwpc",
  },
  "Agachamento landmine": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Agachamento landmine beach tennis"),
    videoUrl: "https://youtube.com/shorts/lG32L_j-aHQ",
  },
  "Supino cross over": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Supino cross over beach tennis"),
    videoUrl: "https://youtube.com/shorts/lK0iFp-jMg4",
  },
  "Desenvolvimento chão": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Desenvolvimento chão beach tennis"),
    videoUrl: "https://youtube.com/shorts/1lwIRorO3f8",
  },
  "Desenvolvimento unil chão": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Desenvolvimento unilateral chão beach tennis"),
    videoUrl: "https://youtube.com/shorts/LjK7m-qysxk",
  },
  "Supino em ponte unil": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Supino em ponte unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/QxM_n4lnbxY",
  },
  "Supino em ponte isométrica": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Supino em ponte isométrica beach tennis"),
    videoUrl: "https://youtube.com/shorts/hTyze_s0WPg",
  },
  "Supino em ponte unil apoio": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Supino em ponte unil apoio beach tennis"),
    videoUrl: "https://youtube.com/shorts/eatU8IyVITw",
  },
  "Transição unil step com desenvolvimento": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Transição unil step desenvolvimento beach tennis"),
    videoUrl: "https://youtube.com/shorts/T6QyhoF19K8",
  },
  "Flexão dinâmica step": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Flexão dinâmica step beach tennis"),
    videoUrl: "https://youtube.com/shorts/_bR1Pq8oCcc",
  },
  "Passada p/ trás landmine": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Passada trás landmine beach tennis"),
    videoUrl: "https://youtube.com/shorts/4EGW1OPQG4E",
  },
  "Passada p/ trás landmine lateral": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Passada trás landmine lateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/gacFj8pYm7s",
  },
  "Passada p/ trás alternada barra livre": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Passada trás alternada barra livre beach tennis"),
    videoUrl: "https://youtube.com/shorts/6WzvesSAWKI",
  },
  "Desenvolvimento barra livre": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Desenvolvimento barra livre beach tennis"),
    videoUrl: "https://youtube.com/shorts/RMkp5p2zPnY",
  },
  "Agachamento barra livre": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Agachamento barra livre beach tennis"),
    videoUrl: "https://youtube.com/shorts/KRGfmawQ7jo",
  },
  "Passada p/ trás unil barra livre": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Passada trás unilateral barra livre beach tennis"),
    videoUrl: "https://youtube.com/shorts/tPhi-LmpPQI",
  },
  "Passada p/ trás alternada landmine": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Passada trás alternada landmine beach tennis"),
    videoUrl: "https://youtube.com/shorts/6A3fzMIhxqQ",
  },
  "Supino reto unilateral": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Supino reto unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/BN_ySIMgscU",
  },
  "Supino inclinado unilateral": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Supino inclinado unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/UZcRZ3ZIyl0",
  },
  "Desenvolvimento em pé unilateral": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Desenvolvimento em pé unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/7IbooqQ4G6g",
  },
  "Agachamento sumô": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Agachamento sumô beach tennis"),
    videoUrl: "https://youtube.com/shorts/V_kgttfIZng",
  },
  "Supino + afundo": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Supino afundo beach tennis"),
    videoUrl: "https://youtube.com/shorts/SLVD4kHKvhU",
  },
  "Flexão de braço aberta + fechada": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Flexão de braço aberta fechada beach tennis"),
    videoUrl: "https://youtube.com/shorts/5NstoE0RuII",
  },
  "Agachamento unilateral": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Agachamento unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/N8_3Lkxqv88",
  },
  "Flexão de braço dinâmica": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Flexão de braço dinâmica beach tennis"),
    videoUrl: "https://youtube.com/shorts/mon74RKDwS0",
  },
  "Supino inclinado unil cross semi ajoelhado": {
    description: "Exercicio no padrao de empurrar para beach tennis. Fortalece peitoral, deltoides e triceps com transferencia funcional ao esporte.",
    youtubeSearch: yt("Supino inclinado unil cross semi ajoelhado beach tennis"),
    videoUrl: "https://youtube.com/shorts/gI0hjqxP0O0",
  },
  "Remada alternada em prancha": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada alternada prancha beach tennis"),
    videoUrl: "https://youtube.com/shorts/hfoKHFnJEIs",
  },
  "Remada em pé (base paralela)": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada em pé base paralela beach tennis"),
    videoUrl: "https://youtube.com/shorts/aAXfplVKvvw",
  },
  "Remada em pé (base alternada)": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada em pé base alternada beach tennis"),
    videoUrl: "https://youtube.com/shorts/wEsPKLTIBlk",
  },
  "Remada em pé explosiva": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada em pé explosiva beach tennis"),
    videoUrl: "https://youtube.com/shorts/yb9xzfftuf4",
  },
  "Terra pegar e soltar": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Terra pegar e soltar beach tennis"),
    videoUrl: "https://youtube.com/shorts/F1conu-kmBw",
  },
  "Terra com HBC": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Terra com HBC beach tennis"),
    videoUrl: "https://youtube.com/shorts/sWyj2vKnz7o",
  },
  "Levantamento Terra Unil corrida com Peso": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Levantamento Terra Unil corrida Peso beach tennis"),
    videoUrl: "https://youtube.com/shorts/eLp1CRI3-4c",
  },
  "Terra com barra": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Terra com barra beach tennis"),
    videoUrl: "https://youtube.com/shorts/W_dqZj1SVdY",
  },
  "Passada para frente alternada": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Passada para frente alternada beach tennis"),
    videoUrl: "https://youtube.com/shorts/RByFWKYvvtQ",
  },
  "Puxada unilateral (ajoelhada)": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Puxada unilateral ajoelhada beach tennis"),
    videoUrl: "https://youtube.com/shorts/EAS7YRkezAo",
  },
  "Puxada explosiva": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Puxada explosiva beach tennis"),
    videoUrl: "https://youtube.com/shorts/EfwW_VGYY8s",
  },
  "Puxada unilateral (semi ajoelhada)": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Puxada unilateral semi ajoelhada beach tennis"),
    videoUrl: "https://youtube.com/shorts/Ft0vtLw41DE",
  },
  "Remada sproul + antebraço": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada sproul antebraço beach tennis"),
    videoUrl: "https://youtube.com/shorts/FoMFrCP08vQ",
  },
  "Elevação explosiva + puxada": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Elevação explosiva puxada beach tennis"),
    videoUrl: "https://youtube.com/shorts/Uq4L7wZvmSo",
  },
  "Stiff + remada HBC": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Stiff remada HBC beach tennis"),
    videoUrl: "https://youtube.com/shorts/XgESYdfMIiQ",
  },
  "Remada curvada cross": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada curvada cross beach tennis"),
    videoUrl: "https://youtube.com/shorts/NpmigxVYlxg",
  },
  "Puxada isométrica cross": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Puxada isométrica cross beach tennis"),
    videoUrl: "https://youtube.com/shorts/qgif8YibwLw",
  },
  "Agachamento búlgaro": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Agachamento búlgaro beach tennis"),
    videoUrl: "https://youtube.com/shorts/ozXNzkuof7k",
  },
  "Stiff + remada unil": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Stiff remada unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/P5Kx_b6yTy0",
  },
  "Elevação de quadril explosiva": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Elevação de quadril explosiva beach tennis"),
    videoUrl: "https://youtube.com/shorts/m_YFSbcsoZg",
  },
  "Terra com arranque": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Terra com arranque beach tennis"),
    videoUrl: "https://youtube.com/shorts/qLbj5M0Bqig",
  },
  "Stiff + remada cross": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Stiff remada cross beach tennis"),
    videoUrl: "https://youtube.com/shorts/Fwe7K2xe3KQ",
  },
  "Remada unil em prancha": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada unilateral prancha beach tennis"),
    videoUrl: "https://youtube.com/shorts/cYOjdQCN-sw",
  },
  "Remada curvada unil alternada": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada curvada unil alternada beach tennis"),
    videoUrl: "https://youtube.com/shorts/7u94KOwaCbU",
  },
  "Elevação de quadril explosiva unil alt step": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Elevação quadril explosiva unil alt step beach tennis"),
    videoUrl: "https://youtube.com/shorts/NNhujXDz1Mk",
  },
  "Elevação de quadril explosiva unil step": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Elevação quadril explosiva unil step beach tennis"),
    videoUrl: "https://youtube.com/shorts/xvG9u_DSQaY",
  },
  "Elevação de quadril explosiva step": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Elevação quadril explosiva step beach tennis"),
    videoUrl: "https://youtube.com/shorts/PVV5N5qq_Xs",
  },
  "Remada unil alternando step": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada unil alternando step beach tennis"),
    videoUrl: "https://youtube.com/shorts/OuApQGbBFpc",
  },
  "Puxada unil pulley": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Puxada unilateral pulley beach tennis"),
    videoUrl: "https://youtube.com/shorts/kxVCbBDbSzU",
  },
  "Remada reta corda cross": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada reta corda cross beach tennis"),
    videoUrl: "https://youtube.com/shorts/lsAhZpTMX2M",
  },
  "Stiff unil + remada unil Cross": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Stiff unil remada unil cross beach tennis"),
    videoUrl: "https://youtube.com/shorts/d61z_mYqqac",
  },
  "Afundo + remada unil": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Afundo remada unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/WlZxd3yfCZA",
  },
  "Extensão ombro corda unil": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Extensão ombro corda unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/zcfFko-SS2Y",
  },
  "Extensão ombro corda": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Extensão ombro corda beach tennis"),
    videoUrl: "https://youtube.com/shorts/U2OBi4ZosrQ",
  },
  "Puxada iso unil alternada": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Puxada iso unil alternada beach tennis"),
    videoUrl: "https://youtube.com/shorts/R57WgKqmGK4",
  },
  "Remada reta unil alternada": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada reta unil alternada beach tennis"),
    videoUrl: "https://youtube.com/shorts/9Iosv6AN9a4",
  },
  "Potência de quadril landmine": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Potência quadril landmine beach tennis"),
    videoUrl: "https://youtube.com/shorts/L77IAoBhZv4",
  },
  "Stiff unil landmine lateral": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Stiff unil landmine lateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/JVBAioKO0UM",
  },
  "Stiff + remada barra": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Stiff remada barra beach tennis"),
    videoUrl: "https://youtube.com/shorts/lwn2D3NF2tU",
  },
  "Passada a frente com rotação": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Passada frente com rotação beach tennis"),
    videoUrl: "https://youtube.com/shorts/oGlNmNIbxDs",
  },
  "Remada curvada unil explosiva": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada curvada unil explosiva beach tennis"),
    videoUrl: "https://youtube.com/shorts/O6pZs0arkCI",
  },
  "Elevação de quadril deslizando": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Elevação quadril deslizando beach tennis"),
    videoUrl: "https://youtube.com/shorts/NDcgIszfk4k",
  },
  "Agachamento lateral + adutor (deslizando)": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Agachamento lateral adutor deslizando beach tennis"),
    videoUrl: "https://youtube.com/shorts/LKELlk5OVa0",
  },
  "Potência de quadril HBC/Anilha": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Potência quadril HBC anilha beach tennis"),
    videoUrl: "https://youtube.com/shorts/BJphFGTYMho",
  },
  "Remada unil cross unipodal + chute": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada unil cross unipodal chute beach tennis"),
    videoUrl: "https://youtube.com/shorts/iQScCCs6pWU",
  },
  "Remada curvada unil cross unipodal": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada curvada unil cross unipodal beach tennis"),
    videoUrl: "https://youtube.com/shorts/qrNf__UUxg8",
  },
  "Extensão de ombro diagonal + recuo": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Extensão ombro diagonal recuo beach tennis"),
    videoUrl: "https://youtube.com/shorts/ySYnrSoRyWU",
  },
  "Extensão de ombro diagonal alt": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Extensão ombro diagonal alternada beach tennis"),
    videoUrl: "https://youtube.com/shorts/sW2XdumUjDE",
  },
  "Remada unil base unipodal": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Remada unil base unipodal beach tennis"),
    videoUrl: "https://youtube.com/shorts/ZLyCkl3Rk90",
  },
  "Puxada sentado step unil corda": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Puxada sentado step unil corda beach tennis"),
    videoUrl: "https://youtube.com/shorts/unBzeOGaNds",
  },
  "Puxada sentado step": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Puxada sentado step beach tennis"),
    videoUrl: "https://youtube.com/shorts/yOdR4M02ZNg",
  },
  "Elevação de quadril com alcance": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Elevação quadril com alcance beach tennis"),
    videoUrl: "https://youtube.com/shorts/Q3FMqV6ZXY0",
  },
  "Passada lateral": {
    description: "Exercicio no padrao de puxar para beach tennis. Fortalece dorsal, biceps e cadeia posterior com transferencia funcional ao esporte.",
    youtubeSearch: yt("Passada lateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/i7E8NjNyNSs",
  },
  "Agachamento Thruster": {
    description: "Exercicio integrado que combina multiplos padroes de movimento para maxima transferencia ao beach tennis.",
    youtubeSearch: yt("Agachamento Thruster beach tennis"),
    videoUrl: "https://youtube.com/shorts/UXcm73oNJz8",
  },
  "Agachamento com arranque unil": {
    description: "Exercicio integrado que combina multiplos padroes de movimento para maxima transferencia ao beach tennis.",
    youtubeSearch: yt("Agachamento arranque unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/bo4j7zrNuRg",
  },
  "Agachamento com remada alta unil": {
    description: "Exercicio integrado que combina multiplos padroes de movimento para maxima transferencia ao beach tennis.",
    youtubeSearch: yt("Agachamento remada alta unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/TIulSv5hiRg",
  },
  "Agachamento com remada alta": {
    description: "Exercicio integrado que combina multiplos padroes de movimento para maxima transferencia ao beach tennis.",
    youtubeSearch: yt("Agachamento remada alta beach tennis"),
    videoUrl: "https://youtube.com/shorts/kBD60WlniC0",
  },
  "Agachamento lateral thruster cruzado": {
    description: "Exercicio integrado que combina multiplos padroes de movimento para maxima transferencia ao beach tennis.",
    youtubeSearch: yt("Agachamento lateral thruster cruzado beach tennis"),
    videoUrl: "https://youtube.com/shorts/p0or8_J3j0o",
  },
  "Agachamento lateral thruster cruzado 2": {
    description: "Exercicio integrado que combina multiplos padroes de movimento para maxima transferencia ao beach tennis.",
    youtubeSearch: yt("Agachamento lateral thruster cruzado variação beach tennis"),
    videoUrl: "https://youtube.com/shorts/rRuNq7-211g",
  },
  "Agachamento excêntrico thruster": {
    description: "Exercicio integrado que combina multiplos padroes de movimento para maxima transferencia ao beach tennis.",
    youtubeSearch: yt("Agachamento excêntrico thruster beach tennis"),
    videoUrl: "https://youtube.com/shorts/lay11met7ME",
  },
  "Agachamento thruster unil": {
    description: "Exercicio integrado que combina multiplos padroes de movimento para maxima transferencia ao beach tennis.",
    youtubeSearch: yt("Agachamento thruster unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/-RFcV3pc4t4",
  },
  "Agachamento thruster barra": {
    description: "Exercicio integrado que combina multiplos padroes de movimento para maxima transferencia ao beach tennis.",
    youtubeSearch: yt("Agachamento thruster barra beach tennis"),
    videoUrl: "https://youtube.com/shorts/i3jrppNZdqU",
  },
  "Tríplice extensão (inferior + tríceps)": {
    description: "Exercicio integrado que combina multiplos padroes de movimento para maxima transferencia ao beach tennis.",
    youtubeSearch: yt("Tríplice extensão inferior tríceps beach tennis"),
    videoUrl: "https://youtube.com/shorts/60iUb9wb2xY",
  },
  "Dupla extensão (tríceps + panturrilha)": {
    description: "Exercicio integrado que combina multiplos padroes de movimento para maxima transferencia ao beach tennis.",
    youtubeSearch: yt("Dupla extensão tríceps panturrilha beach tennis"),
    videoUrl: "https://youtube.com/shorts/F6tvXRtF-RQ",
  },
  "Prancha alta com toque cruzado": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Prancha alta toque cruzado beach tennis"),
    videoUrl: "https://youtube.com/shorts/f101HKPqXM4",
  },
  "Pallof (semi ajoelhado)": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Pallof semi ajoelhado beach tennis"),
    videoUrl: "https://youtube.com/shorts/hgPTRIB2aM4",
  },
  "Pallof com rotação (semi ajoelhado)": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Pallof com rotação semi ajoelhado beach tennis"),
    videoUrl: "https://youtube.com/shorts/QxdcR5xCvWI",
  },
  "Prancha arrastar peso": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Prancha arrastar peso beach tennis"),
    videoUrl: "https://youtube.com/shorts/7jkZOIOZaGo",
  },
  "Superman alternado": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Superman alternado beach tennis"),
    videoUrl: "https://youtube.com/shorts/3q8cjQTM9Xw",
  },
  "Prancha lateral com rotação": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Prancha lateral com rotação beach tennis"),
    videoUrl: "https://youtube.com/shorts/AZdy3b7bQqo",
  },
  "Prancha lateral sustentação ombro": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Prancha lateral sustentação ombro beach tennis"),
    videoUrl: "https://youtube.com/shorts/pepZq7VMiYk",
  },
  "Prancha lateral adutor": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Prancha lateral adutor beach tennis"),
    videoUrl: "https://youtube.com/shorts/8e-mNmCna-0",
  },
  "Prancha lateral adutor isometria": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Prancha lateral adutor isometria beach tennis"),
    videoUrl: "https://youtube.com/shorts/M9RKuROynIA",
  },
  "Farm Walker unil over": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Farm Walker unilateral over beach tennis"),
    videoUrl: "https://youtube.com/shorts/HngQJ2ShCFQ",
  },
  "Farm Walker unil 90°": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Farm Walker unilateral 90 graus beach tennis"),
    videoUrl: "https://youtube.com/shorts/dr487Tp-lBE",
  },
  "Farm Walker uni": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Farm Walker unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/OWTwaeWaNL4",
  },
  "Farm Walker": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Farm Walker beach tennis"),
    videoUrl: "https://youtube.com/shorts/xl8ReTZPjx8",
  },
  "Farm iso unil over": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Farm isométrico unil over beach tennis"),
    videoUrl: "https://youtube.com/shorts/yJKfkGyhKmY",
  },
  "Farm iso unil 90º": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Farm isométrico unil 90 graus beach tennis"),
    videoUrl: "https://youtube.com/shorts/2KbB-7nJku0",
  },
  "Farm isométrico unil": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Farm isométrico unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/GxfdNMgTdtw",
  },
  "Farm isométrico": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Farm isométrico beach tennis"),
    videoUrl: "https://youtube.com/shorts/YNzA-5n00rY",
  },
  "Ativação de CORE LSA": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Ativação CORE LSA beach tennis"),
    videoUrl: "https://youtube.com/shorts/SPp4tE4I-CU",
  },
  "Prancha dinâmica na bola": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Prancha dinâmica bola beach tennis"),
    videoUrl: "https://youtube.com/shorts/0V39c7bcarM",
  },
  "Prancha na bola": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Prancha na bola beach tennis"),
    videoUrl: "https://youtube.com/shorts/ZNC9wLhgwSU",
  },
  "Prancha dinâmica na bola com apoio": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Prancha dinâmica bola apoio beach tennis"),
    videoUrl: "https://youtube.com/shorts/qiz_ULatIPM",
  },
  "Rotação de tronco em sustentação unil": {
    description: "Exercicio de estabilidade de CORE para beach tennis. Controle e resistencia anti-rotacional essenciais para o esporte.",
    youtubeSearch: yt("Rotação tronco sustentação unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/I_6iz4aeF0Y",
  },
  "Chop no cross (semi ajoelhado)": {
    description: "Exercicio de forca de CORE para beach tennis. Potencia rotacional e transferencia de forca no saque e driveada.",
    youtubeSearch: yt("Chop cross semi ajoelhado beach tennis"),
    videoUrl: "https://youtube.com/shorts/28QqM30c2Ck",
  },
  "Lift (semi ajoelhado)": {
    description: "Exercicio de forca de CORE para beach tennis. Potencia rotacional e transferencia de forca no saque e driveada.",
    youtubeSearch: yt("Lift semi ajoelhado beach tennis"),
    videoUrl: "https://youtube.com/shorts/o-v4IfJeSl8",
  },
  "Pallof com rotação": {
    description: "Exercicio de forca de CORE para beach tennis. Potencia rotacional e transferencia de forca no saque e driveada.",
    youtubeSearch: yt("Pallof com rotação beach tennis"),
    videoUrl: "https://youtube.com/shorts/b5LrVfyOfUQ",
  },
  "Lift no cross": {
    description: "Exercicio de forca de CORE para beach tennis. Potencia rotacional e transferencia de forca no saque e driveada.",
    youtubeSearch: yt("Lift no cross beach tennis"),
    videoUrl: "https://youtube.com/shorts/otsyu4d87s8",
  },
  "Rotação abs unil ajoelhado": {
    description: "Exercicio de forca de CORE para beach tennis. Potencia rotacional e transferencia de forca no saque e driveada.",
    youtubeSearch: yt("Rotação abdominal unil ajoelhado beach tennis"),
    videoUrl: "https://youtube.com/shorts/wkEXT2DCcho",
  },
  "Rotação abs ajoelhado landmine": {
    description: "Exercicio de forca de CORE para beach tennis. Potencia rotacional e transferencia de forca no saque e driveada.",
    youtubeSearch: yt("Rotação abdominal ajoelhado landmine beach tennis"),
    videoUrl: "https://youtube.com/shorts/RvZDYj0VOqE",
  },
  "Rotação abs unil em pé landmine": {
    description: "Exercicio de forca de CORE para beach tennis. Potencia rotacional e transferencia de forca no saque e driveada.",
    youtubeSearch: yt("Rotação abdominal unil em pé landmine beach tennis"),
    videoUrl: "https://youtube.com/shorts/wpWRsjO69hM",
  },
  "Rotação abs em pé landmine": {
    description: "Exercicio de forca de CORE para beach tennis. Potencia rotacional e transferencia de forca no saque e driveada.",
    youtubeSearch: yt("Rotação abdominal em pé landmine beach tennis"),
    videoUrl: "https://youtube.com/shorts/BdQC9mWaJd0",
  },
  "Afundo pallof dinâmico": {
    description: "Exercicio de forca de CORE para beach tennis. Potencia rotacional e transferencia de forca no saque e driveada.",
    youtubeSearch: yt("Afundo pallof dinâmico beach tennis"),
    videoUrl: "https://youtube.com/shorts/11d_Ro5ntLw",
  },
  "Afundo lift no cross": {
    description: "Exercicio de forca de CORE para beach tennis. Potencia rotacional e transferencia de forca no saque e driveada.",
    youtubeSearch: yt("Afundo lift cross beach tennis"),
    videoUrl: "https://youtube.com/shorts/IZ-C_voL8qU",
  },
  "Agachamento com rotação no cross": {
    description: "Exercicio de forca de CORE para beach tennis. Potencia rotacional e transferencia de forca no saque e driveada.",
    youtubeSearch: yt("Agachamento rotação cross beach tennis"),
    videoUrl: "https://youtube.com/shorts/6AuYKLWkX7E",
  },
  "Lift kett/anilha/HBC": {
    description: "Exercicio de forca de CORE para beach tennis. Potencia rotacional e transferencia de forca no saque e driveada.",
    youtubeSearch: yt("Lift kettlebell anilha HBC beach tennis"),
    videoUrl: "https://youtube.com/shorts/MNwbHAnDsVM",
  },
  "Rotação de tronco e quadril no cross": {
    description: "Exercicio de forca de CORE para beach tennis. Potencia rotacional e transferencia de forca no saque e driveada.",
    youtubeSearch: yt("Rotação tronco quadril cross beach tennis"),
    videoUrl: "https://youtube.com/shorts/HgxeCa3-5KI",
  },
  "Rotação de tronco no cross": {
    description: "Exercicio de forca de CORE para beach tennis. Potencia rotacional e transferencia de forca no saque e driveada.",
    youtubeSearch: yt("Rotação tronco cross beach tennis"),
    videoUrl: "https://youtube.com/shorts/_TxAgruwwz0",
  },
  "Pistol explosivo": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Pistol explosivo beach tennis"),
    videoUrl: "https://youtube.com/shorts/Z8wA-owcAqc",
  },
  "Jump lounge": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Jump lounge pliometria beach tennis"),
    videoUrl: "https://youtube.com/shorts/XcWBZhhhQnA",
  },
  "Terra arranque completo unil alternado": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Terra arranque unil alternado beach tennis"),
    videoUrl: "https://youtube.com/shorts/eXixu469pd8",
  },
  "Passada p/ trás com chute + ataque": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Passada trás chute ataque beach tennis"),
    videoUrl: "https://youtube.com/shorts/umrDcANdn-g",
  },
  "Passada com lift + ataque": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Passada lift ataque beach tennis"),
    videoUrl: "https://youtube.com/shorts/tzCyGjEKZgM",
  },
  "Terra unil + ataque": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Terra unilateral ataque beach tennis"),
    videoUrl: "https://youtube.com/shorts/WLrV_wHOL5o",
  },
  "Desenvolvimento empunhadura + ataque": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Desenvolvimento empunhadura ataque beach tennis"),
    videoUrl: "https://youtube.com/shorts/1Tsuv45SirI",
  },
  "Afundo pliometrico alt step": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Afundo pliométrico alternado step beach tennis"),
    videoUrl: "https://youtube.com/shorts/dLZ4wBPEw6A",
  },
  "Afundo pliométrico step": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Afundo pliométrico step beach tennis"),
    videoUrl: "https://youtube.com/shorts/t6pUBZuGwvo",
  },
  "Búlgaro Thruster": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Búlgaro Thruster beach tennis"),
    videoUrl: "https://youtube.com/shorts/g4UG7mk6bDk",
  },
  "Agachamento explosivo": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Agachamento explosivo beach tennis"),
    videoUrl: "https://youtube.com/shorts/J796KbHmO4k",
  },
  "Búlgaro lift": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Búlgaro lift beach tennis"),
    videoUrl: "https://youtube.com/shorts/gta8SznLoQc",
  },
  "Passada p/ trás lift": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Passada trás lift beach tennis"),
    videoUrl: "https://youtube.com/shorts/9qnrI7TazhE",
  },
  "Agachamento lift": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Agachamento lift beach tennis"),
    videoUrl: "https://youtube.com/shorts/lnGl8Zvv-b8",
  },
  "Remada alta + desenv potência": {
    description: "Exercicio de potencia e pliometria para beach tennis. Desenvolve explosividade e capacidade de sprint na areia.",
    youtubeSearch: yt("Remada alta desenvolvimento potência beach tennis"),
    videoUrl: "https://youtube.com/shorts/awa0BPShq6w",
  },
  "Braquiação 1": {
    description: "Exercicio de braquiacao para beach tennis. Desenvolve forca de grip, mobilidade e resistencia de membros superiores.",
    youtubeSearch: yt("Braquiação beach tennis"),
    videoUrl: "https://youtube.com/shorts/WtvliPwdE5I",
  },
  "Braquiação 2": {
    description: "Exercicio de braquiacao para beach tennis. Desenvolve forca de grip, mobilidade e resistencia de membros superiores.",
    youtubeSearch: yt("Braquiação 2 beach tennis"),
    videoUrl: "https://youtube.com/shorts/vvW1tT5PSSc",
  },
  "Braquiação 3": {
    description: "Exercicio de braquiacao para beach tennis. Desenvolve forca de grip, mobilidade e resistencia de membros superiores.",
    youtubeSearch: yt("Braquiação 3 beach tennis"),
    videoUrl: "https://youtube.com/shorts/8e0mQQxqpZU",
  },
  "Desenvolvimento com bastão (ativação)": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Desenvolvimento bastão ativação beach tennis"),
    videoUrl: "https://youtube.com/shorts/I3pn0U5Jg1A",
  },
  "Flexão + remada alternada": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Flexão remada alternada beach tennis"),
    videoUrl: "https://youtube.com/shorts/TuWteCXFKhU",
  },
  "Flexão com toque cruzado": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Flexão toque cruzado beach tennis"),
    videoUrl: "https://youtube.com/shorts/ofG4fz6gnPU",
  },
  "Empunhadura com anilha": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Empunhadura anilha grip beach tennis"),
    videoUrl: "https://youtube.com/shorts/vPmzJ7la4qs",
  },
  "Flexão + remada sproul explosivo": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Flexão remada sproul explosivo beach tennis"),
    videoUrl: "https://youtube.com/shorts/ao60W8lQ7E0",
  },
  "Bíceps + desenvolvimento unil": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Bíceps desenvolvimento unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/HX276PozcM0",
  },
  "Passada p/ trás + bíceps c/ desenvolvimento": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Passada trás bíceps desenvolvimento beach tennis"),
    videoUrl: "https://youtube.com/shorts/fOY2lBOV5Qw",
  },
  "Passada p/ trás alt + rotação de cotovelo": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Passada trás alternada rotação cotovelo beach tennis"),
    videoUrl: "https://youtube.com/shorts/rMR3u1Ntjc8",
  },
  "Sustentação iso HBC unil": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Sustentação isométrica HBC unil beach tennis"),
    videoUrl: "https://youtube.com/shorts/0PdOl7rd-F4",
  },
  "Sustentação bandeja iso HBC unil": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Sustentação bandeja HBC unil beach tennis"),
    videoUrl: "https://youtube.com/shorts/L3gRUuA15N4",
  },
  "Sustentação HBC + bíceps unil": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Sustentação HBC bíceps unil beach tennis"),
    videoUrl: "https://youtube.com/shorts/aJ4KGGqamEM",
  },
  "Sustentação HBC + punho unil": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Sustentação HBC punho unil beach tennis"),
    videoUrl: "https://youtube.com/shorts/e1aUVq0mfk4",
  },
  "Estabilização de punho e cotovelo": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Estabilização punho cotovelo beach tennis"),
    videoUrl: "https://youtube.com/shorts/NcWMyIuAgAA",
  },
  "Desenvolvimento empunhadura": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Desenvolvimento empunhadura grip beach tennis"),
    videoUrl: "https://youtube.com/shorts/3dW0hzOPHLY",
  },
  "Abdominal X-UP": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Abdominal X-UP beach tennis"),
    videoUrl: "https://youtube.com/shorts/RpxTEofKsD8",
  },
  "Abdominal X-UP alternado": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Abdominal X-UP alternado beach tennis"),
    videoUrl: "https://youtube.com/shorts/6RjFHWMhFIc",
  },
  "Abdominal com desenvolvimento": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Abdominal desenvolvimento beach tennis"),
    videoUrl: "https://youtube.com/shorts/UIJI78_xrTQ",
  },
  "Step down 1": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Step down beach tennis"),
    videoUrl: "https://youtube.com/shorts/N8_qBe9PFPM",
  },
  "Step down com chute": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Step down chute beach tennis"),
    videoUrl: "https://youtube.com/shorts/ojxlnlYeje8",
  },
  "Step down thruster": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Step down thruster beach tennis"),
    videoUrl: "https://youtube.com/shorts/hMpAjhuvGWs",
  },
  "Step down thruster 2": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Step down thruster 2 beach tennis"),
    videoUrl: "https://youtube.com/shorts/PMmrncwLbaQ",
  },
  "Step down thruster com chute": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Step down thruster chute beach tennis"),
    videoUrl: "https://youtube.com/shorts/ZVdoeR1B-70",
  },
  "Abdominal parábola unil": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Abdominal parábola unilateral beach tennis"),
    videoUrl: "https://youtube.com/shorts/1PajiBae9EI",
  },
  "Abdominal parábola unil alt": {
    description: "Exercicio de fortalecimento geral para beach tennis. Trabalha forca de preensao, cotovelo e ombro para prevencao de lesoes.",
    youtubeSearch: yt("Abdominal parábola unil alternado beach tennis"),
    videoUrl: "https://youtube.com/shorts/lhNQNPmD1Tg",
  },
  "Agachamento livre": {
    description: "Agachamento com barra nas costas (low ou high bar). Pes na largura dos ombros, descida controlada ate coxas paralelas ao chao, joelhos alinhados com os pes, lombar neutra. Exercicio composto principal para forca e hipertrofia de pernas, com transferencia para potencia de salto e mudancas de direcao no beach tennis.",
    youtubeSearch: yt("agachamento livre tecnica"),
  },
  "Desenvolvimento com halteres": {
    description: "Sentado ou em pe, halteres na altura dos ombros e palmas para frente. Empurre os halteres acima da cabeca ate a extensao total, sem trancar os cotovelos. Desca controlado em 2 segundos. Trabalha deltoides e triceps com mais amplitude e ativacao do core do que a versao na barra; menos estresse no ombro.",
    youtubeSearch: yt("desenvolvimento halteres tecnica"),
  },
  "Triceps no cabo": {
    description: "Em pe de frente para o cabo alto, cotovelos colados ao tronco. Estenda os antebracos para baixo ate a extensao total do cotovelo e retorne controlado. Mantenha os cotovelos fixos. Trabalho de isolamento do triceps com tensao constante; otimo para qualidade do bloqueio do cotovelo nos golpes do beach tennis.",
    youtubeSearch: yt("triceps cabo tecnica"),
  },
  "Leg press unilateral": {
    description: "Sentado na maquina de leg press, use apenas uma perna por vez. Pe centralizado na plataforma, joelho alinhado com o pe, descida controlada ate ~90 graus, sem soltar a lombar do encosto. Trabalha quadriceps e gluteo unilateralmente, corrigindo assimetrias e aumentando estabilidade do core.",
    youtubeSearch: yt("leg press unilateral tecnica"),
  },
  "Biceps com halteres": {
    description: "Em pe, halteres na lateral do corpo, palmas para frente. Flexione o cotovelo trazendo o halter ate a altura do ombro, sem balancar o tronco. Cotovelo fixo ao lado do corpo. Volte controlado em 2 segundos. Trabalho de isolamento do biceps; equilibra a forca de puxar.",
    youtubeSearch: yt("rosca biceps halteres tecnica"),
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
