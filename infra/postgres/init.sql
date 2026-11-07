-- Fase 0: solo la base utilizada por las pruebas e2e.
-- La base principal (`pos`) la crea POSTGRES_DB al inicializar el contenedor.
CREATE DATABASE pos_test OWNER pos;
