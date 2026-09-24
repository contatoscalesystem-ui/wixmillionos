create table public.script_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  position int not null default 0,
  name text not null,
  objective text, when_to_use text, main_message text, variations text, expected_response text,
  if_yes text, if_no text, if_no_reply text, next_step text,
  suggested_status public.lead_status,
  materials jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.script_objections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  position int not null default 0,
  category text not null,
  objection text, short_answer text, medium_answer text, strategic_question text, stop_when text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.lead_script_progress (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  stage_id uuid not null references public.script_stages(id) on delete cascade,
  completed_by uuid default auth.uid(),
  completed_at timestamptz not null default now(),
  unique (lead_id, stage_id)
);
create index on public.script_stages(workspace_id, position);
create index on public.script_objections(workspace_id, position);
create index on public.lead_script_progress(lead_id);

grant select, insert, update, delete on public.script_stages, public.script_objections, public.lead_script_progress to authenticated;
grant all on public.script_stages, public.script_objections, public.lead_script_progress to service_role;
alter table public.script_stages enable row level security;
alter table public.script_objections enable row level security;
alter table public.lead_script_progress enable row level security;

create policy "script stages access" on public.script_stages for all to authenticated
  using (workspace_id = public.current_workspace_id() or (workspace_id is null and public.is_super_admin()))
  with check (workspace_id = public.current_workspace_id() or (workspace_id is null and public.is_super_admin()));
create policy "script objections access" on public.script_objections for all to authenticated
  using (workspace_id = public.current_workspace_id() or (workspace_id is null and public.is_super_admin()))
  with check (workspace_id = public.current_workspace_id() or (workspace_id is null and public.is_super_admin()));
create policy "lead script progress access" on public.lead_script_progress for all to authenticated
  using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id()
    and exists (select 1 from public.leads l where l.id = lead_id and l.workspace_id = public.current_workspace_id()));

create trigger t_upd before update on public.script_stages for each row execute function public.update_updated_at_column();
create trigger t_upd before update on public.script_objections for each row execute function public.update_updated_at_column();

