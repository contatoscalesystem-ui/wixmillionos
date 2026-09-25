# Wix Million OS Central

# WIX MILLION OS — MVP 1

## FUNDAÇÃO OPERACIONAL + CRM + GARIMPOS + PIPELINE

## VERSÃO DE VALIDAÇÃO SEM CUSTO ADICIONAL

Quero desenvolver um sistema web REAL chamado:

WIX MILLION OS

Subtítulo:

CENTRAL DE OPERAÇÃO COMERCIAL

Este sistema será usado diariamente para controlar toda a operação comercial da WIX MILLION.

IMPORTANTE:

NÃO quero um protótipo visual.

NÃO quero um dashboard fake.

NÃO quero números inventados.

NÃO quero botões sem função.

NÃO quero dados mockados depois que o banco estiver conectado.

Quero construir um sistema funcional, simples, bonito, organizado e persistido em banco de dados real.

==================================================

1. OBJETIVO DA OPERAÇÃO

==================================================

O sistema deverá controlar o fluxo:

GARIMPO

↓

LEADS

↓

ABORDAGEM

↓

NEGOCIAÇÃO

↓

FOLLOW-UP

↓

LINK ENVIADO

↓

CONVERSÃO

↓

CLIENTE

↓

PRODUÇÃO DO SITE

↓

PUBLICAÇÃO

↓

FINANCEIRO

A ideia é que o operador não precise ficar procurando dados em:

- ChatGPT;

- Manus;

- documentos;

- anotações;

- planilhas;

- WhatsApp;

- arquivos separados.

Tudo ficará centralizado no WIX MILLION OS.

==================================================

2. OBJETIVO DESTE MVP

==================================================

Neste primeiro MVP quero construir:

1. autenticação;

2. banco de dados;

3. dashboard;

4. cadastro de garimpos;

5. CRM de leads;

6. pipeline comercial;

7. Kanban;

8. ficha completa de cada lead;

9. notas;

10. histórico/timeline;

11. follow-ups;

12. botão para abrir WhatsApp;

13. geração de abordagem por template;

14. conversão de lead em cliente;

15. estrutura inicial de produção de sites;

16. estrutura inicial financeira.

NÃO implementar ainda:

- OpenAI API;

- WhatsApp Cloud API;

- Google Drive;

- Google Calendar;

- automações pagas;

- provedores externos.

Porém:

DEIXAR A ARQUITETURA PREPARADA PARA TODAS ESSAS INTEGRAÇÕES FUTURAS.

==================================================

3. STACK

==================================================

Usar:

React

TypeScript

Tailwind CSS

Supabase

Supabase deve controlar:

- banco PostgreSQL;

- autenticação;

- RLS;

- persistência;

- usuários;

- dados do CRM.

Utilizar inicialmente o plano gratuito do Supabase.

==================================================

4. IDENTIDADE VISUAL

==================================================

Quero um sistema:

CLEAN

MINIMALISTA

PREMIUM

EXECUTIVO

MODERNO

ORGANIZADO

Referência:

CRM B2B premium

SaaS moderno

sistema administrativo executivo

PALETA:

OFF-WHITE

#F7F7F4

PRETO / GRAFITE

#111111

CINZA CLARO

#E8E8E4

DOURADO SÓBRIO

#B9943B

BRANCO

#FFFFFF

REGRAS:

O dourado deve ser usado com moderação.

Usar principalmente para:

- CTA principal;

- seleção;

- score;

- números importantes;

- pequenos detalhes.

NÃO utilizar:

- neon;

- gradientes exagerados;

- visual gamer;

- excesso de sombras;

- elementos 3D;

- excesso de cards.

==================================================

5. LAYOUT

==================================================

Criar sidebar fixa no desktop.

SIDEBAR:

Dashboard

Garimpos

Leads

Pipeline

Clientes

Produção

Recuperação

Financeiro

Agenda

Arquivos

Configurações

Itens ainda não implementados devem aparecer de forma elegante como:

"Em breve"

ou

"Próximo MVP"

NÃO criar uma funcionalidade falsa apenas para preencher a tela.

==================================================

6. LOGIN

==================================================

Criar rota:

/login

Autenticação real via Supabase.

