import base64
import os
import tempfile

import aiohttp
from fastapi import HTTPException

from groq_handler import (
    get_working_groq_key,
    handle_groq_request,
    validate_transcription_response,
)
from openai_handler import handle_openai_request
from storage import StorageHandler

storage = StorageHandler()


def _get_language_setting():
    language = storage.get_transcription_language()
    storage.add_log("DEBUG", "Idioma configurado recuperado", {"language": language})
    return language


async def _resolve_provider_request(provider: str, url: str, headers: dict, payload, is_form_data: bool):
    if provider == "openai":
        return await handle_openai_request(url, headers, payload, storage, is_form_data=is_form_data)
    return await handle_groq_request(url, headers, payload, storage, is_form_data=is_form_data)


async def _build_provider_context(task_name: str, require_audio: bool = False):
    provider = storage.get_llm_provider()
    if provider == "openai":
        openai_keys = storage.get_openai_keys()
        if not openai_keys:
            storage.add_log("ERROR", f"Nenhuma chave OpenAI configurada para {task_name}")
            raise Exception("Nenhuma chave OpenAI configurada")
        return {
            "provider": provider,
            "api_key": openai_keys[0],
            "url": "https://api.openai.com/v1/audio/transcriptions"
            if require_audio
            else "https://api.openai.com/v1/chat/completions",
            "model": "whisper-1" if require_audio else "gpt-4o-mini",
        }

    api_key = await get_working_groq_key(storage)
    if not api_key:
        storage.add_log("ERROR", f"Nenhuma chave GROQ disponivel para {task_name}")
        raise Exception("Nenhuma chave GROQ disponivel")

    return {
        "provider": provider,
        "api_key": api_key,
        "url": "https://api.groq.com/openai/v1/audio/transcriptions"
        if require_audio
        else "https://api.groq.com/openai/v1/chat/completions",
        "model": "whisper-large-v3" if require_audio else "llama-3.3-70b-versatile",
    }


async def convert_base64_to_file(base64_data):
    """Converte dados base64 em arquivo temporario."""
    try:
        storage.add_log("DEBUG", "Iniciando conversao de base64 para arquivo")
        audio_data = base64.b64decode(base64_data)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
            temp_file.write(audio_data)
            audio_file_path = temp_file.name

        storage.add_log("DEBUG", "Arquivo temporario criado", {"path": audio_file_path})
        return audio_file_path
    except Exception as exc:
        storage.add_log(
            "ERROR",
            "Erro na conversao base64",
            {"error": str(exc), "type": type(exc).__name__},
        )
        raise


async def get_groq_key():
    key = storage.get_next_groq_key()
    if not key:
        raise HTTPException(
            status_code=500,
            detail="Nenhuma chave GROQ configurada. Configure pelo menos uma chave no painel administrativo.",
        )
    return key


async def summarize_text_if_needed(text):
    """Gera resumo usando o provedor ativo."""
    storage.add_log("DEBUG", "Iniciando processo de resumo", {"text_length": len(text)})
    provider_context = await _build_provider_context("resumo")
    language = _get_language_setting()

    prompt_by_language = {
        "pt": (
            "Entenda o contexto desse audio e faca um resumo super enxuto sobre o que se trata. "
            "Escreva apenas o resumo, sem saudacao nem comentarios extras."
        ),
        "en": (
            "Understand the context of this audio and write only a concise summary. "
            "Do not greet and do not add extra commentary."
        ),
        "es": (
            "Entiende el contexto de este audio y escribe solo un resumen conciso. "
            "No saludes ni agregues comentarios extra."
        ),
    }
    base_prompt = prompt_by_language.get(language, prompt_by_language["pt"])

    headers = {
        "Authorization": f"Bearer {provider_context['api_key']}",
        "Content-Type": "application/json",
    }
    json_data = {
        "messages": [{"role": "user", "content": f"{base_prompt}\n\nTexto para resumir: {text}"}],
        "model": provider_context["model"],
    }

    success, response_data, error = await _resolve_provider_request(
        provider_context["provider"],
        provider_context["url"],
        headers,
        json_data,
        is_form_data=False,
    )
    if not success:
        raise Exception(error)

    summary_text = response_data["choices"][0]["message"]["content"].strip()
    if not await validate_transcription_response(summary_text):
        storage.add_log("ERROR", "Resumo vazio ou invalido recebido")
        raise Exception("Resumo vazio ou invalido recebido")

    storage.add_log(
        "INFO",
        "Resumo gerado com sucesso",
        {
            "original_length": len(text),
            "summary_length": len(summary_text),
            "language": language,
            "provider": provider_context["provider"],
        },
    )
    return summary_text