-- Copy global default script into the caller's workspace (optionally replacing it)
create or replace function public.copy_global_script(_replace boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare ws uuid := public.current_workspace_id(); n int;
begin
  if ws is null then raise exception 'FORBIDDEN'; end if;
  if _replace then
    delete from public.script_stages where workspace_id = ws;
    delete from public.script_objections where workspace_id = ws;
  elsif exists (select 1 from public.script_stages where workspace_id = ws) then
    return 0;
  end if;
  insert into public.script_stages (workspace_id, position, name, objective, when_to_use, main_message, variations, expected_response, if_yes, if_no, if_no_reply, next_step, suggested_status, materials, is_active)
    select ws, position, name, objective, when_to_use, main_message, variations, expected_response, if_yes, if_no, if_no_reply, next_step, suggested_status, materials, is_active
    from public.script_stages where workspace_id is null;
  get diagnostics n = row_count;
  if not exists (select 1 from public.script_objections where workspace_id = ws) then
    insert into public.script_objections (workspace_id, position, category, objection, short_answer, medium_answer, strategic_question, stop_when, is_active)
      select ws, position, category, objection, short_answer, medium_answer, strategic_question, stop_when, is_active
      from public.script_objections where workspace_id is null;
  end if;
  return n;
end $$;
revoke execute on function public.copy_global_script(boolean) from public, anon;
grant execute on function public.copy_global_script(boolean) to authenticated;

-- Global default script
insert into public.script_stages (workspace_id, position, name, objective, when_to_use, main_message, variations, expected_response, if_yes, if_no, if_no_reply, next_step, suggested_status) values
(null, 1, 'Abertura', 'Somente conseguir resposta. Não explicar proposta, não enviar texto longo, não falar de preço.', 'Primeiro contato com o lead.',
$t$Opa, bom dia meu amigo, beleza?
Eu falo com o responsável pela [NOME_DA_EMPRESA]?$t$,
$t$Opa, boa tarde, tudo certo? Falo com o responsável pela [NOME_DA_EMPRESA]?$t$,
'Sim / Sou eu / Em que posso ajudar / Pode falar', 'Ir para a Etapa 02 — Apresentação.', 'Pedir gentilmente o contato do responsável.', 'Aguardar 24h e enviar follow-up curto. Depois de 3 tentativas, colocar em recuperação.', 'Aguardar resposta do responsável.', 'abordagem_enviada'),
(null, 2, 'Apresentação da oportunidade', 'Apresentar a oportunidade de forma curta e gerar curiosidade.', 'Quando o responsável responder: Sim, Sou eu, Em que posso ajudar, Pode falar.',
$t$Perfeito! Estou fazendo uma seleção de algumas empresas para um projeto que estou desenvolvendo agora nessa reta final do ano.

Estou fortalecendo o portfólio da minha empresa e, por isso, estou escolhendo alguns negócios para desenvolver um site profissional completo sem cobrar pelo desenvolvimento.

A ideia é simples: eu faço todo o projeto e, depois de pronto, vocês só me autorizam a utilizá-lo no meu portfólio.

Teria interesse em ver como funciona?$t$,
null, 'Tenho interesse / Pode mandar / Quero ver / Como funciona / Sim', 'Ir para a Etapa 03 — Interesse.', 'Usar a objeção "Sem interesse".', 'Follow-up em 24h. Sem resposta após 3 tentativas: recuperação.', 'Confirmar interesse.', null),
(null, 3, 'Interesse', 'Confirmar o interesse e preparar o envio da referência.', 'Quando o lead responder que tem interesse.',
$t$Perfeito. Vou te mostrar rapidinho o padrão que estou desenvolvendo.$t$,
null, 'Ok / Pode mandar', 'Enviar vídeo/referência (Etapa 04).', 'Usar a objeção correspondente.', 'Enviar a referência mesmo assim e aguardar.', 'Enviar vídeo/referência.', 'interessado'),
(null, 4, 'Vídeo / Referência', 'Fazer o lead visualizar o resultado antes de falar da parte técnica.', 'Logo após confirmar o interesse.',
$t$Curtiu esse padrão?$t$,
null, 'Gostei / Ficou bonito / Curti', 'Ir para a Etapa 05 — Explicação.', 'Perguntar o que não agradou e ajustar a referência.', 'Follow-up em 24h perguntando se conseguiu ver.', 'Explicar como funciona.', null),
(null, 5, 'Explicar como funciona', 'Mostrar que o site é personalizado para a empresa.', 'Quando o lead gostar do padrão.',
$t$Que bom que gostou! O site da [NOME_DA_EMPRESA] seria personalizado com os serviços, fotos, localização, contatos, botão de WhatsApp e agendamento.

Ele funciona certinho tanto no celular quanto no computador.$t$,
null, 'Entendi / Legal / E aí?', 'Ir para a Etapa 06 — Estrutura.', 'Tirar dúvidas antes de avançar.', 'Follow-up em 24h.', 'Explicar a estrutura.', 'valor_apresentado'),
(null, 6, 'Estrutura / Hospedagem / Domínio', 'Explicar o custo da estrutura com clareza, só depois do lead entender e gostar do projeto.', 'Somente depois de o lead entender e gostar do projeto.',
$t$A única parte por conta da empresa é a estrutura necessária para manter o site publicado.

É um plano anual de R$192, o que dá em média R$16 por mês.

Esse valor é pago diretamente à plataforma, não é PIX para mim. O desenvolvimento continua bonificado.$t$,
null, 'Pode ser / Como pago? / Fechado', 'Ir para a Etapa 07 — Envio do link.', 'Usar as objeções "Achou que teria custo" ou "Não quer gastar agora".', 'Follow-up em 24h. Sem resposta: recuperação.', 'Enviar o link da plataforma.', 'oferta_apresentada'),
(null, 7, 'Envio do link', 'Enviar o link da plataforma para contratar a estrutura.', 'Quando o lead aceitar.',
$t$Perfeito! Segue o link da plataforma para ativar a estrutura do site da [NOME_DA_EMPRESA]:

[LINK]

Assim que concluir, me avisa aqui que eu já coloco o projeto em produção.$t$,
null, 'Pronto / Paguei', 'Ir para a Etapa 08 — Confirmação.', 'Entender a dificuldade e ajudar.', 'Follow-up em 24h perguntando se conseguiu acessar.', 'Confirmar o pagamento.', 'link_enviado'),
(null, 8, 'Confirmação', 'Confirmar o pagamento e iniciar a produção.', 'Após o pagamento confirmado.',
$t$Confirmado! O projeto da [NOME_DA_EMPRESA] já entrou em produção.

Em até 2 dias úteis te envio a primeira versão. Vou precisar só de alguns dados que ainda faltam.$t$,
null, 'Ok / Combinado', 'Ir para a Etapa 09 — Produção.', 'Verificar o pagamento novamente.', 'Seguir com a produção normalmente.', 'Solicitar somente os dados que faltam.', 'convertido'),
(null, 9, 'Produção', 'Coletar os dados que faltam e entregar a primeira versão.', 'Depois da confirmação.',
$t$Para deixar o site da [NOME_DA_EMPRESA] completo, você pode me enviar: logo, fotos atualizadas e a lista de serviços?$t$,
null, 'Envio dos dados', 'Produzir e enviar a primeira versão.', 'Produzir com os dados públicos disponíveis.', 'Follow-up em 24h.', 'Enviar a primeira versão.', null),
(null, 10, 'Follow-up / Recuperação', 'Retomar leads que pararam de responder.', 'Quando o lead ficar sem responder.',
$t$Opa, tudo certo? Passando só pra saber se conseguiu ver a mensagem sobre o site da [NOME_DA_EMPRESA].$t$,
$t$Oi! Ainda tenho uma vaga nessa seleção. Quer que eu reserve para a [NOME_DA_EMPRESA]?$t$,
'Qualquer resposta', 'Voltar para a etapa em que parou.', 'Marcar como perdido.', 'Após 3 tentativas sem resposta, marcar como perdido.', 'Retomar a conversa.', 'recuperacao');

insert into public.script_objections (workspace_id, position, category, objection, short_answer, medium_answer, strategic_question, stop_when) values
(null, 1, 'Sem interesse', 'No momento não temos interesse.', 'Entendi, sem problemas.', 'Entendi. Só estou oferecendo porque o desenvolvimento é bonificado, sem custo para vocês.', $t$Entendi. Só pra eu não interpretar errado:
vocês não têm interesse em ter um site hoje ou acharam que teria algum custo envolvido?$t$, 'Se repetir que não tem interesse depois da pergunta.'),
(null, 2, 'Achou que teria custo', 'Quanto custa? / Imagino que seja caro.', 'O desenvolvimento é bonificado, vocês não pagam por ele.', 'O desenvolvimento é bonificado. A única parte por conta da empresa é a estrutura de publicação, paga direto à plataforma.', 'Se o desenvolvimento fosse sem custo, faria sentido ter o site?', 'Se não aceitar nem o custo da estrutura.'),
(null, 3, 'Já tem site', 'Já temos site.', 'Legal! Posso dar uma olhada?', 'Legal! Muitas empresas que atendo tinham site, mas ele não trazia clientes nem funcionava bem no celular.', 'O site de vocês traz clientes hoje?', 'Se o site atual for profissional e ele estiver satisfeito.'),
(null, 4, 'Não quer gastar agora', 'Agora não dá para gastar.', 'Entendo. Dá em média R$16 por mês.', 'Entendo. O desenvolvimento é bonificado e a estrutura sai em média R$16 por mês, pago direto à plataforma.', 'Se eu reservar a vaga, quando seria um bom momento?', 'Se pedir para não entrar mais em contato.'),
(null, 5, 'Precisa falar com sócio', 'Preciso ver com meu sócio.', 'Claro! Quer que eu mande um resumo?', 'Claro! Posso te mandar um resumo com o vídeo para você mostrar para ele.', 'Qual seria a principal dúvida dele?', 'Após 2 follow-ups sem retorno.'),
(null, 6, 'Manda depois', 'Me manda depois.', 'Combinado! Te chamo amanhã.', 'Combinado! Te mando amanhã. Só não garanto a vaga por muito tempo.', 'Qual o melhor horário para te chamar?', 'Após 3 adiamentos.'),
(null, 7, 'Não respondeu', '(Sem resposta)', 'Opa, conseguiu ver minha mensagem?', 'Passando só pra saber se conseguiu ver a mensagem sobre o site.', 'Ainda faz sentido pra vocês?', 'Após 3 tentativas sem resposta.'),
(null, 8, 'Desconfia da oferta', 'Isso é golpe? / Qual a pegadinha?', 'Entendo a desconfiança! Não há pegadinha.', 'Entendo! O ganho para mim é o portfólio. O único custo é a estrutura, paga direto à plataforma, nunca PIX para mim.', 'Quer ver alguns projetos que já fiz?', 'Se continuar desconfiando depois de ver o portfólio.');

-- Give every existing workspace its own copy
insert into public.script_stages (workspace_id, position, name, objective, when_to_use, main_message, variations, expected_response, if_yes, if_no, if_no_reply, next_step, suggested_status)
select w.id, s.position, s.name, s.objective, s.when_to_use, s.main_message, s.variations, s.expected_response, s.if_yes, s.if_no, s.if_no_reply, s.next_step, s.suggested_status
from public.workspaces w cross join public.script_stages s where s.workspace_id is null;
insert into public.script_objections (workspace_id, position, category, objection, short_answer, medium_answer, strategic_question, stop_when)
select w.id, o.position, o.category, o.objection, o.short_answer, o.medium_answer, o.strategic_question, o.stop_when
from public.workspaces w cross join public.script_objections o where o.workspace_id is null;