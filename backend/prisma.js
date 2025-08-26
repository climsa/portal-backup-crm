// File: prisma.js
// Tujuan: Menginisialisasi dan mengekspor instance tunggal dari Prisma Client.

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