async def transcribe_audio(audio_source, apikey=None, remote_jid=None, from_me=False, use_timestamps=False):
    """
    Transcreve audio com suporte a deteccao de idioma e traducao automatica.
    Retorna (texto_transcrito, has_timestamps).
    """
    storage.add_log(
        "INFO",
        "Iniciando processo de transcricao",
        {"from_me": from_me, "remote_jid": remote_jid},
    )
    provider_context = await _build_provider_context("transcricao", require_audio=True)
    headers = {"Authorization": f"Bearer {provider_context['api_key']}"}

    contact_language = None
    system_language = storage.get_transcription_language()
    is_private = bool(remote_jid and "@s.whatsapp.net" in remote_jid)

    if is_private:
        contact_id = remote_jid.split("@")[0]
        contact_language = storage.get_contact_language(contact_id)
        if contact_language:
            storage.add_log(
                "DEBUG",
                "Usando idioma configurado manualmente",
                {"contact_language": contact_language, "remote_jid": remote_jid},
            )
        elif storage.get_auto_language_detection() and not from_me:
            cached_lang = storage.get_cached_language(contact_id)
            if cached_lang:
                contact_language = cached_lang.get("language")
                storage.add_log(
                    "DEBUG",
                    "Usando idioma do cache",
                    {"contact_language": contact_language, "auto_detected": True},
                )

    if is_private and contact_language:
        transcription_language = contact_language
        target_language = contact_language if from_me else system_language
    else:
        transcription_language = system_language
        target_language = system_language

    storage.add_log(
        "DEBUG",
        "Configuracao de idiomas definida",
        {
            "transcription_language": transcription_language,
            "target_language": target_language,
            "from_me": from_me,
            "is_private": is_private,
            "contact_language": contact_language,
            "provider": provider_context["provider"],
        },
    )

    try:
        with open(audio_source, "rb") as audio_file:
            data = aiohttp.FormData()
            data.add_field("file", audio_file, filename="audio.mp3")
            data.add_field("model", provider_context["model"])
            data.add_field("language", transcription_language)
            if use_timestamps:
                data.add_field("response_format", "verbose_json")

            success, response_data, error = await _resolve_provider_request(
                provider_context["provider"],
                provider_context["url"],
                headers,
                data,
                is_form_data=True,
            )
            if not success:
                raise Exception(f"Erro na transcricao: {error}")

        transcription = (
            format_timestamped_result(response_data)
            if use_timestamps
            else response_data.get("text", "").strip()
        )
        if not await validate_transcription_response(transcription):
            storage.add_log("ERROR", "Transcricao vazia ou invalida recebida")
            raise Exception("Transcricao vazia ou invalida recebida")

        if is_private and storage.get_auto_language_detection() and not from_me and not contact_language:
            detected_lang = await detect_language(transcription)
            storage.cache_language_detection(remote_jid, detected_lang)
            storage.set_contact_language(remote_jid, detected_lang)
            contact_language = detected_lang
            storage.add_log(
                "INFO",
                "Idioma detectado e cacheado",
                {"language": detected_lang, "remote_jid": remote_jid},
            )

        need_translation = (
            storage.get_auto_translation()
            and is_private
            and contact_language
            and target_language != transcription_language
        )
        if need_translation:
            transcription = await translate_text(
                transcription,
                transcription_language,
                target_language,
            )
            storage.add_log(
                "INFO",
                "Texto traduzido automaticamente",
                {"from": transcription_language, "to": target_language},
            )

        used_language = contact_language if contact_language else system_language
        storage.record_language_usage(
            used_language,
            from_me,
            bool(contact_language and contact_language != system_language),
        )
        return transcription, use_timestamps

    except Exception as exc:
        storage.add_log(
            "ERROR",
            "Erro no processo de transcricao",
            {"error": str(exc), "type": type(exc).__name__},
        )
        raise
    finally:
        if isinstance(audio_source, str) and os.path.exists(audio_source):
            try:
                os.unlink(audio_source)
            except Exception as exc:
                storage.add_log(
                    "WARNING",
                    "Erro ao remover arquivo temporario",
                    {"error": str(exc)},
                )


