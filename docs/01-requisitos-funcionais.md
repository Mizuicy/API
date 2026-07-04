# Requisitos Funcionais — Sistema Kairos Biblioteca

Este documento descreve os requisitos funcionais (RF) do sistema de biblioteca
Kairos, desenvolvido em Node.js (Express + MySQL) com frontend em
HTML/CSS/JavaScript puro. Ele foi atualizado para refletir a funcionalidade de
**controle de devolução de livros com prazo automático de 14 dias**.

## 1. Autenticação e Usuários

- **RF01** — O sistema deve permitir o cadastro de novos usuários (nome, email,
  senha, telefone, CPF, data de nascimento).
- **RF02** — O sistema deve permitir login de usuários comuns e administradores,
  com autenticação por email e senha.
- **RF03** — O sistema deve oferecer recuperação de senha por código de
  verificação enviado por email, com expiração de 10 minutos.
- **RF04** — O sistema deve permitir que o usuário edite seus dados de perfil.

## 2. Catálogo e Acervo

- **RF05** — O sistema deve permitir a consulta do catálogo de livros, com
  filtros por gênero, autor e busca textual.
- **RF06** — O sistema deve permitir que administradores cadastrem, editem e
  removam livros, autores e exemplares físicos.
- **RF07** — Cada exemplar de um livro deve ter um status individual
  (`Disponivel` ou `Emprestado`) que reflete sua disponibilidade real para
  empréstimo.

## 3. Empréstimos e Controle de Devolução

- **RF08** — O sistema deve permitir que um usuário solicite o empréstimo de um
  livro, desde que exista ao menos um exemplar disponível.
- **RF09** — Ao aprovar uma solicitação (ou registrar um empréstimo direto), o
  sistema deve criar um empréstimo ativo vinculando o usuário a um exemplar
  específico.
- **RF10 (NOVO/DETALHADO)** — **Ao realizar um empréstimo, o sistema deve
  definir automaticamente um prazo de devolução de 14 (quatorze) dias corridos,
  contados a partir da data de saída (retirada) do livro.** Esse prazo é
  calculado pelo backend (não depende de cálculo manual do usuário ou do
  administrador) e é armazenado no banco de dados no campo `DataPrevista` da
  tabela `Emprestimo`.
- **RF11** — O prazo de devolução (`DataPrevista`) deve ser exibido na
  interface do usuário, tanto na área "Meus Empréstimos" (usuário comum) quanto
  no painel de gestão de empréstimos (administrador).
- **RF12** — O sistema deve permitir que o administrador registre a devolução
  de um livro, atualizando o status do empréstimo para `devolvido`, registrando
  a `DataDevolucao` e liberando o exemplar (`Status = Disponivel`).
- **RF13** — O sistema deve identificar automaticamente empréstimos vencidos,
  alterando seu status de `ativo` para `atrasado` quando a data atual
  ultrapassar a `DataPrevista` e a devolução ainda não tiver ocorrido.
- **RF14 (NOVO/DETALHADO)** — **Quando o prazo de devolução estiver próximo do
  vencimento (2 dias ou menos) ou for igual à data atual, o sistema deve
  enviar uma notificação (persistida no banco e por email) informando que o
  usuário possui um prazo total de 14 dias para devolver o livro emprestado e
  a data limite de devolução.**
- **RF15 (NOVO/DETALHADO)** — **Quando o empréstimo estiver em atraso (prazo
  ultrapassado), o sistema deve enviar uma notificação (persistida no banco e
  por email) deixando claro que o prazo de empréstimo era de 14 dias, qual era
  a data prevista de devolução, há quantos dias a devolução está pendente e
  que o usuário deve devolver o livro.**
- **RF16** — O sistema deve impedir que um usuário solicite um novo empréstimo
  do mesmo livro enquanto já possuir um empréstimo `ativo` ou `atrasado` desse
  título.
- **RF17** — O administrador deve poder editar manualmente os dados de um
  empréstimo (prazo de devolução, status, exemplar vinculado, observações).

## 4. Solicitações de Empréstimo

- **RF18** — O sistema deve permitir que o usuário solicite um empréstimo, que
  fica com status `pendente` até avaliação de um administrador.
- **RF19** — O administrador deve poder aprovar ou reprovar uma solicitação. Ao
  aprovar, o sistema cria automaticamente o empréstimo com o prazo de 14 dias
  (RF10) e notifica o usuário.

## 5. Notificações

- **RF20** — O sistema deve manter um histórico de notificações persistentes
  por usuário (tabela `Notificacao`), com indicação de lida/não lida.
- **RF21** — O sistema deve notificar todos os usuários quando um novo livro
  for cadastrado no acervo.
- **RF22** — O sistema deve notificar o usuário quando seu empréstimo for
  devolvido, informando que ele pode avaliar a obra.
- **RF23 (NOVO)** — O sistema deve notificar (via rotina automática diária e
  sob demanda) os usuários com empréstimos próximos do vencimento e os
  usuários com empréstimos em atraso, conforme detalhado nos RF14 e RF15.

## 6. Avaliações

- **RF24** — O sistema deve permitir que o usuário avalie (nota + comentário)
  um livro após a devolução de um empréstimo elegível.
- **RF25** — O sistema deve permitir a consulta do histórico de avaliações de
  um livro e de um usuário.

## 7. Painel Administrativo

- **RF26** — O sistema deve oferecer um painel administrativo com visão geral
  de empréstimos, solicitações, exemplares e usuários.
- **RF27** — O painel administrativo deve destacar visualmente os empréstimos
  em atraso (badge/realce de linha) e permitir filtrar por status
  (`ativo`, `atrasado`, `devolvido`).

## 8. Assistente Virtual (Kairos IA)

- **RF28** — O sistema deve oferecer um assistente de chat (IA) capaz de tirar
  dúvidas sobre o funcionamento da biblioteca, incluindo o prazo de
  empréstimo de 14 dias.
