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
- `/meet 13/06 Viagem Paraguay` → evento dia inteiro em 13/06
- `/meet 15/06 14:30 Dentista` → evento das 14:30 às 15:30 em 15/06
- `/meet 20/06 09:00-11:00 Reunião com cliente` → evento com horário exato

## Passo 1 — Parse dos argumentos

Dado o input `DD/MM [HH:MM[-HH:MM]] Nome`:

1. **Data**: os dois primeiros tokens são `DD/MM`.
   - DD = dia (1-31), MM = mês (1-12)
   - Ano: usar o ano atual se `MM/DD` ainda não passou; caso contrário, próximo ano
   - Converter para `YYYY-MM-DD` — **nunca usar a data de hoje como fallback**

2. **Horário** (opcional): verificar se o token logo após a data tem formato `HH:MM` ou `HH:MM-HH:MM`
   - Se SIM: é evento com horário — extrair início e fim (fim = início + 1h se só um horário)
   - Se NÃO: é evento de **dia inteiro** — não inventar horário

3. **Nome**: todo o restante dos tokens é o nome do compromisso

## Passo 2 — Criar o evento

Chamar `mcp__6763a7c1-1808-45ef-8039-74abe03f9248__create_event` com:

### Evento de dia inteiro (sem horário informado):
```
summary: <nome>
startTime: <YYYY-MM-DD>T00:00:00
endTime: <YYYY-MM-DD+1>T00:00:00   ← dia seguinte
allDay: true
timeZone: America/Sao_Paulo
addGoogleMeetUrl: false             ← OBRIGATÓRIO, sempre false
```

### Evento com horário:
```
summary: <nome>
startTime: <YYYY-MM-DD>T<HH:MM:00>
endTime: <YYYY-MM-DD>T<HH+1:MM:00>
allDay: false
timeZone: America/Sao_Paulo
addGoogleMeetUrl: false             ← OBRIGATÓRIO, sempre false
```

**`addGoogleMeetUrl` deve ser `false` SEMPRE. Sem exceção. Não incluir nenhum link de vídeo.**

## Passo 3 — Confirmar ao usuário

Responder: nome do compromisso, data e horário (ou "dia inteiro"), e link do evento do Google Calendar.

## Regras inegociáveis

- `addGoogleMeetUrl: false` — sempre, sem exceção
- Data errada = pior resultado possível: conferir DD e MM antes de criar
- Sem horário no input = `allDay: true`, nunca inventar horário
- Fuso sempre `America/Sao_Paulo`
- Se o nome estiver vazio, perguntar antes de criar
