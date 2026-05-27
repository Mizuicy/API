USE Devolucao;

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

DROP PROCEDURE IF EXISTS criar_idx_notif_tipo;
DELIMITER $$
CREATE PROCEDURE criar_idx_notif_tipo()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'Notificacao'
      AND INDEX_NAME   = 'idx_notif_tipo'
  ) THEN
    CREATE INDEX idx_notif_tipo ON Notificacao(Usuario_id, Tipo, Lida);
  END IF;
END$$
DELIMITER ;
CALL criar_idx_notif_tipo();
DROP PROCEDURE IF EXISTS criar_idx_notif_tipo;