Criar estrutura para:

ADMIN

OPERADOR

TABELA:

profiles

Campos:

id

workspace_id

full_name

email

avatar_url

role

created_at

updated_at

==================================================

7. WORKSPACE

==================================================

Preparar o sistema para futuramente funcionar com vários operadores.

Criar:

workspaces

Campos:

id

name

created_at

updated_at

Neste momento pode existir apenas:

WIX MILLION

Mas todos os dados devem usar:

workspace_id

==================================================

8. GARIMPOS

==================================================

Criar tabela:

garimpos

Campos:

id

workspace_id

name

niche

city

state

research_date

source

original_file_name

original_file_url

total_leads

status

created_by

created_at

updated_at

STATUS:

rascunho

processado

ativo

arquivado

Criar rota:

/garimpos

Mostrar:

Nome

Nicho

Cidade

Estado

Data

Quantidade de leads

Status

Criar botão:

NOVO GARIMPO

Neste MVP permitir:

CADASTRAR GARIMPO MANUALMENTE.

Ainda NÃO implementar importação automática por arquivo.

Mas criar botão visível:

IMPORTAR GARIMPO

Ao clicar:

mostrar modal informando:

"Importação inteligente será habilitada no próximo MVP."

Não fingir que importou.

==================================================

9. LEADS

==================================================

Criar tabela:

leads

Campos:

id

workspace_id

garimpo_id

position

score

priority

company_name

niche

city

state

neighborhood

address

phone

whatsapp

whatsapp_confirmed

instagram_url

instagram_followers

google_maps_url

google_rating

google_reviews

website_url

website_status

scheduling_type

scheduling_url

digital_presence

photo_quality

commercial_observation

raw_source_data

status

assigned_to

last_contact_at

next_followup_at

converted_at

created_at

updated_at

==================================================

10. PRIORIDADES

==================================================

priority:

A

B

C

D

Visual:

A = destaque forte

B = destaque moderado

C = neutro

D = discreto

NÃO usar cores exageradas.

==================================================

11. STATUS DO LEAD

==================================================

Criar exatamente:

novo

validar

pronto_contato

abordagem_enviada

sem_resposta

respondeu

interessado

valor_apresentado

oferta_apresentada

link_enviado

convertido

recuperacao

perdido

nao_qualificado

==================================================

12. TELA /LEADS

==================================================

Criar tabela profissional.

COLUNAS:

Empresa

Score

Prioridade

Nicho

Cidade

WhatsApp

Instagram

Site

Status

Responsável

Último contato

Próximo follow-up

Ações

Criar filtros:

Busca

Status

Prioridade

Score

Cidade

Nicho

Garimpo

Responsável

Status do site

Criar ordenação por:

Score

Prioridade

Nome

Data

Último contato

Próximo follow-up

==================================================

13. VIEWS

==================================================

Na tela Leads disponibilizar:

TABELA

KANBAN

Alternância simples no topo.

==================================================

14. KANBAN

==================================================

Criar Kanban baseado no status.

Exibir pelo menos as etapas comerciais principais:

NOVO

PRONTO PARA CONTATO

ABORDAGEM ENVIADA

RESPONDEU

INTERESSADO

VALOR APRESENTADO

OFERTA APRESENTADA

LINK ENVIADO

CONVERTIDO

RECUPERAÇÃO

Permitir:

DRAG AND DROP.

Ao mover:

salvar imediatamente no Supabase.

Também registrar atividade automática.

==================================================

15. TIMELINE

==================================================

Criar tabela:

lead_activities

Campos:

id

workspace_id

lead_id

user_id

activity_type

description

metadata JSONB

created_at

Exemplos:

lead_created

status_changed

whatsapp_opened

approach_generated

approach_sent

note_created

followup_created

link_sent

converted

project_created

==================================================

16. NOTAS

==================================================

Criar tabela:

lead_notes

Campos:

id

workspace_id

lead_id

user_id

content

created_at

updated_at

Na ficha do lead permitir:

Adicionar nota

Editar nota

Excluir nota

==================================================

17. FICHA DO LEAD

==================================================

Criar rota:

/leads/:id

No topo:

Nome da empresa

Score

Prioridade

