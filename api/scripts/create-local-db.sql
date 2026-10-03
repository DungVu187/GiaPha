-- Chạy một lần bằng user postgres trên máy dev. CREATEDB cần cho shadow DB của `prisma migrate dev`.
CREATE ROLE giapha LOGIN PASSWORD 'giapha' CREATEDB;
CREATE DATABASE giapha OWNER giapha;
CREATE DATABASE giapha_test OWNER giapha;
