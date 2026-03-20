-- Inicialização do banco de dados para o projeto

-- 1) Cria o banco de dados
CREATE DATABASE IF NOT EXISTS devolucao CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2) Usa o banco de dados
USE devolucao;

-- 3) Cria a tabela de usuários
CREATE TABLE IF NOT EXISTS Usuario (
  Usuario_id INT AUTO_INCREMENT PRIMARY KEY,
  Nome VARCHAR(255) NOT NULL,
  Email VARCHAR(255) NOT NULL UNIQUE,
  Senha VARCHAR(255) NOT NULL,
  Telefone VARCHAR(50),
  CPF VARCHAR(20) NOT NULL UNIQUE,
  DataNascimento DATE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--4) Tabela Emprestimo
CREATE TABLE IF NOT EXISTS Emprestimo (
  Emprestimo_id INT AUTO_INCREMENT PRIMARY KEY,
  Usuario_id INT NOT NULL,
  Livro_id INT NOT NULL,
  DataEmprestimo DATE NOT NULL,
  DataDevolucao DATE,
  Status ENUM('Pendente', 'Devolvido', 'Atrasado') DEFAULT 'Pendente',
  FOREIGN KEY (Usuario_id) REFERENCES Usuario(Usuario_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--4) Tabela Livro
CREATE TABLE IF NOT EXISTS Livro (
  Livro_id INT AUTO_INCREMENT PRIMARY KEY,
  Titulo VARCHAR(255) NOT NULL,
  Autor VARCHAR(255) NOT NULL,
  ISBN VARCHAR(20) NOT NULL UNIQUE,
  Editora VARCHAR(255),
  AnoPublicacao INT NOT NULL,
  Categoria VARCHAR(100),
  Descricao TEXT,
  DataCadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; /* Define o mecanismo de armazenamento e o conjunto de caracteres */