Status

Responsável

Botões:

ABRIR WHATSAPP

INSTAGRAM

GOOGLE MAPS

SITE

AGENDAMENTO

Somente mostrar botão quando existir dado.

==================================================

18. SEÇÃO — DADOS DO NEGÓCIO

==================================================

Mostrar:

Empresa

Nicho

Cidade

Estado

Bairro

Endereço

Telefone

WhatsApp

WhatsApp confirmado?

==================================================

19. SEÇÃO — PRESENÇA DIGITAL

==================================================

Mostrar:

Instagram

Seguidores

Google Maps

Nota Google

Avaliações

Site

Status do site

Agendamento

Presença digital

Qualidade das fotos

==================================================

20. SEÇÃO — INTELIGÊNCIA DO GARIMPO

==================================================

Mostrar:

Posição no garimpo

Score

Prioridade

Observação comercial

Dados brutos da pesquisa

Fonte

==================================================

21. STATUS DO SITE

==================================================

Criar opções:

nao_possui

site_fraco

site_razoavel

site_profissional

nao_confirmado

Exibir em linguagem amigável:

Não possui site

Site fraco

Site razoável

Site profissional

Não confirmado

==================================================

22. WHATSAPP — MVP GRATUITO

==================================================

Neste MVP NÃO conectar API do WhatsApp.

Criar botão:

ABRIR WHATSAPP

Utilizar:

https://wa.me/

Normalizar números brasileiros.

Exemplo:

+55 75 99999-9999

deve virar:

5575999999999

Se whatsapp_confirmed = false:

mostrar alerta pequeno:

"WhatsApp não confirmado."

Mesmo assim, caso exista apenas telefone, permitir abrir como tentativa somente após confirmação do operador.

==================================================

23. GERADOR DE ABORDAGEM SEM IA

==================================================

Criar uma área chamada:

MENSAGEM DE ABORDAGEM

Neste MVP não utilizar OpenAI.

Usar templates com variáveis.

Criar tabela:

message_templates

Campos:

id

workspace_id

name

stage

content

is_active

created_at

updated_at

Cadastrar template inicial:

SCRIPT 01 — ABORDAGEM

TEXTO:

Oi, tudo bem? Falo com o responsável pela [NOME_DA_EMPRESA]?

Eu encontrei vocês pesquisando algumas empresas do segmento de [NICHO] na região de [CIDADE] e separei o contato porque estou fazendo uma seleção agora nessa reta final do ano.

Como está chegando o final do ano, eu quero aumentar minhas vendas e, para isso, estou fortalecendo meu portfólio em alguns segmentos.

Um dos segmentos que quero aumentar agora é justamente o de [NICHO].

Então eu estou selecionando a dedo apenas algumas empresas desse segmento para desenvolver um site profissional completo gratuitamente, justamente para poder acrescentar esses projetos ao meu portfólio.

Ou seja, vocês não pagam nada pela construção do site.

Em troca, depois de pronto, só me autorizam a utilizar o projeto no meu portfólio como um dos sites desenvolvidos pela minha empresa.

Eu encontrei a empresa de vocês nessa pesquisa e achei que ela tem perfil para participar.

Você teria interesse?

==================================================

24. SUBSTITUIÇÃO AUTOMÁTICA

==================================================

Ao gerar mensagem:

[NOME_DA_EMPRESA]

usar:

company_name

[NICHO]

usar:

niche

[CIDADE]

usar:

city

Mostrar preview.

Botões:

COPIAR

ABRIR NO WHATSAPP

MARCAR COMO ENVIADA

==================================================

25. MARCAR COMO ENVIADA

==================================================

Quando clicar:

MARCAR COMO ENVIADA

Executar:

lead.status = abordagem_enviada

last_contact_at = now()

criar lead_activity:

type = approach_sent

description = "Abordagem inicial enviada"

Mostrar toast:

"Abordagem registrada."

==================================================

26. FOLLOW-UP

==================================================

Permitir definir:

next_followup_at

Criar botão:

AGENDAR RETORNO

Opções rápidas:

Hoje

Amanhã

2 dias

3 dias

7 dias

Escolher data

Registrar também na timeline.

==================================================

