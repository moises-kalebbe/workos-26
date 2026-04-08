import asyncio
import os
import traceback

import aiohttp
from fastapi import FastAPI, HTTPException, Request

from config import load_settings
from services import (
    convert_base64_to_file,
    download_remote_audio,
    get_audio_base64,
    send_message_to_whatsapp,
    summarize_text_if_needed,
    transcribe_audio,
)
from storage import StorageHandler

app = FastAPI()
storage = StorageHandler()


@app.on_event("startup")
async def startup_event():
    api_domain = os.getenv("API_DOMAIN", "seu.dominio.com")
    storage.initialize_default_config(api_domain)
    storage.set_api_domain(api_domain)
    load_settings()


async def forward_to_webhooks(body: dict, storage_handler: StorageHandler):
    """Encaminha o payload para todos os webhooks cadastrados."""
    webhooks = storage_handler.get_webhook_redirects()

    async with aiohttp.ClientSession() as session:
        for webhook in webhooks:
            try:
                headers = {
                    "Content-Type": "application/json",
                    "X-TranscreveZAP-Forward": "true",
                    "X-TranscreveZAP-Webhook-ID": webhook["id"],
                }

                async with session.post(
                    webhook["url"],
                    json=body,
                    headers=headers,
                    timeout=10,
                ) as response:
                    if response.status in [200, 201, 202]:
                        storage_handler.update_webhook_stats(webhook["id"], True)
                    else:
                        error_text = await response.text()
                        storage_handler.update_webhook_stats(
                            webhook["id"],
                            False,
                            f"Status {response.status}: {error_text}",
                        )
                        storage_handler.add_failed_delivery(webhook["id"], body)
            except Exception as exc:
                storage_handler.update_webhook_stats(
                    webhook["id"],
                    False,
                    f"Erro ao encaminhar: {str(exc)}",
                )
                storage_handler.add_failed_delivery(webhook["id"], body)


