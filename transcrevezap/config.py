import logging
import os

from utils import create_redis_client


class ColoredFormatter(logging.Formatter):
    """Formatter personalizado que adiciona cores aos logs."""

    COLORS = {
        logging.DEBUG: "\x1b[38;5;39m",
        logging.INFO: "\x1b[38;21m",
        logging.WARNING: "\x1b[38;5;226m",
        logging.ERROR: "\x1b[38;5;196m",
        logging.CRITICAL: "\x1b[31;1m",
    }
    RESET = "\x1b[0m"

    def format(self, record):
        color = self.COLORS.get(record.levelno, self.RESET)
        log_fmt = f"{color}%(asctime)s - %(name)s - %(levelname)s - %(message)s{self.RESET}"
        formatter = logging.Formatter(log_fmt)
        return formatter.format(record)


logger = logging.getLogger("TranscreveZAP")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(ColoredFormatter())
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

redis_client = create_redis_client()


class Settings:
    """Classe para gerenciar configurações do sistema no namespace oficial."""

    def __init__(self):
        self.DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"
        self.LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
        self.refresh()

    def _key(self, name: str) -> str:
        return f"transcrevezap:{name}"

    def _get(self, name: str, default):
        value = redis_client.get(self._key(name))
        if value is not None:
            return value

        legacy_map = {
            "active_llm_provider": "ACTIVE_LLM_PROVIDER",
            "business_message": "BUSINESS_MESSAGE",
            "process_group_messages": "PROCESS_GROUP_MESSAGES",
            "process_self_messages": "PROCESS_SELF_MESSAGES",
            "transcription_language": "TRANSCRIPTION_LANGUAGE",
            "api_domain": "API_DOMAIN",
            "debug_mode": "DEBUG_MODE",
        }
        legacy_name = legacy_map.get(name, name)
        legacy_value = redis_client.get(legacy_name)
        if legacy_value is not None:
            redis_client.set(self._key(name), legacy_value)
            return legacy_value

        return default

    def refresh(self):
        self.ACTIVE_LLM_PROVIDER = self._get("active_llm_provider", "groq")
        self.BUSINESS_MESSAGE = self._get("business_message", "*Impacte AI* Premium Services")
        self.PROCESS_GROUP_MESSAGES = self._get("process_group_messages", "false").lower() == "true"
        self.PROCESS_SELF_MESSAGES = self._get("process_self_messages", "true").lower() == "true"
        self.TRANSCRIPTION_LANGUAGE = self._get("transcription_language", "pt")
        self.GROQ_KEYS = list(redis_client.smembers(self._key("groq_keys")))
        self.OPENAI_KEYS = list(redis_client.smembers(self._key("openai_keys")))

    def validate(self):
        provider = self.ACTIVE_LLM_PROVIDER
        if provider == "openai":
            if not self.OPENAI_KEYS:
                logger.warning("Nenhuma chave OpenAI configurada no namespace oficial.")
                return False
            return True

        if not self.GROQ_KEYS:
            logger.warning("Nenhuma chave GROQ configurada no namespace oficial.")
            return False
        return True


settings = Settings()


def load_settings():
    global settings
    settings = Settings()
    log_level = getattr(logging, settings.LOG_LEVEL, logging.INFO)
    logger.setLevel(log_level)
    logger.info(f"Nível de log ajustado para: {logging.getLevelName(log_level)}")