27. DASHBOARD

==================================================

Criar dashboard somente com dados REAIS.

Cards:

Total de leads

Novos

Prontos para contato

Abordagens enviadas

Respondeu

Interessados

Links enviados

Convertidos

Em recuperação

Sites em produção

Sites publicados

Comissão prevista

Comissão recebida

==================================================

28. FUNIL

==================================================

Criar funil:

LEADS

↓

ABORDAGEM

↓

RESPOSTA

↓

INTERESSE

↓

LINK

↓

CONVERSÃO

Mostrar:

quantidade

percentual

Taxas calculadas somente com dados reais.

==================================================

29. ATIVIDADE RECENTE

==================================================

Na dashboard mostrar:

últimas atividades de lead_activities.

==================================================

30. FOLLOW-UPS DO DIA

==================================================

Mostrar leads com:

next_followup_at <= hoje

Ordenar:

mais atrasados primeiro.

==================================================

31. CLIENTES

==================================================

Criar tabela:

clients

Campos:

id

workspace_id

lead_id

company_name

contact_name

phone

whatsapp

email

city

state

status

created_at

updated_at

==================================================

32. CONVERSÃO

==================================================

Na ficha do lead:

CONVERTER EM CLIENTE

Ao confirmar:

1. verificar se já existe client vinculado;

2. criar client;

3. alterar lead.status para convertido;

4. preencher converted_at;

5. registrar timeline;

6. perguntar:

"Criar projeto de site agora?"

==================================================

33. PRODUÇÃO

==================================================

Criar tabela:

site_projects

Campos:

id

workspace_id

client_id

responsible_user_id

status

preview_url

published_url

due_date

notes

created_at

updated_at

STATUS:

aguardando

coleta_dados

producao

primeira_versao

revisao

aprovado

transferencia

publicado

==================================================

34. PRODUÇÃO — TELA

==================================================

Criar:

/producao

Mostrar cards ou tabela:

Cliente

Projeto

Responsável

Status

Prazo

Preview

URL publicada

==================================================

35. FINANCEIRO

==================================================

Criar tabela:

financial_entries

Campos:

id

workspace_id

client_id

lead_id

type

description

platform_amount

platform_currency

commission_amount

commission_currency

status

expected_date

paid_date

created_at

updated_at

STATUS:

pendente

confirmado

a_receber

recebido

cancelado

==================================================

36. FINANCEIRO — MVP

==================================================

Criar rota:

/financeiro

Permitir cadastrar manualmente:

Venda

Valor pago na plataforma

Comissão prevista

Moeda

Status

Data prevista

Data recebida

Cards:

Comissão prevista

A receber

Recebida

Vendas

Não utilizar valores fixos no código.

==================================================

37. PREPARAÇÃO PARA WHATSAPP FUTURO

==================================================

CRIAR A ESTRUTURA NO BANCO AGORA.

Mesmo sem integração ativa.

TABELA:

whatsapp_connections

Campos:

id

workspace_id

provider

phone_number

phone_number_id

waba_id

connection_status

coexistence_enabled

connected_at

disconnected_at

created_at

updated_at

==================================================

38. CONVERSAS FUTURAS

==================================================

Criar tabela:

conversations

Campos:

id

workspace_id

lead_id

client_id

channel

external_contact_id

assigned_to

status

last_message_at

unread_count

created_at

updated_at

==================================================

39. MENSAGENS FUTURAS

==================================================

Criar tabela:

messages

Campos:

id

workspace_id

conversation_id

lead_id

sender_type

sender_user_id

external_message_id

direction

message_type

content

status

sent_at

delivered_at

read_at

created_at

IMPORTANTE:

Não criar inbox falso neste MVP.

Somente banco preparado.

==================================================

40. ETIQUETAS

==================================================

Criar:

lead_tags

Campos:

id

workspace_id

name

created_at

Criar:

lead_tag_links

Campos:

lead_id

tag_id

Permitir adicionar etiquetas na ficha do lead.

==================================================

41. ETIQUETAS INICIAIS

==================================================

Criar:

Quente

Retornar hoje

Retornar amanhã

Sem resposta

Pensando

Preço

Cliente

Site em produção

Permitir criar novas.