@app.post("/transcreve-audios")
async def transcreve_audios(request: Request):
    try:
        body = await request.json()
        runtime_flags = storage.get_runtime_flags()
        output_settings = storage.get_output_settings()

        asyncio.create_task(forward_to_webhooks(body, storage))
        storage.add_log(
            "INFO",
            "Nova requisicao de transcricao recebida",
            {
                "instance": body.get("instance"),
                "event": body.get("event"),
                "provider": storage.get_llm_provider(),
            },
        )

        if runtime_flags["debug_mode"]:
            storage.add_log("DEBUG", "Payload completo recebido", {"body": body})

        server_url = body["server_url"]
        instance = body["instance"]
        apikey = body["apikey"]
        audio_key = body["data"]["key"]["id"]
        from_me = body["data"]["key"]["fromMe"]
        remote_jid = body["data"]["key"]["remoteJid"]
        message_type = body["data"]["messageType"]
        is_group = "@g.us" in remote_jid

        storage.add_log(
            "DEBUG",
            "Webhook validado",
            {
                "remote_jid": remote_jid,
                "message_type": message_type,
                "from_me": from_me,
                "is_group": is_group,
            },
        )

        if "audioMessage" not in message_type:
            storage.add_log(
                "INFO",
                "Mensagem ignorada - nao e audio",
                {
                    "message_type": message_type,
                    "remote_jid": remote_jid,
                    "reason": "message_type",
                },
            )
            return {"message": "Mensagem recebida nao e um audio"}

        if not storage.can_process_message(remote_jid):
            storage.add_log(
                "INFO",
                "Mensagem nao autorizada para processamento",
                {
                    "remote_jid": remote_jid,
                    "tipo": "grupo" if is_group else "usuario",
                    "motivo": "grupo nao permitido" if is_group else "usuario bloqueado",
                },
            )
            return {"message": "Mensagem nao autorizada para processamento"}

        process_mode = storage.get_process_mode()
        if process_mode == "groups_only" and not is_group:
            storage.add_log(
                "INFO",
                "Mensagem ignorada - modo apenas grupos ativo",
                {
                    "remote_jid": remote_jid,
                    "process_mode": process_mode,
                    "is_group": is_group,
                    "reason": "process_mode",
                },
            )
            return {"message": "Modo apenas grupos ativo - mensagens privadas ignoradas"}

        if from_me and not runtime_flags["process_self_messages"]:
            storage.add_log(
                "INFO",
                "Mensagem propria ignorada",
                {
                    "remote_jid": remote_jid,
                    "reason": "process_self_messages=false",
                },
            )
            return {"message": "Mensagem enviada por mim, sem operacao"}

        try:
            if "mediaUrl" in body["data"]["message"]:
                media_url = body["data"]["message"]["mediaUrl"]
                storage.add_log("DEBUG", "Baixando audio via URL", {"media_url": media_url})
                audio_source = await download_remote_audio(media_url)
            else:
                storage.add_log(
                    "DEBUG",
                    "Obtendo audio via base64",
                    {"message_id": audio_key, "instance": instance},
                )
                base64_audio = await get_audio_base64(server_url, instance, apikey, audio_key)
                audio_source = await convert_base64_to_file(base64_audio)
                storage.add_log("DEBUG", "Audio convertido", {"source": audio_source})

            storage.add_log(
                "DEBUG",
                "Configuracao operacional carregada",
                {
                    "output_mode": output_settings["output_mode"],
                    "character_limit": output_settings["character_limit"],
                    "use_timestamps": output_settings["use_timestamps"],
                },
            )

            transcription_text, has_timestamps = await transcribe_audio(
                audio_source,
                apikey=apikey,
                remote_jid=remote_jid,
                from_me=from_me,
                use_timestamps=output_settings["use_timestamps"],
            )
            storage.add_log(
                "INFO",
                "Transcricao concluida",
                {
                    "has_timestamps": has_timestamps,
                    "text_length": len(transcription_text),
                    "remote_jid": remote_jid,
                },
            )

            summary_text = None
            if output_settings["output_mode"] in ["both", "summary_only"] or (
                output_settings["output_mode"] == "smart"
                and len(transcription_text) > output_settings["character_limit"]
            ):
                summary_text = await summarize_text_if_needed(transcription_text)

            message_parts = []
            if output_settings["output_mode"] == "smart":
                if len(transcription_text) > output_settings["character_limit"]:
                    message_parts.append(f"{output_settings['summary_header']}\n\n{summary_text}")
                else:
                    message_parts.append(
                        f"{output_settings['transcription_header']}\n\n{transcription_text}"
                    )
            else:
                if output_settings["output_mode"] in ["both", "summary_only"] and summary_text:
                    message_parts.append(f"{output_settings['summary_header']}\n\n{summary_text}")
                if output_settings["output_mode"] in ["both", "transcription_only"]:
                    message_parts.append(
                        f"{output_settings['transcription_header']}\n\n{transcription_text}"
                    )

            message_parts.append(storage.get_business_message())
            summary_message = "\n\n".join(part for part in message_parts if part)
            storage.add_log(
                "DEBUG",
                "Mensagem final montada",
                {
                    "remote_jid": remote_jid,
                    "parts": len([part for part in message_parts if part]),
                    "message_length": len(summary_message),
                },
            )

            await send_message_to_whatsapp(
                server_url,
                instance,
                apikey,
                summary_message,
                remote_jid,
                audio_key,
            )

            storage.record_processing(remote_jid)
            storage.add_log(
                "INFO",
                "Audio processado com sucesso",
                {
                    "remote_jid": remote_jid,
                    "transcription_length": len(transcription_text) if transcription_text else 0,
                    "summary_length": len(summary_text) if summary_text else 0,
                },
            )
            return {"message": "Audio transcrito e resposta enviada com sucesso"}

        except Exception as exc:
            storage.record_error()
            storage.add_log(
                "ERROR",
                f"Erro ao processar audio: {str(exc)}",
                {
                    "error_type": type(exc).__name__,
                    "remote_jid": remote_jid,
                    "traceback": traceback.format_exc(),
                },
            )
            raise HTTPException(status_code=500, detail=f"Erro ao processar audio: {str(exc)}")

    except Exception as exc:
        storage.add_log(
            "ERROR",
            f"Erro na requisicao: {str(exc)}",
            {
                "error_type": type(exc).__name__,
                "traceback": traceback.format_exc(),
            },
        )
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar a requisicao: {str(exc)}",
        )
