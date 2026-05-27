---
name: meet
description: Cria um compromisso na agenda do Google Calendar. Uso: /meet DD/MM Nome do Compromisso, ou /meet DD/MM HH:MM Nome. Cria evento do dia inteiro se não tiver horário, ou com horário de 1h se informado. Nunca adiciona link de videoconferência — é compromisso, não reunião.
---

# /meet — Criar Compromisso na Agenda

## Formato do comando

```
/meet DD/MM Nome do Compromisso
/meet DD/MM HH:MM Nome do Compromisso
/meet DD/MM HH:MM-HH:MM Nome do Compromisso
```

**Exemplos:**
- `/meet 12/06 Viagem` → evento dia inteiro em 12/06
- `/meet 15/06 14:30 Dentista` → evento das 14:30 às 15:30 em 15/06
- `/meet 20/06 09:00-11:00 Reunião com cliente` → evento com horário exato

## Processo

1. **Parse dos argumentos** recebidos após `/meet`:
   - Extrair a data: `DD/MM` → converte para `YYYY-MM-DD` usando o ano atual (ou próximo, se a data já passou)
   - Verificar se há horário logo depois da data (padrão `HH:MM` ou `HH:MM-HH:MM`)
   - O restante é o nome do compromisso

2. **Chamar `mcp__6763a7c1-1808-45ef-8039-74abe03f9248__list_calendars`** para descobrir qual calendário usar (preferir o calendário primário do usuário)

3. **Criar o evento com `mcp__6763a7c1-1808-45ef-8039-74abe03f9248__create_event`**:
   - `summary`: nome do compromisso (sem prefixo extra)
   - Se sem horário: usar `start.date` e `end.date` (evento de dia inteiro)
   - Se com horário: usar `start.dateTime` e `end.dateTime` com timezone `America/Sao_Paulo`
   - Duração padrão quando só o horário de início é informado: **1 hora**
   - **NÃO** incluir `conferenceData`, `hangoutLink` ou qualquer link de vídeo
   - `description`: deixar vazio, a não ser que o usuário tenha passado mais contexto

4. **Confirmar** ao usuário: nome, data/hora e link do evento (se retornado pela API)

## Regras

- Ano: usar o ano atual se a data ainda não passou; se já passou, usar o próximo ano
- Fuso: sempre `America/Sao_Paulo`
- Sem link de videoconferência — este é um compromisso pessoal, não uma reunião online
- Se o nome não foi informado, pedir ao usuário antes de criar
- Se a data for inválida, informar e pedir correção