def format_timestamped_result(result):
    segments = result.get("segments", [])
    formatted_lines = []
    for segment in segments:
        start_time = format_timestamp(segment.get("start", 0))
        end_time = format_timestamp(segment.get("end", 0))
        text = segment.get("text", "").strip()
        if text:
            formatted_lines.append(f"[{start_time} -> {end_time}] {text}")
    return "\n".join(formatted_lines)


def format_timestamp(seconds):
    minutes = int(seconds // 60)
    remaining_seconds = int(seconds % 60)
    return f"{minutes:02d}:{remaining_seconds:02d}"


async def detect_language(text: str) -> str:
    """Detecta o idioma principal do texto via provedor ativo."""
    provider_context = await _build_provider_context("deteccao de idioma")
    storage.add_log("DEBUG", "Iniciando deteccao de idioma", {"text_length": len(text)})

    supported_languages = {
        "pt", "en", "es", "fr", "de", "it", "ja", "ko",
        "zh", "ro", "ru", "ar", "hi", "nl", "pl", "tr",
    }
    headers = {
        "Authorization": f"Bearer {provider_context['api_key']}",
        "Content-Type": "application/json",
    }
    json_data = {
        "messages": [
            {
                "role": "system",
                "content": "Retorne apenas o codigo ISO 639-1 do idioma principal do texto.",
            },
            {
                "role": "user",
                "content": text[:500],
            },
        ],
        "model": provider_context["model"],
        "temperature": 0.1,
    }

    success, response_data, error = await _resolve_provider_request(
        provider_context["provider"],
        provider_context["url"],
        headers,
        json_data,
        is_form_data=False,
    )
    if not success:
        raise Exception(f"Falha na deteccao de idioma: {error}")

    detected_language = response_data["choices"][0]["message"]["content"].strip().lower()
    if detected_language not in supported_languages:
        storage.add_log(
            "WARNING",
            "Idioma detectado nao suportado",
            {"detected": detected_language, "fallback": "en"},
        )
        detected_language = "en"

    storage.add_log("INFO", "Idioma detectado com sucesso", {"detected_language": detected_language})
    return detected_language


async def send_message_to_whatsapp(server_url, instance, apikey, message, remote_jid, message_id):
    """Envia mensagem via WhatsApp com fallback entre payloads."""
    storage.add_log(
        "DEBUG",
        "Preparando envio de mensagem",
        {"remote_jid": remote_jid, "instance": instance},
    )
    url = f"{server_url}/message/sendText/{instance}"
    headers = {"apikey": apikey}

    body = get_body_message_to_whatsapp_v1(message, remote_jid)
    result = await call_whatsapp(url, body, headers)
    if not result:
        storage.add_log("DEBUG", "Formato V1 falhou, tentando formato V2")
        body = get_body_message_to_whatsapp_v2(message, remote_jid, message_id)
        result = await call_whatsapp(url, body, headers)

    if not result:
        raise Exception("Falha ao enviar mensagem ao WhatsApp")

    storage.add_log("INFO", "Mensagem enviada com sucesso", {"remote_jid": remote_jid})


def get_body_message_to_whatsapp_v1(message, remote_jid):
    return {
        "number": remote_jid,
        "options": {"delay": 1200, "presence": "composing", "linkPreview": False},
        "textMessage": {"text": message},
    }


def get_body_message_to_whatsapp_v2(message, remote_jid, message_id):
    return {
        "number": remote_jid,
        "text": message,
        "quoted": {"key": {"remoteJid": remote_jid, "fromMe": False, "id": message_id}},
    }


async def call_whatsapp(url, body, headers):
    """Realiza chamada a API do WhatsApp."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=body, headers=headers) as response:
                if response.status not in [200, 201]:
                    error_text = await response.text()
                    storage.add_log(
                        "ERROR",
                        "Erro na API do WhatsApp",
                        {
                            "status": response.status,
                            "error_excerpt": error_text[:500],
                            "url": url,
                        },
                    )
                    return False
                storage.add_log("DEBUG", "Requisicao ao WhatsApp bem-sucedida", {"status": response.status})
                return True
    except Exception as exc:
        storage.add_log(
            "ERROR",
            "Erro na chamada WhatsApp",
            {"error": str(exc), "type": type(exc).__name__, "url": url},
        )
        return False


async def get_audio_base64(server_url, instance, apikey, message_id):
    """Obtem audio em base64 via API do WhatsApp."""
    storage.add_log(
        "DEBUG",
        "Obtendo audio base64",
        {"message_id": message_id, "instance": instance},
    )
    url = f"{server_url}/chat/getBase64FromMediaMessage/{instance}"
    headers = {"apikey": apikey}
    body = {"message": {"key": {"id": message_id}}, "convertToMp4": False}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=body, headers=headers) as response:
                if response.status in [200, 201]:
                    result = await response.json()
                    storage.add_log("INFO", "Audio base64 obtido com sucesso", {"status": response.status})
                    return result.get("base64", "")

                error_text = await response.text()
                storage.add_log(
                    "ERROR",
                    "Erro ao obter audio base64",
                    {"status": response.status, "error_excerpt": error_text[:500], "url": url},
                )
                raise HTTPException(status_code=500, detail="Falha ao obter audio em base64")
    except Exception as exc:
        storage.add_log(
            "ERROR",
            "Erro na obtencao do audio base64",
            {"error": str(exc), "type": type(exc).__name__, "message_id": message_id},
        )
        raise


async def format_message(transcription_text, summary_text=None):
    """Formata a mensagem baseado nas configuracoes salvas."""
    settings = storage.get_output_settings()
    message_parts = []
    output_mode = settings["output_mode"]
    char_limit = int(settings["character_limit"])

    if output_mode == "smart":
        if len(transcription_text) > char_limit and summary_text:
            message_parts.append(f"{settings['summary_header']}\n\n{summary_text}")
        else:
            message_parts.append(f"{settings['transcription_header']}\n\n{transcription_text}")
    elif output_mode == "summary_only":
        if summary_text:
            message_parts.append(f"{settings['summary_header']}\n\n{summary_text}")
    elif output_mode == "transcription_only":
        message_parts.append(f"{settings['transcription_header']}\n\n{transcription_text}")
    else:
        if summary_text:
            message_parts.append(f"{settings['summary_header']}\n\n{summary_text}")
        message_parts.append(f"{settings['transcription_header']}\n\n{transcription_text}")

    message_parts.append(storage.get_business_message())
    return "\n\n".join(part for part in message_parts if part)


async def translate_text(text: str, source_language: str, target_language: str) -> str:
    """Traduz texto usando o provedor ativo."""
    storage.add_log(
        "DEBUG",
        "Iniciando traducao",
        {
            "source_language": source_language,
            "target_language": target_language,
            "text_length": len(text),
        },
    )

    if source_language == target_language:
        return text

    provider_context = await _build_provider_context("traducao")
    headers = {
        "Authorization": f"Bearer {provider_context['api_key']}",
        "Content-Type": "application/json",
    }
    json_data = {
        "messages": [
            {
                "role": "system",
                "content": (
                    "Voce e um tradutor profissional. Preserve formatacao, emojis, paragrafos, "
                    "numeros e nomes proprios."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Traduza o texto de {source_language} para {target_language} sem adicionar comentarios.\n\n{text}"
                ),
            },
        ],
        "model": provider_context["model"],
        "temperature": 0.3,
    }

    success, response_data, error = await _resolve_provider_request(
        provider_context["provider"],
        provider_context["url"],
        headers,
        json_data,
        is_form_data=False,
    )
    if not success:
        raise Exception(f"Falha na traducao: {error}")

    translated_text = response_data["choices"][0]["message"]["content"].strip()
    if not await validate_transcription_response(translated_text):
        storage.add_log("ERROR", "Traducao vazia ou invalida recebida")
        raise Exception("Traducao vazia ou invalida recebida")

    storage.add_log(
        "INFO",
        "Traducao concluida com sucesso",
        {
            "original_length": len(text),
            "translated_length": len(translated_text),
        },
    )
    return translated_text


async def download_remote_audio(url: str) -> str:
    """Baixa um arquivo de audio remoto e salva em arquivo temporario."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Falha no download: status={response.status}, body={error_text[:300]}")

                audio_data = await response.read()
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
                    temp_file.write(audio_data)
                    local_path = temp_file.name

                storage.add_log(
                    "INFO",
                    "Audio remoto baixado com sucesso",
                    {"url": url, "local_path": local_path, "bytes": len(audio_data)},
                )
                return local_path
    except Exception as exc:
        storage.add_log(
            "ERROR",
            "Erro ao baixar audio remoto",
            {"url": url, "error": str(exc), "type": type(exc).__name__},
        )
        raise Exception(f"Erro ao baixar audio remoto: {str(exc)}")
