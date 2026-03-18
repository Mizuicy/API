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

-- 4) Tabela Livro
CREATE TABLE IF NOT EXISTS Livro (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  autor VARCHAR(255) NOT NULL,
  editora VARCHAR(255) NOT NULL,
  ano_publicacao INT NOT NULL,
  idioma VARCHAR(100) NOT NULL,
  numero_paginas INT NOT NULL,
  classificacao_etaria VARCHAR(50) NOT NULL,
  genero VARCHAR(100) NOT NULL,
  resumo LONGTEXT NOT NULL,
  capa VARCHAR(500) NOT NULL,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5) Tabela Emprestimo
CREATE TABLE IF NOT EXISTS Emprestimo (
  Emprestimo_id INT AUTO_INCREMENT PRIMARY KEY,
  Usuario_id INT NOT NULL,
  Livro_id INT,
  DataEmprestimo DATE NOT NULL,
  DataDevolucao DATE,
  Status ENUM('Pendente', 'Devolvido', 'Atrasado') DEFAULT 'Pendente',
  FOREIGN KEY (Usuario_id) REFERENCES Usuario(Usuario_id) ON DELETE CASCADE,
  FOREIGN KEY (Livro_id) REFERENCES Livro(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
