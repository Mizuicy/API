-- ============================================================
-- MIGRAÇÃO: Tabela de Notificações — Kairos Biblioteca
-- Execute este script no banco ANTES de reiniciar o servidor.
-- Banco alvo: Devolucao (ou o nome definido em DB_NAME no .env)
-- ============================================================

USE Devolucao;

-- Cria tabela de notificações persistentes
CREATE TABLE IF NOT EXISTS Notificacao (
    Notificacao_id  INT AUTO_INCREMENT PRIMARY KEY,
    Usuario_id      INT NOT NULL,
    Emprestimo_id   INT,
    Tipo            VARCHAR(50)  NOT NULL DEFAULT 'vencimento',
    Mensagem        TEXT         NOT NULL,
    Lida            TINYINT(1)   NOT NULL DEFAULT 0,
    CriadaEm        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_usuario    FOREIGN KEY (Usuario_id)    REFERENCES Usuario(Usuario_id)    ON DELETE CASCADE,
    CONSTRAINT fk_notif_emprestimo FOREIGN KEY (Emprestimo_id) REFERENCES Emprestimo(Emprestimo_id) ON DELETE CASCADE
);

-- Índice para consultas por usuário (performance)
CREATE INDEX IF NOT EXISTS idx_notif_usuario ON Notificacao(Usuario_id, Lida);

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