==================================================

42. RLS

==================================================

Implementar Row Level Security corretamente.

Todos os dados devem respeitar:

workspace_id.

Criar helpers necessários.

Usuários autenticados só podem acessar registros do próprio workspace.

Admin pode acessar tudo do workspace.

==================================================

43. RESPONSIVIDADE

==================================================

Sistema prioritariamente desktop.

Mas precisa funcionar também em:

tablet

celular

No celular:

sidebar deve virar menu.

Tabelas podem usar cards ou scroll controlado.

==================================================

44. EXPERIÊNCIA

==================================================

Adicionar:

loading states

skeletons

empty states

toasts

modal de confirmação

tratamento de erros

mensagens claras

Não mostrar erros técnicos diretamente ao usuário.

==================================================

45. PRIMEIRO USO

==================================================

Quando não existirem leads:

mostrar:

"Nenhum lead cadastrado ainda."

Botões:

NOVO GARIMPO

CADASTRAR LEAD

IMPORTAR GARIMPO — PRÓXIMO MVP

==================================================

46. CONFIGURAÇÕES

==================================================

Criar:

/configuracoes

Seções:

Perfil

Equipe

Templates

WhatsApp

Integrações

Valores

Na área WhatsApp:

mostrar:

"Não conectado"

e texto:

"Integração direta com WhatsApp será disponibilizada em próximo MVP."

Na área Integrações:

OpenAI — não conectado

Google Drive — não conectado

Google Calendar — não conectado

==================================================

47. NÃO IMPLEMENTAR AGORA

==================================================

NÃO implementar:

OpenAI

QR Code de WhatsApp

Meta WhatsApp Cloud API

Evolution API

Baileys

WPPConnect

Google Drive

Google Calendar

Manus API

Automações externas

==================================================

48. REGRA MAIS IMPORTANTE

==================================================

FUNCIONALIDADE REAL PRIMEIRO.

Se existir dúvida entre:

criar algo bonito porém falso

OU

criar algo simples porém funcional

ESCOLHER:

FUNCIONAL.

==================================================

49. NÃO USAR MOCK DATA

==================================================

Depois que o banco estiver conectado:

Dashboard deve iniciar zerada.

Leads deve iniciar vazio.

Clientes devem iniciar vazios.

Financeiro deve iniciar zerado.

Produção deve iniciar vazia.

Não inserir:

"Empresa X"

"Cliente teste"

"R$ 10.000"

"20 vendas"

ou qualquer dado inventado.

==================================================

50. PREPARAR PARA O MVP 2

==================================================

O próximo MVP será:

IMPORTAÇÃO INTELIGENTE DE GARIMPOS.

O sistema receberá documentos produzidos pela Manus contendo aproximadamente:

posição

score

prioridade

empresa

bairro

telefone/WhatsApp

Instagram

seguidores

Google

avaliações

site

status do site

agendamento

presença digital

fotos

observação comercial

O sistema transformará isso automaticamente em registros de leads.

Portanto:

garanta que o banco deste MVP seja compatível com essa importação futura.

==================================================

51. TESTES OBRIGATÓRIOS

==================================================

Antes de considerar o MVP finalizado, testar:

login

logout

criação de garimpo

edição de garimpo

cadastro de lead

edição de lead

exclusão de lead

filtros

busca

Kanban

mudança de status

timeline

notas

tags

WhatsApp link

geração do Script 01

substituição das variáveis

marcar abordagem como enviada

follow-up

conversão em cliente

criação de projeto

financeiro

RLS

responsividade

==================================================

52. ENTREGA

==================================================

Ao finalizar:

NÃO avançar automaticamente para o MVP 2.

Apresentar relatório contendo:

1. ROTAS CRIADAS

2. TABELAS CRIADAS

3. RLS IMPLEMENTADA

4. FUNÇÕES CRIADAS

5. FUNCIONALIDADES IMPLEMENTADAS

6. FUNCIONALIDADES TESTADAS

7. PONTOS PENDENTES

8. ESTRUTURA PREPARADA PARA O MVP 2

FIM DO MVP 1.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://wixmillionos.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8825f1f5-b6f7-4df6-a275-2f57ac1ba672).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
