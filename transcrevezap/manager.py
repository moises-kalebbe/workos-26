import requests
import streamlit as st
import pandas as pd
from datetime import datetime
from storage import StorageHandler
import plotly.express as px
import os
import redis
from utils import create_redis_client

# 1. Primeiro: Configuração da página
st.set_page_config(
    page_title="TranscreveZAP by Impacte AI",
    page_icon="🎙️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# 2. Depois: Inicialização do Redis
redis_client = create_redis_client()

# 3. Funções de sessão (atualizado para usar st.query_params)
def init_session():
    """Inicializa o sistema de sessão"""
    if 'session_id' not in st.session_state:
        # Verificar se existe uma sessão válida no Redis
        session_token = st.query_params.get('session', None)
        if session_token:
            session_data = redis_client.get(f"session:{session_token}")
            if session_data:
                st.session_state.session_id = session_token
                st.session_state.authenticated = True
                return
        
        # Se não houver sessão válida, gerar um novo ID
        st.session_state.session_id = None
        st.session_state.authenticated = False

# Garantir que init_session seja chamado antes de qualquer coisa
init_session()

def create_session():
    """Cria uma nova sessão no Redis"""
    import uuid
    session_id = str(uuid.uuid4())
    expiry = 7 * 24 * 60 * 60  # 7 dias em segundos
    
    # Salvar sessão no Redis
    redis_client.setex(f"session:{session_id}", expiry, "active")
    
    # Atualizar estado da sessão
    st.session_state.session_id = session_id
    st.session_state.authenticated = True
    
    # Adicionar session_id como parâmetro de URL
    st.query_params['session'] = session_id

def end_session():
    """Encerra a sessão atual"""
    if 'session_id' in st.session_state and st.session_state.session_id:
        # Remover sessão do Redis
        redis_client.delete(f"session:{st.session_state.session_id}")
    
    # Limpar todos os estados relevantes
    for key in ['session_id', 'authenticated', 'username']:
        if key in st.session_state:
            del st.session_state[key]
    
    # Remover parâmetro de sessão da URL
    if 'session' in st.query_params:
        del st.query_params['session']

# 4. Inicializar a sessão
init_session()

# Estilos CSS personalizados
st.markdown("""
<style>
    .main > div {
        padding-top: 2rem;
    }
    .stButton>button {
        width: 100%;
    }
    .stTextInput>div>div>input, .stSelectbox>div>div>select {
        font-size: 16px;
    }
    h1, h2, h3 {
        margin-bottom: 1rem;
    }
    .sidebar-header {
        font-size: 1.5rem;
        font-weight: bold;
        margin-bottom: 2rem;
    }
    .footer {
        position: fixed;
        left: 0;
        bottom: 0;
        width: 100%;
        background-color: #000000;
        color: #ffffff;
        text-align: center;
        padding: 10px 0;
        font-size: 14px;
    }
    .footer a {
        color: #ffffff;
        text-decoration: underline;
    }
    @media (max-width: 768px) {
        .main > div {
            padding-top: 1rem;
        }
        .sidebar-header {
            font-size: 1.2rem;
        }
    }
</style>
""", unsafe_allow_html=True)

# Configuração do storage
storage = StorageHandler()

CONFIG_KEY_MAP = {
    "GROQ_API_KEY": "groq_api_key",
    "BUSINESS_MESSAGE": "business_message",
    "PROCESS_GROUP_MESSAGES": "process_group_messages",
    "PROCESS_SELF_MESSAGES": "process_self_messages",
    "TRANSCRIPTION_LANGUAGE": "transcription_language",
    "ACTIVE_LLM_PROVIDER": "active_llm_provider",
    "OPENAI_API_KEY": "openai_api_key",
}


def normalize_config_key(key):
    return CONFIG_KEY_MAP.get(key, key)

# Dicionário de idiomas em português
IDIOMAS = {
    "pt": "Português",
    "en": "Inglês",
    "es": "Espanhol",
    "fr": "Francês",
    "de": "Alemão",
    "it": "Italiano",
    "ja": "Japonês",
    "ko": "Coreano",
    "zh": "Chinês",
    "ro": "Romeno",
    "ru": "Russo",
    "ar": "Árabe",
    "hi": "Hindi",
    "nl": "Holandês",
    "pl": "Polonês",
    "tr": "Turco"
}

# Função para salvar configurações no Redis
def save_to_redis(key, value):
    try:
        storage.set_config_value(normalize_config_key(key), value)
        st.success(f"Configuração {key} salva com sucesso!")
    except Exception as e:
        st.error(f"Erro ao salvar no Redis: {key} -> {e}")

# Função para buscar configurações no Redis
def get_from_redis(key, default=None):
    try:
        return storage.get_config_value(normalize_config_key(key), default)
    except Exception as e:
        st.error(f"Erro ao buscar no Redis: {key} -> {e}")
        return default
# Função para buscar grupos do Whatsapp
def fetch_whatsapp_groups(server_url, instance, api_key):
    url = f"{server_url}/group/fetchAllGroups/{instance}"
    headers = {"apikey": api_key}
    params = {"getParticipants": "false"}  # Adicionando o parâmetro de query
    
    try:
        st.write(f"Requisição para URL: {url}")  # Debug para URL
        st.write(f"Cabeçalhos: {headers}")  # Debug para headers
        st.write(f"Parâmetros: {params}")  # Debug para parâmetros
        
        response = requests.get(url, headers=headers, params=params)
        st.write(f"Status Code: {response.status_code}")  # Debug para status HTTP
        
        response.raise_for_status()  # Levanta exceções HTTP
        return response.json()  # Retorna o JSON da resposta
    except requests.RequestException as e:
        st.error(f"Erro ao buscar grupos: {str(e)}")
        if response.text:
            st.error(f"Resposta do servidor: {response.text}")
        return []

# Função para carregar configurações do Redis para o Streamlit
def load_settings():
    try:
        st.session_state.settings = {
            "GROQ_API_KEY": get_from_redis("GROQ_API_KEY", ""),
            "BUSINESS_MESSAGE": get_from_redis("BUSINESS_MESSAGE", "*Impacte AI* Premium Services"),
            "PROCESS_GROUP_MESSAGES": get_from_redis("PROCESS_GROUP_MESSAGES", "false"),
            "PROCESS_SELF_MESSAGES": get_from_redis("PROCESS_SELF_MESSAGES", "true"),
            "TRANSCRIPTION_LANGUAGE": get_from_redis("TRANSCRIPTION_LANGUAGE", "pt"),
        }
    except Exception as e:
        st.error(f"Erro ao carregar configurações do Redis: {e}")

# Carregar configurações na sessão, se necessário
if "settings" not in st.session_state:
    load_settings()

# Função para salvar configurações do Streamlit no Redis
def save_settings():
    try:
        save_to_redis("GROQ_API_KEY", st.session_state.groq_api_key)
        save_to_redis("BUSINESS_MESSAGE", st.session_state.business_message)
        save_to_redis("PROCESS_GROUP_MESSAGES", st.session_state.process_group_messages)
        save_to_redis("PROCESS_SELF_MESSAGES", st.session_state.process_self_messages)
        st.success("Configurações salvas com sucesso!")
    except Exception as e:
        st.error(f"Erro ao salvar configurações: {e}")

def show_logo():
    try:
        logo_path = os.path.join(os.path.dirname(__file__), "static", "fluxo.png")
        if os.path.exists(logo_path):
            col1, col2, col3 = st.columns([1, 2, 1])
            with col2:
                st.image(logo_path, width=400, use_column_width=True)  # Aumentado e responsivo
        else:
            st.warning("Logo não encontrada.")
    except Exception as e:
        st.error(f"Erro ao carregar logo: {e}")

def show_footer():
    st.markdown(
        """
        <div class="footer" style="text-align: center; margin-top: 50px;">
            <p>Desenvolvido por <a href="https://impacte.ai" target="_blank">Impacte AI</a> | 
            Código fonte no <a href="https://github.com/impacte-ai/transcrevezap" target="_blank">GitHub</a></p>
        </div>
        """,
        unsafe_allow_html=True,
    )

def login_page():
    show_logo()
    st.markdown("<h3 style='text-align: center; margin-bottom: 1rem; font-size: 1.2em;'>TranscreveZAP</h3>", unsafe_allow_html=True)
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        with st.form("login_form"):
            st.markdown("<h2 style='text-align: center; margin-bottom: 1rem;'>Login</h2>", unsafe_allow_html=True)
            username = st.text_input('Usuário', key='username')
            password = st.text_input('Senha', type='password', key='password')
            submit_button = st.form_submit_button('Entrar')
            if submit_button:
                if username == os.getenv('MANAGER_USER') and password == os.getenv('MANAGER_PASSWORD'):
                    create_session()
                    st.success("Login realizado com sucesso!")
                    st.experimental_rerun()
                else:
                    st.error('Credenciais inválidas')

# Modificar a função de logout no dashboard
def dashboard():
    # Versão do sistema
    APP_VERSION = "2.3.3"
    
    show_logo()
    st.sidebar.markdown('<div class="sidebar-header">TranscreveZAP - Menu</div>', unsafe_allow_html=True)
    st.sidebar.markdown(f'<div style="text-align: center; color: gray; font-size: 0.8em;">versão {APP_VERSION}</div>', unsafe_allow_html=True)
    
    # Mostrar nome do usuário logado (se disponível)
    if hasattr(st.session_state, 'session_id'):
        st.sidebar.markdown("---")
        st.sidebar.markdown("👤 **Usuário Conectado**")
    
    page = st.sidebar.radio(
        "Navegação",
        ["📊 Painel de Controle", "👥 Gerenciar Grupos", "🔄 Hub de Redirecionamento", "🚫 Gerenciar Bloqueios", "⚙️ Configurações"]
    )
    
    # Seção de logout com confirmação
    st.sidebar.markdown("---")
    logout_container = st.sidebar.container()
    
    # Verifica se já existe um estado para confirmação de logout
    if 'logout_confirmation' not in st.session_state:
        st.session_state.logout_confirmation = False
    
    # Botão principal de logout
    if not st.session_state.logout_confirmation:
        if logout_container.button("🚪 Sair da Conta"):
            st.session_state.logout_confirmation = True
            st.experimental_rerun()
    
    # Botões de confirmação
    if st.session_state.logout_confirmation:
        col1, col2 = st.sidebar.columns(2)
        
        if col1.button("✅ Confirmar"):
            st.session_state.logout_confirmation = False
            end_session()
            st.experimental_rerun()
        
        if col2.button("❌ Cancelar"):
            st.session_state.logout_confirmation = False
            st.experimental_rerun()

    # Renderiza a página selecionada
    if page == "📊 Painel de Controle":
        show_statistics()
    elif page == "👥 Gerenciar Grupos":
        manage_groups()
    elif page == "🔄 Hub de Redirecionamento":
        manage_webhooks()
    elif page == "🚫 Gerenciar Bloqueios":
        manage_blocks()
    elif page == "⚙️ Configurações":
        manage_settings()

def show_statistics():
    st.title("📊 Painel de Controle")
    try:
        stats = storage.get_statistics()
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Total de Áudios Processados", stats.get("total_processed", 0))
        with col2:
            last_processed = stats.get("last_processed", "Nunca")
            st.metric("Último Processamento", last_processed)
        with col3:
            total_groups = len(storage.get_allowed_groups())
            st.metric("Grupos Permitidos", total_groups)

        daily_data = stats["stats"]["daily_count"]
        if daily_data:
            df = pd.DataFrame(list(daily_data.items()), columns=['Data', 'Processamentos'])
            df['Data'] = pd.to_datetime(df['Data'])
            fig = px.line(df, x='Data', y='Processamentos', title='Processamentos por Dia')
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("Ainda não há dados de processamento disponíveis.")

        # Adicionar informações sobre o endpoint da API
        st.subheader("Endpoint da API")
        api_domain = get_from_redis("API_DOMAIN", "seu.dominio.com")
        api_endpoint = f"https://{api_domain}/transcreve-audios"
        st.code(api_endpoint, language="text")

        if st.button("ℹ️ Instruções de Uso"):
            st.info(
                "Para utilizar o serviço de transcrição, siga estas etapas:\n\n"
                "1. Copie a URL completa acima.\n"
                "2. Na configuração de webhook da Evolution API:\n"
                "   - Cole a URL no campo apropriado.\n"
                "   - Ative o webhook.\n"
                "   - Marque as opções 'Webhook Base64' e o Evento 'MESSAGES_UPSERT'.\n\n"
                "Isso permitirá que a Evolution API envie as mensagens de áudio para o nosso serviço de transcrição."
            )

    except Exception as e:
        st.error(f"Erro ao carregar estatísticas: {e}")

def manage_groups():
    st.title("👥 Gerenciar Grupos")

    # Campos para inserção dos dados da API
    st.subheader("Configuração da API Evolution")
    col1, col2, col3 = st.columns(3)
    with col1:
        server_url = st.text_input("URL do Servidor", value=get_from_redis("EVOLUTION_API_URL", ""))
    with col2:
        instance = st.text_input("Instância", value=get_from_redis("EVOLUTION_INSTANCE", ""))
    with col3:
        api_key = st.text_input("API Key", value=get_from_redis("EVOLUTION_API_KEY", ""), type="password")

    if st.button("Salvar Configurações da API"):
        save_to_redis("EVOLUTION_API_URL", server_url)
        save_to_redis("EVOLUTION_INSTANCE", instance)
        save_to_redis("EVOLUTION_API_KEY", api_key)
        st.success("Configurações da API salvas com sucesso!")

    # Busca e exibição de grupos do WhatsApp
    if server_url and instance and api_key:
        if st.button("Buscar Grupos do WhatsApp"):
            with st.spinner('Buscando grupos...'):
                groups = fetch_whatsapp_groups(server_url, instance, api_key)
                if groups:
                    st.session_state.whatsapp_groups = groups
                    st.success(f"{len(groups)} grupos carregados com sucesso!")
                else:
                    st.warning("Nenhum grupo encontrado ou erro ao buscar grupos.")

        if 'whatsapp_groups' in st.session_state:
            st.subheader("Grupos do WhatsApp")
            search_term = st.text_input("Buscar grupos", "")
            filtered_groups = [group for group in st.session_state.whatsapp_groups if search_term.lower() in group['subject'].lower()]
            
            for group in filtered_groups:
                col1, col2 = st.columns([4, 1])
                with col1:
                    st.text(f"{group['subject']} ({group['id']})")
                with col2:
                    is_allowed = group['id'] in storage.get_allowed_groups()
                    if st.checkbox("Permitir", value=is_allowed, key=f"allow_{group['id']}"):
                        if not is_allowed:
                            storage.add_allowed_group(group['id'])
                            st.success(f"Grupo {group['subject']} permitido!")
                    else:
                        if is_allowed:
                            storage.remove_allowed_group(group['id'])
                            st.success(f"Grupo {group['subject']} removido!")
    else:
        st.info("Por favor, insira as configurações da API Evolution para buscar os grupos.")

    # Adicionar grupo manualmente
    st.subheader("Adicionar Grupo Manualmente")
    new_group = st.text_input("Número do Grupo", placeholder="Ex: 5521999999999")
    if st.button("Adicionar"):
        formatted_group = f"{new_group}@g.us"
        storage.add_allowed_group(formatted_group)
        st.success(f"Grupo {formatted_group} adicionado com sucesso!")
        st.experimental_rerun()

    # Lista de grupos permitidos
    st.subheader("Grupos Permitidos")
    allowed_groups = storage.get_allowed_groups()
    if allowed_groups:
        for group in allowed_groups:
            col1, col2 = st.columns([4, 1])
            with col1:
                st.text(group)
            with col2:
                if st.button("Remover", key=f"remove_{group}"):
                    storage.remove_allowed_group(group)
                    st.success(f"Grupo {group} removido!")
                    st.experimental_rerun()
    else:
        st.info("Nenhum grupo permitido.")

def manage_webhooks():
    st.title("🔄 Hub de Redirecionamento")
    st.markdown("""
        Configure aqui os webhooks para onde você deseja redirecionar as mensagens recebidas.
        Cada webhook receberá uma cópia exata do payload original da Evolution API.
    """)
    
    # Adicionar novo webhook
    st.subheader("Adicionar Novo Webhook")
    with st.form("add_webhook"):
        col1, col2 = st.columns([3, 1])
        with col1:
            webhook_url = st.text_input(
                "URL do Webhook",
                placeholder="https://seu-sistema.com/webhook"
            )
        with col2:
            if st.form_submit_button("🔍 Testar Conexão"):
                if webhook_url:
                    with st.spinner("Testando webhook..."):
                        success, message = storage.test_webhook(webhook_url)
                        if success:
                            st.success(message)
                        else:
                            st.error(message)
                else:
                    st.warning("Por favor, insira uma URL válida")
                    
        webhook_description = st.text_input(
            "Descrição",
            placeholder="Ex: URL de Webhook do N8N, Sistema de CRM, etc."
        )
        
        if st.form_submit_button("Adicionar Webhook"):
            if webhook_url:
                try:
                    # Testar antes de adicionar
                    success, message = storage.test_webhook(webhook_url)
                    if success:
                        storage.add_webhook_redirect(webhook_url, webhook_description)
                        st.success("✅ Webhook testado e adicionado com sucesso!")
                        st.experimental_rerun()
                    else:
                        st.error(f"Erro ao adicionar webhook: {message}")
                except Exception as e:
                    st.error(f"Erro ao adicionar webhook: {str(e)}")
            else:
                st.warning("Por favor, insira uma URL válida")
    
    # Listar webhooks existentes
    st.subheader("Webhooks Configurados")
    webhooks = storage.get_webhook_redirects()
    
    if not webhooks:
        st.info("Nenhum webhook configurado ainda.")
        return
        
    for webhook in webhooks:
        # Obter métricas de saúde
        health = storage.get_webhook_health(webhook["id"])
        
        # Definir cor baseada no status
        status_colors = {
            "healthy": "🟢",
            "warning": "🟡",
            "critical": "🔴",
            "unknown": "⚪"
        }
        
        status_icon = status_colors.get(health["health_status"], "⚪")
        
        with st.expander(
            f"{status_icon} {webhook['description'] or webhook['url']}",
            expanded=True
        ):
            col1, col2 = st.columns([3, 1])
            
            with col1:
                st.text_input(
                    "URL",
                    value=webhook["url"],
                    key=f"url_{webhook['id']}",
                    disabled=True
                )
                if webhook["description"]:
                    st.text_input(
                        "Descrição",
                        value=webhook["description"],
                        key=f"desc_{webhook['id']}",
                        disabled=True
                    )
            
            with col2:
                # Métricas de saúde
                st.metric(
                    "Taxa de Sucesso",
                    f"{health['success_rate']:.1f}%"
                )
                
                # Alertas baseados na saúde
                if health["health_status"] == "critical":
                    st.error("⚠️ Taxa de erro crítica!")
                elif health["health_status"] == "warning":
                    st.warning("⚠️ Taxa de erro elevada")
                
                # Botões de ação
                col1, col2 = st.columns(2)
                with col1:
                    if st.button("🔄 Retry", key=f"retry_{webhook['id']}"):
                        failed_deliveries = storage.get_failed_deliveries(webhook["id"])
                        if failed_deliveries:
                            with st.spinner("Reenviando mensagens..."):
                                success_count = 0
                                for delivery in failed_deliveries:
                                    if storage.retry_webhook(webhook["id"], delivery["payload"]):
                                        success_count += 1
                                st.success(f"Reenviadas {success_count} de {len(failed_deliveries)} mensagens!")
                        else:
                            st.info("Não há mensagens pendentes para reenvio")
                
                with col2:
                    if st.button("🗑️", key=f"remove_{webhook['id']}", help="Remover webhook"):
                        if st.session_state.get(f"confirm_remove_{webhook['id']}", False):
                            storage.remove_webhook_redirect(webhook["id"])
                            st.success("Webhook removido!")
                            st.experimental_rerun()
                        else:
                            st.session_state[f"confirm_remove_{webhook['id']}"] = True
                            st.warning("Clique novamente para confirmar")
            
            # Estatísticas detalhadas
            st.markdown("### Estatísticas")
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Total de Sucessos", webhook["success_count"])
            with col2:
                st.metric("Total de Erros", webhook["error_count"])
            with col3:
                last_success = webhook.get("last_success")
                if last_success:
                    last_success = datetime.fromisoformat(last_success).strftime("%d/%m/%Y %H:%M")
                st.metric("Último Sucesso", last_success or "Nunca")
            
            # Exibir último erro (se houver)
            if webhook.get("last_error"):
                st.error(
                    f"Último erro: {webhook['last_error']['message']} "
                    f"({datetime.fromisoformat(webhook['last_error']['timestamp']).strftime('%d/%m/%Y %H:%M')})"
                )
                
            # Lista de entregas falhas
            failed_deliveries = storage.get_failed_deliveries(webhook["id"])
            if failed_deliveries:
                st.markdown("### Entregas Pendentes")
                st.warning(f"{len(failed_deliveries)} mensagens aguardando reenvio")
                if st.button("📋 Ver Detalhes", key=f"details_{webhook['id']}"):
                    for delivery in failed_deliveries:
                        st.code(json.dumps(delivery, indent=2))

def manage_blocks():
    st.title("🚫 Gerenciar Bloqueios")
    st.subheader("Bloquear Usuário")
    col1, col2 = st.columns([3, 1])
    with col1:
        new_user = st.text_input("Número do Usuário", placeholder="Ex: 5521999999999")
    with col2:
        if st.button("Bloquear"):
            formatted_user = f"{new_user}@s.whatsapp.net"
            storage.add_blocked_user(formatted_user)
            st.success(f"Usuário {formatted_user} bloqueado!")
            st.experimental_rerun()

    st.subheader("Usuários Bloqueados")
    blocked_users = storage.get_blocked_users()
    if blocked_users:
        for user in blocked_users:
            col1, col2 = st.columns([4, 1])
            with col1:
                st.text(user)
            with col2:
                if st.button("Desbloquear", key=f"unblock_{user}"):
                    storage.remove_blocked_user(user)
                    st.success(f"Usuário {user} desbloqueado!")
                    st.experimental_rerun()
    else:
        st.info("Nenhum usuário bloqueado.")

# manager.py - Adicionar na seção de configurações
def message_settings_section():
    st.subheader("📝 Configurações de Mensagem")
    
    # Carregar configurações atuais
    message_settings = storage.get_message_settings()
    
    # Headers personalizados
    col1, col2 = st.columns(2)
    with col1:
        summary_header = st.text_input(
            "Cabeçalho do Resumo",
            value=message_settings["summary_header"],
            help="Formato do cabeçalho para o resumo do áudio"
        )
    with col2:
        transcription_header = st.text_input(
            "Cabeçalho da Transcrição",
            value=message_settings["transcription_header"],
            help="Formato do cabeçalho para a transcrição do áudio"
        )
    
    # Modo de saída
    output_mode = st.selectbox(
        "Modo de Saída",
        options=["both", "summary_only", "transcription_only", "smart"],
        format_func=lambda x: {
            "both": "Resumo e Transcrição",
            "summary_only": "Apenas Resumo",
            "transcription_only": "Apenas Transcrição",
            "smart": "Modo Inteligente (baseado no tamanho)"
        }[x],
        value=message_settings["output_mode"]
    )
    
    # Configuração do limite de caracteres (visível apenas no modo inteligente)
    if output_mode == "smart":
        character_limit = st.number_input(
            "Limite de Caracteres para Modo Inteligente",
            min_value=100,
            max_value=5000,
            value=int(message_settings["character_limit"]),
            help="Se a transcrição exceder este limite, será enviado apenas o resumo"
        )
    else:
        character_limit = message_settings["character_limit"]
    
    # Botão de salvar
    if st.button("💾 Salvar Configurações de Mensagem"):
        try:
            new_settings = {
                "summary_header": summary_header,
                "transcription_header": transcription_header,
                "output_mode": output_mode,
                "character_limit": character_limit
            }
            storage.save_message_settings(new_settings)
            st.success("Configurações de mensagem salvas com sucesso!")
        except Exception as e:
            st.error(f"Erro ao salvar configurações: {str(e)}")

def show_language_statistics():
    """Exibe estatísticas de uso de idiomas"""
    stats = storage.get_language_statistics()
    
    if not stats:
        st.info("Ainda não há estatísticas de uso de idiomas.")
        return
    
    # Resumo geral
    st.subheader("📊 Estatísticas de Idiomas")
    
    # Criar métricas resumidas
    total_usage = sum(s.get('total', 0) for s in stats.values())
    auto_detected = sum(s.get('auto_detected', 0) for s in stats.values())
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Total de Transcrições", total_usage)
    with col2:
        st.metric("Detecções Automáticas", auto_detected)
    with col3:
        st.metric("Idiomas Diferentes", len(stats))
    
    # Gráfico de uso por idioma
    usage_data = []
    for lang, data in stats.items():
        usage_data.append({
            'Idioma': IDIOMAS.get(lang, lang),
            'Total': data.get('total', 0),
            'Enviados': data.get('sent', 0),
            'Recebidos': data.get('received', 0),
            'Auto-detectados': data.get('auto_detected', 0)
        })
    
    if usage_data:
        df = pd.DataFrame(usage_data)
        
        # Gráfico de barras empilhadas
        fig = px.bar(df, 
                    x='Idioma',
                    y=['Enviados', 'Recebidos'],
                    title='Uso por Idioma',
                    barmode='stack')
        st.plotly_chart(fig, use_container_width=True)
        
        # Tabela detalhada
        st.subheader("📋 Detalhamento por Idioma")
        st.dataframe(df.sort_values('Total', ascending=False))

def manage_settings():
    st.title("⚙️ Configurações")
    
    # Criar tabs para melhor organização
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "🔑 Chaves API",
        "🤖 Provedor LLM",
        "🌐 Configurações Gerais",
        "📝 Formatação de Mensagens",
        "🗣️ Idiomas e Transcrição"
    ])
    
    with tab1:
        st.subheader("Gerenciamento de Chaves GROQ")
    # Campo para gerenciamento de chaves GROQ
        main_key = st.text_input(
            "GROQ API Key Principal",
            value=st.session_state.settings["GROQ_API_KEY"],
            key="groq_api_key",
            type="password",
            help="Chave GROQ principal do sistema"
        )

        # Seção de chaves adicionais
        st.markdown("---")
        st.subheader("Chaves GROQ Adicionais (Sistema de Rodízio)")
    
        # Exibir chaves existentes
        groq_keys = storage.get_groq_keys()
        if groq_keys:
            st.write("Chaves configuradas para rodízio:")
            for key in groq_keys:
                col1, col2 = st.columns([4, 1])
                with col1:
                    masked_key = f"{key[:10]}...{key[-4:]}"
                    st.code(masked_key, language=None)
                with col2:
                    if st.button("🗑️", key=f"remove_{key}", help="Remover esta chave"):
                        storage.remove_groq_key(key)
                        st.success(f"Chave removida do rodízio!")
                        st.experimental_rerun()

        # Adicionar nova chave
        new_key = st.text_input(
            "Adicionar Nova Chave GROQ",
            key="new_groq_key",
            type="password",
            help="Insira uma nova chave GROQ para adicionar ao sistema de rodízio"
        )
        col1, col2 = st.columns([4, 1])
        with col1:
            if st.button("➕ Adicionar ao Rodízio", help="Adicionar esta chave ao sistema de rodízio"):
                if new_key:
                    if new_key.startswith("gsk_"):
                        storage.add_groq_key(new_key)
                        st.success("Nova chave adicionada ao sistema de rodízio!")
                        st.experimental_rerun()
                    else:
                        st.error("Chave inválida! A chave deve começar com 'gsk_'")
                else:
                    st.warning("Por favor, insira uma chave válida")
        pass
    
    with tab2:
        st.subheader("Configuração do Provedor LLM")
        
        # Select provider
        current_provider = storage.get_llm_provider()
        provider = st.selectbox(
            "Provedor de Serviço",
            options=["groq", "openai"],
            format_func=lambda x: "Groq (Open Source)" if x == "groq" else "OpenAI (API Paga)",
            index=0 if current_provider == "groq" else 1
        )
        
        if provider == "openai":
            st.info("""
            A OpenAI é um serviço pago que requer uma chave API válida.
            Obtenha sua chave em https://platform.openai.com
            """)
            
            # OpenAI Key Management
            openai_key = st.text_input(
                "OpenAI API Key",
                type="password",
                help="Chave que começa com 'sk-'"
            )
            
            if st.button("Adicionar Chave OpenAI"):
                if openai_key and openai_key.startswith("sk-"):
                    storage.add_openai_key(openai_key)
                    st.success("✅ Chave OpenAI adicionada com sucesso!")
                else:
                    st.error("Chave inválida! Deve começar com 'sk-'")
                    
        # Save provider selection
        if st.button("💾 Salvar Configuração do Provedor"):
            try:
                storage.set_llm_provider(provider)
                st.success(f"Provedor alterado para: {provider}")
            except Exception as e:
                st.error(f"Erro ao salvar provedor: {str(e)}")
    
    with tab3:
        st.subheader("Configurações do Sistema")
    
        # Business Message
        st.text_input(
            "Mensagem de Serviço no Rodapé",
            value=st.session_state.settings["BUSINESS_MESSAGE"],
            key="business_message"
        )
        
        # Process Group Messages
        st.selectbox(
            "Processar Mensagens em Grupos",
            options=["true", "false"],
            index=["true", "false"].index(st.session_state.settings["PROCESS_GROUP_MESSAGES"]),
            key="process_group_messages"
        )
        
        # Process Self Messages
        st.selectbox(
            "Processar Mensagens Próprias",
            options=["true", "false"],
            index=["true", "false"].index(st.session_state.settings["PROCESS_SELF_MESSAGES"]),
            key="process_self_messages"
        )

        st.subheader("🔄 Modo de Processamento")
        # Obter o modo atual do Redis
        current_mode = storage.get_process_mode()
        # Definir as opções e seus rótulos
        mode_options = ["all", "groups_only"]
        mode_labels = {
            "all": "Todos (Grupos e Privado)",
            "groups_only": "Apenas Grupos"
        }
        # Calcular o índice atual baseado no valor do Redis
        current_index = mode_options.index(current_mode) if current_mode in mode_options else 0

        process_mode = st.selectbox(
            "Processar mensagens de:",
            options=mode_options,
            format_func=lambda x: mode_labels[x],
            index=current_index,
            key="process_mode",
            help="Escolha se deseja processar mensagens de todos os contatos ou apenas de grupos"
        )

        # Configuração de idioma
        st.markdown("---")
        st.subheader("🌐 Idioma")
        # Carregar configuração atual de idioma
        current_language = get_from_redis("TRANSCRIPTION_LANGUAGE", "pt")
        
        # Seleção de idioma
        selected_language = st.selectbox(
            "Idioma para Transcrição e Resumo",
            options=list(IDIOMAS.keys()),
            format_func=lambda x: IDIOMAS[x],
            index=list(IDIOMAS.keys()).index(current_language) if current_language in IDIOMAS else 0,
            help="Selecione o idioma para transcrição dos áudios e geração dos resumos",
            key="transcription_language"
        )
        pass
    
    with tab4:
        st.subheader("Formatação de Mensagens")
        
        # Headers personalizados
        col1, col2 = st.columns(2)
        with col1:
            summary_header = st.text_input(
                "Cabeçalho do Resumo",
                value=get_from_redis("summary_header", "🤖 *Resumo do áudio:*"),
                key="summary_header",
                help="Formato do cabeçalho para o resumo do áudio"
            )
        with col2:
            transcription_header = st.text_input(
                "Cabeçalho da Transcrição",
                value=get_from_redis("transcription_header", "🔊 *Transcrição do áudio:*"),
                key="transcription_header",
                help="Formato do cabeçalho para a transcrição do áudio"
            )
        
        # Modo de saída - Corrigido para usar index
        output_modes = ["both", "summary_only", "transcription_only", "smart"]
        output_mode_labels = {
            "both": "Resumo e Transcrição",
            "summary_only": "Apenas Resumo",
            "transcription_only": "Apenas Transcrição",
            "smart": "Modo Inteligente (baseado no tamanho)"
        }
        
        current_mode = get_from_redis("output_mode", "both")
        mode_index = output_modes.index(current_mode) if current_mode in output_modes else 0
        
        output_mode = st.selectbox(
            "Modo de Saída",
            options=output_modes,
            format_func=lambda x: output_mode_labels[x],
            index=mode_index,
            key="output_mode",
            help="Selecione como deseja que as mensagens sejam enviadas"
        )
        
        if output_mode == "smart":
            character_limit = st.number_input(
                "Limite de Caracteres para Modo Inteligente",
                min_value=100,
                max_value=5000,
                value=int(get_from_redis("character_limit", "500")),
                help="Se a transcrição exceder este limite, será enviado apenas o resumo"
            )

    # Botão de salvar unificado
    if st.button("💾 Salvar Todas as Configurações"):
        try:
            # Salvar configurações existentes
            save_settings()
            
            # Salvar novas configurações de mensagem
            save_to_redis("summary_header", summary_header)
            save_to_redis("transcription_header", transcription_header)
            save_to_redis("output_mode", output_mode)
            if output_mode == "smart":
                save_to_redis("character_limit", str(character_limit))
                
            # Se há uma chave principal, adicionar ao sistema de rodízio
            if main_key and main_key.startswith("gsk_"):
                storage.add_groq_key(main_key)
            
            # Salvar configuração de idioma
            save_to_redis("TRANSCRIPTION_LANGUAGE", selected_language)
            
            # Salvamento do modo de processamento
            storage.redis.set(storage._get_redis_key("process_mode"), process_mode)
            
            st.success("✅ Todas as configurações foram salvas com sucesso!")
            
            # Mostrar resumo
            total_keys = len(storage.get_groq_keys())
            st.info(f"""Sistema configurado com {total_keys} chave(s) GROQ no rodízio
                    Idioma definido: {IDIOMAS[selected_language]}
                    Modo de saída: {output_mode_labels[output_mode]}""")
            
        except Exception as e:
            st.error(f"Erro ao salvar configurações: {str(e)}")

    
    with tab5:
        st.subheader("Idiomas e Transcrição")
        
        # Adicionar estatísticas no topo
        show_language_statistics()
        
        # Seção de Detecção Automática
        st.markdown("---")
        st.markdown("### 🔄 Detecção Automática de Idioma")
        
        col1, col2 = st.columns(2)
        with col1:
            auto_detect = st.toggle(
                "Ativar detecção automática",
                value=storage.get_auto_language_detection(),
                help="Detecta e configura automaticamente o idioma dos contatos"
            )
        
        if auto_detect:
            st.info("""
            A detecção automática de idioma:
            1. Analisa o primeiro áudio de cada contato
            2. Configura o idioma automaticamente
            3. Usa cache de 24 horas para otimização
            4. Funciona apenas em conversas privadas
            5. Mantém o idioma global para grupos
            6. Permite tradução automática entre idiomas
            """)
        
        # Seção de Timestamps
        st.markdown("---")
        st.markdown("### ⏱️ Timestamps na Transcrição")
        use_timestamps = st.toggle(
            "Incluir timestamps",
            value=get_from_redis("use_timestamps", "false") == "true",
            help="Adiciona marcadores de tempo em cada trecho"
        )
        
        if use_timestamps:
            st.info("Os timestamps serão mostrados no formato [MM:SS] para cada trecho da transcrição")
        
        # Seção de Configuração Manual de Idiomas por Contato
        st.markdown("---")
        st.markdown("### 👥 Idiomas por Contato")
        
        # Obter contatos configurados
        contact_languages = storage.get_all_contact_languages()
        
        # Adicionar novo contato
        with st.expander("➕ Adicionar Novo Contato", expanded=not bool(contact_languages)):
            new_contact = st.text_input(
                "Número do Contato",
                placeholder="Ex: 5521999999999",
                help="Digite apenas números, sem símbolos ou @s.whatsapp.net"
            )
            
            new_language = st.selectbox(
                "Idioma do Contato",
                options=list(IDIOMAS.keys()),
                format_func=lambda x: IDIOMAS[x],
                help="Idioma para transcrição dos áudios deste contato"
            )
            
            if st.button("Adicionar Contato"):
                if new_contact and new_contact.isdigit():
                    storage.set_contact_language(new_contact, new_language)
                    st.success(f"✅ Contato configurado com idioma {IDIOMAS[new_language]}")
                    st.experimental_rerun()
                else:
                    st.error("Por favor, insira um número válido")
        
        # Listar contatos configurados
        if contact_languages:
            st.markdown("### Contatos Configurados")
            for contact, language in contact_languages.items():
                col1, col2, col3 = st.columns([2, 2, 1])
                with col1:
                    st.text(f"+{contact}")
                with col2:
                    current_language = st.selectbox(
                        "Idioma",
                        options=list(IDIOMAS.keys()),
                        format_func=lambda x: IDIOMAS[x],
                        key=f"lang_{contact}",
                        index=list(IDIOMAS.keys()).index(language) if language in IDIOMAS else 0
                    )
                    if current_language != language:
                        storage.set_contact_language(contact, current_language)
                with col3:
                    if st.button("🗑️", key=f"remove_{contact}"):
                        storage.remove_contact_language(contact)
                        st.success("Contato removido")
                        st.experimental_rerun()
        
        # Botão de Salvar
        if st.button("💾 Salvar Configurações de Idioma e Transcrição"):
            try:
                storage.set_auto_language_detection(auto_detect)
                save_to_redis("use_timestamps", str(use_timestamps).lower())
                st.success("✅ Configurações salvas com sucesso!")
                
                # Mostrar resumo das configurações
                st.info(f"""
                Configurações atuais:
                - Detecção automática: {'Ativada' if auto_detect else 'Desativada'}
                - Timestamps: {'Ativados' if use_timestamps else 'Desativados'}
                - Contatos configurados: {len(contact_languages)}
                """)
            except Exception as e:
                st.error(f"Erro ao salvar configurações: {str(e)}")
                
# Adicionar no início da execução principal
if __name__ == "__main__":
    init_session()

# Modificar a parte final do código
if st.session_state.authenticated:
    dashboard()
else:
    login_page()

show_footer()
