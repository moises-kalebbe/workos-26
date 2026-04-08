#!/bin/bash

# Função para construir o comando redis-cli com autenticação condicional
build_redis_cli_cmd() {
    cmd="redis-cli -h ${REDIS_HOST:-localhost} -p ${REDIS_PORT:-6380}"
    
    if [ ! -z "$REDIS_USERNAME" ]; then
        cmd="$cmd --user $REDIS_USERNAME"
    fi
    
    if [ ! -z "$REDIS_PASSWORD" ]; then
        cmd="$cmd -a $REDIS_PASSWORD"
    fi
    
    if [ ! -z "$REDIS_DB" ]; then
        cmd="$cmd -n $REDIS_DB"
    fi
    
    echo "$cmd"
}

# Função para inicializar configurações no Redis
initialize_redis_config() {
    redis_cmd=$(build_redis_cli_cmd)
    
    $redis_cmd SET transcrevezap:active_llm_provider "groq" NX
    $redis_cmd SET transcrevezap:business_message "*Impacte AI* Premium Services" NX
    $redis_cmd SET transcrevezap:process_group_messages "false" NX
    $redis_cmd SET transcrevezap:process_self_messages "true" NX
    $redis_cmd SET transcrevezap:transcription_language "pt" NX
    $redis_cmd SET transcrevezap:summary_header "🤖 *Resumo do áudio:*" NX
    $redis_cmd SET transcrevezap:transcription_header "🔊 *Transcrição do áudio:*" NX
    $redis_cmd SET transcrevezap:output_mode "both" NX
    $redis_cmd SET transcrevezap:character_limit "500" NX
    $redis_cmd SET transcrevezap:use_timestamps "false" NX
    $redis_cmd SET transcrevezap:process_mode "all" NX
    $redis_cmd SET transcrevezap:debug_mode "${DEBUG_MODE:-false}" NX
    $redis_cmd SET transcrevezap:api_domain "$API_DOMAIN" NX
}

# Aguardar o Redis estar pronto
echo "Aguardando o Redis ficar disponível..."
redis_cmd=$(build_redis_cli_cmd)

until $redis_cmd PING 2>/dev/null; do
  echo "Redis não está pronto - aguardando..."
  sleep 5
done

echo "Redis disponível!"

# Inicializar configurações
initialize_redis_config

# Iniciar o FastAPI em background
uvicorn main:app --host 0.0.0.0 --port 8005 &

# Iniciar o Streamlit
streamlit run manager.py --server.address 0.0.0.0 --server.port 8501

# Manter o script rodando
wait
