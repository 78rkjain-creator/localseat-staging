/**
 * Seed script for LocalSeat — foundation + address structure.
 *
 * Creates:
 *   - 1 campaign (Owen Sound Ward 4 — 2026)
 *   - 13 users across all roles (password: "password")
 *   - 6 system/user-facing tags
 *   - 555 addresses across 16 real Owen Sound streets (pre-geocoded)
 *   - 555 households (100×1 + 200×2 + 100×3 + 75×4 + 80×5)
 *   - 1500 placeholder voter records
 *
 * Run: npm run db:seed
 */

import { PrismaClient, SupportLevel, CanvassOutcome, DonorStatus, OutreachChannel } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// ── Pre-geocoded coordinates ───────────────────────────────────────────────
// Keyed by "${streetNumber} ${streetName}". Streets not present here will
// be seeded with null coords and geocoded on first use.

const GEOCODED_COORDS: Record<string, { lat: number; lng: number }> = {
  "2 2nd Ave E": { lat: 44.563034, lng: -80.941584 },
  "4 2nd Ave E": { lat: 44.563035, lng: -80.941584 },
  "6 2nd Ave E": { lat: 44.563036, lng: -80.941584 },
  "8 2nd Ave E": { lat: 44.563037, lng: -80.941585 },
  "10 2nd Ave E": { lat: 44.563038, lng: -80.941585 },
  "12 2nd Ave E": { lat: 44.563039, lng: -80.941585 },
  "14 2nd Ave E": { lat: 44.56304, lng: -80.941585 },
  "16 2nd Ave E": { lat: 44.563041, lng: -80.941586 },
  "18 2nd Ave E": { lat: 44.563042, lng: -80.941586 },
  "20 2nd Ave E": { lat: 44.563043, lng: -80.941586 },
  "22 2nd Ave E": { lat: 44.563044, lng: -80.941586 },
  "24 2nd Ave E": { lat: 44.563045, lng: -80.941587 },
  "26 2nd Ave E": { lat: 44.563046, lng: -80.941587 },
  "28 2nd Ave E": { lat: 44.563047, lng: -80.941587 },
  "30 2nd Ave E": { lat: 44.563048, lng: -80.941587 },
  "32 2nd Ave E": { lat: 44.563049, lng: -80.941588 },
  "34 2nd Ave E": { lat: 44.56305, lng: -80.941588 },
  "36 2nd Ave E": { lat: 44.563051, lng: -80.941588 },
  "38 2nd Ave E": { lat: 44.563052, lng: -80.941588 },
  "40 2nd Ave E": { lat: 44.563053, lng: -80.941589 },
  "42 2nd Ave E": { lat: 44.563054, lng: -80.941589 },
  "44 2nd Ave E": { lat: 44.563055, lng: -80.941589 },
  "46 2nd Ave E": { lat: 44.563056, lng: -80.941589 },
  "48 2nd Ave E": { lat: 44.563057, lng: -80.94159 },
  "50 2nd Ave E": { lat: 44.563058, lng: -80.94159 },
  "52 2nd Ave E": { lat: 44.563059, lng: -80.94159 },
  "54 2nd Ave E": { lat: 44.56306, lng: -80.94159 },
  "56 2nd Ave E": { lat: 44.563061, lng: -80.941591 },
  "58 2nd Ave E": { lat: 44.563062, lng: -80.941591 },
  "60 2nd Ave E": { lat: 44.563063, lng: -80.941591 },
  "62 2nd Ave E": { lat: 44.563064, lng: -80.941591 },
  "64 2nd Ave E": { lat: 44.563065, lng: -80.941592 },
  "66 2nd Ave E": { lat: 44.563066, lng: -80.941592 },
  "68 2nd Ave E": { lat: 44.563067, lng: -80.941592 },
  "70 2nd Ave E": { lat: 44.563068, lng: -80.941592 },
  "2 2nd Ave W": { lat: 44.563034, lng: -80.948 },
  "4 2nd Ave W": { lat: 44.563035, lng: -80.948 },
  "6 2nd Ave W": { lat: 44.563036, lng: -80.948 },
  "8 2nd Ave W": { lat: 44.563037, lng: -80.948 },
  "10 2nd Ave W": { lat: 44.563038, lng: -80.948 },
  "12 2nd Ave W": { lat: 44.563039, lng: -80.948 },
  "14 2nd Ave W": { lat: 44.56304, lng: -80.948 },
  "16 2nd Ave W": { lat: 44.563041, lng: -80.948 },
  "18 2nd Ave W": { lat: 44.563042, lng: -80.948 },
  "20 2nd Ave W": { lat: 44.563043, lng: -80.948 },
  "22 2nd Ave W": { lat: 44.563044, lng: -80.948 },
  "24 2nd Ave W": { lat: 44.563045, lng: -80.948 },
  "26 2nd Ave W": { lat: 44.563046, lng: -80.948 },
  "28 2nd Ave W": { lat: 44.563047, lng: -80.948 },
  "30 2nd Ave W": { lat: 44.563048, lng: -80.948 },
  "32 2nd Ave W": { lat: 44.563049, lng: -80.948 },
  "34 2nd Ave W": { lat: 44.56305, lng: -80.948 },
  "36 2nd Ave W": { lat: 44.563051, lng: -80.948 },
  "38 2nd Ave W": { lat: 44.563052, lng: -80.948 },
  "40 2nd Ave W": { lat: 44.563053, lng: -80.948 },
  "42 2nd Ave W": { lat: 44.563054, lng: -80.948 },
  "44 2nd Ave W": { lat: 44.563055, lng: -80.948 },
  "46 2nd Ave W": { lat: 44.563056, lng: -80.948 },
  "48 2nd Ave W": { lat: 44.563057, lng: -80.948 },
  "50 2nd Ave W": { lat: 44.563058, lng: -80.948 },
  "52 2nd Ave W": { lat: 44.563059, lng: -80.948 },
  "54 2nd Ave W": { lat: 44.56306, lng: -80.948 },
  "56 2nd Ave W": { lat: 44.563061, lng: -80.948 },
  "58 2nd Ave W": { lat: 44.563062, lng: -80.948 },
  "60 2nd Ave W": { lat: 44.563063, lng: -80.948 },
  "62 2nd Ave W": { lat: 44.563064, lng: -80.948 },
  "64 2nd Ave W": { lat: 44.563065, lng: -80.948 },
  "66 2nd Ave W": { lat: 44.563066, lng: -80.948 },
  "68 2nd Ave W": { lat: 44.563067, lng: -80.948 },
  "70 2nd Ave W": { lat: 44.563068, lng: -80.948 },
  "2 3rd Ave E": { lat: 44.558775, lng: -80.939352 },
  "4 3rd Ave E": { lat: 44.558775, lng: -80.939352 },
  "6 3rd Ave E": { lat: 44.558776, lng: -80.939352 },
  "8 3rd Ave E": { lat: 44.558776, lng: -80.939353 },
  "10 3rd Ave E": { lat: 44.558777, lng: -80.939353 },
  "12 3rd Ave E": { lat: 44.558778, lng: -80.939353 },
  "14 3rd Ave E": { lat: 44.558778, lng: -80.939353 },
  "16 3rd Ave E": { lat: 44.558779, lng: -80.939353 },
  "18 3rd Ave E": { lat: 44.55878, lng: -80.939354 },
  "20 3rd Ave E": { lat: 44.55878, lng: -80.939354 },
  "22 3rd Ave E": { lat: 44.558781, lng: -80.939354 },
  "24 3rd Ave E": { lat: 44.558782, lng: -80.939354 },
  "26 3rd Ave E": { lat: 44.558783, lng: -80.939354 },
  "28 3rd Ave E": { lat: 44.558783, lng: -80.939354 },
  "30 3rd Ave E": { lat: 44.558784, lng: -80.939354 },
  "32 3rd Ave E": { lat: 44.558785, lng: -80.939354 },
  "34 3rd Ave E": { lat: 44.558785, lng: -80.939354 },
  "36 3rd Ave E": { lat: 44.558786, lng: -80.939355 },
  "38 3rd Ave E": { lat: 44.558787, lng: -80.939355 },
  "40 3rd Ave E": { lat: 44.558788, lng: -80.939355 },
  "42 3rd Ave E": { lat: 44.558788, lng: -80.939355 },
  "44 3rd Ave E": { lat: 44.558789, lng: -80.939355 },
  "46 3rd Ave E": { lat: 44.55879, lng: -80.939355 },
  "48 3rd Ave E": { lat: 44.55879, lng: -80.939355 },
  "50 3rd Ave E": { lat: 44.558791, lng: -80.939356 },
  "52 3rd Ave E": { lat: 44.558792, lng: -80.939356 },
  "54 3rd Ave E": { lat: 44.558792, lng: -80.939356 },
  "56 3rd Ave E": { lat: 44.558793, lng: -80.939356 },
  "58 3rd Ave E": { lat: 44.558794, lng: -80.939356 },
  "60 3rd Ave E": { lat: 44.558794, lng: -80.939356 },
  "62 3rd Ave E": { lat: 44.558795, lng: -80.939356 },
  "64 3rd Ave E": { lat: 44.558796, lng: -80.939357 },
  "66 3rd Ave E": { lat: 44.558797, lng: -80.939357 },
  "68 3rd Ave E": { lat: 44.558797, lng: -80.939357 },
  "70 3rd Ave E": { lat: 44.558798, lng: -80.939357 },
  "2 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "4 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "6 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "8 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "10 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "12 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "14 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "16 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "18 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "20 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "22 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "24 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "26 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "28 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "30 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "32 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "34 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "36 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "38 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "40 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "42 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "44 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "46 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "48 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "50 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "52 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "54 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "56 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "58 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "60 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "62 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "64 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "66 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "68 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "70 3rd Ave W": { lat: 44.554557, lng: -80.944567 },
  "2 4th Ave E": { lat: 44.556896, lng: -80.937044 },
  "4 4th Ave E": { lat: 44.556897, lng: -80.937044 },
  "6 4th Ave E": { lat: 44.556898, lng: -80.937044 },
  "8 4th Ave E": { lat: 44.556898, lng: -80.937045 },
  "10 4th Ave E": { lat: 44.556899, lng: -80.937045 },
  "12 4th Ave E": { lat: 44.5569, lng: -80.937045 },
  "14 4th Ave E": { lat: 44.5569, lng: -80.937045 },
  "16 4th Ave E": { lat: 44.556901, lng: -80.937045 },
  "18 4th Ave E": { lat: 44.556902, lng: -80.937045 },
  "20 4th Ave E": { lat: 44.556902, lng: -80.937046 },
  "22 4th Ave E": { lat: 44.556903, lng: -80.937046 },
  "24 4th Ave E": { lat: 44.556903, lng: -80.937046 },
  "26 4th Ave E": { lat: 44.556904, lng: -80.937046 },
  "28 4th Ave E": { lat: 44.556905, lng: -80.937046 },
  "30 4th Ave E": { lat: 44.556905, lng: -80.937046 },
  "32 4th Ave E": { lat: 44.556906, lng: -80.937046 },
  "34 4th Ave E": { lat: 44.556907, lng: -80.937047 },
  "36 4th Ave E": { lat: 44.556907, lng: -80.937047 },
  "38 4th Ave E": { lat: 44.556908, lng: -80.937047 },
  "40 4th Ave E": { lat: 44.556909, lng: -80.937047 },
  "42 4th Ave E": { lat: 44.556909, lng: -80.937047 },
  "44 4th Ave E": { lat: 44.55691, lng: -80.937047 },
  "46 4th Ave E": { lat: 44.556911, lng: -80.937048 },
  "48 4th Ave E": { lat: 44.556911, lng: -80.937048 },
  "50 4th Ave E": { lat: 44.556912, lng: -80.937048 },
  "52 4th Ave E": { lat: 44.556913, lng: -80.937048 },
  "54 4th Ave E": { lat: 44.556913, lng: -80.937048 },
  "56 4th Ave E": { lat: 44.556914, lng: -80.937048 },
  "58 4th Ave E": { lat: 44.556915, lng: -80.937049 },
  "60 4th Ave E": { lat: 44.556915, lng: -80.937049 },
  "62 4th Ave E": { lat: 44.556916, lng: -80.937049 },
  "64 4th Ave E": { lat: 44.556917, lng: -80.937049 },
  "66 4th Ave E": { lat: 44.556917, lng: -80.937049 },
  "68 4th Ave E": { lat: 44.556918, lng: -80.937049 },
  "70 4th Ave E": { lat: 44.556918, lng: -80.93705 },
  "2 4th Ave W": { lat: 44.549883, lng: -80.94557 },
  "4 4th Ave W": { lat: 44.549886, lng: -80.945571 },
  "6 4th Ave W": { lat: 44.54989, lng: -80.945572 },
  "8 4th Ave W": { lat: 44.549893, lng: -80.945573 },
  "10 4th Ave W": { lat: 44.549897, lng: -80.945574 },
  "12 4th Ave W": { lat: 44.5499, lng: -80.945574 },
  "14 4th Ave W": { lat: 44.549904, lng: -80.945575 },
  "16 4th Ave W": { lat: 44.549907, lng: -80.945576 },
  "18 4th Ave W": { lat: 44.549911, lng: -80.945577 },
  "20 4th Ave W": { lat: 44.549914, lng: -80.945578 },
  "22 4th Ave W": { lat: 44.549918, lng: -80.945578 },
  "24 4th Ave W": { lat: 44.549921, lng: -80.945579 },
  "26 4th Ave W": { lat: 44.549925, lng: -80.94558 },
  "28 4th Ave W": { lat: 44.549929, lng: -80.945581 },
  "30 4th Ave W": { lat: 44.548541, lng: -80.945417 },
  "32 4th Ave W": { lat: 44.548084, lng: -80.94517 },
  "34 4th Ave W": { lat: 44.548146, lng: -80.945184 },
  "36 4th Ave W": { lat: 44.548208, lng: -80.945197 },
  "38 4th Ave W": { lat: 44.54827, lng: -80.945211 },
  "40 4th Ave W": { lat: 44.54887, lng: -80.945498 },
  "42 4th Ave W": { lat: 44.548394, lng: -80.945238 },
  "44 4th Ave W": { lat: 44.548456, lng: -80.945251 },
  "46 4th Ave W": { lat: 44.548518, lng: -80.945264 },
  "48 4th Ave W": { lat: 44.548935, lng: -80.945512 },
  "50 4th Ave W": { lat: 44.549086, lng: -80.94554 },
  "52 4th Ave W": { lat: 44.548704, lng: -80.945305 },
  "54 4th Ave W": { lat: 44.548767, lng: -80.945318 },
  "56 4th Ave W": { lat: 44.548829, lng: -80.945332 },
  "58 4th Ave W": { lat: 44.548891, lng: -80.945345 },
  "60 4th Ave W": { lat: 44.549267, lng: -80.945584 },
  "62 4th Ave W": { lat: 44.549015, lng: -80.945372 },
  "64 4th Ave W": { lat: 44.549076, lng: -80.945387 },
  "66 4th Ave W": { lat: 44.549138, lng: -80.945401 },
  "68 4th Ave W": { lat: 44.5492, lng: -80.945415 },
  "70 4th Ave W": { lat: 44.549405, lng: -80.945618 },
  "2 5th Ave E": { lat: 44.550872, lng: -80.932904 },
  "4 5th Ave E": { lat: 44.550873, lng: -80.932913 },
  "6 5th Ave E": { lat: 44.550874, lng: -80.932922 },
  "8 5th Ave E": { lat: 44.550875, lng: -80.932932 },
  "10 5th Ave E": { lat: 44.550876, lng: -80.932941 },
  "12 5th Ave E": { lat: 44.550877, lng: -80.932951 },
  "14 5th Ave E": { lat: 44.550878, lng: -80.93296 },
  "16 5th Ave E": { lat: 44.550879, lng: -80.932969 },
  "18 5th Ave E": { lat: 44.55088, lng: -80.932979 },
  "20 5th Ave E": { lat: 44.55088, lng: -80.932988 },
  "22 5th Ave E": { lat: 44.550881, lng: -80.932998 },
  "24 5th Ave E": { lat: 44.550882, lng: -80.933007 },
  "26 5th Ave E": { lat: 44.550883, lng: -80.933016 },
  "28 5th Ave E": { lat: 44.550884, lng: -80.933026 },
  "30 5th Ave E": { lat: 44.550885, lng: -80.933035 },
  "32 5th Ave E": { lat: 44.550886, lng: -80.933045 },
  "34 5th Ave E": { lat: 44.550887, lng: -80.933054 },
  "36 5th Ave E": { lat: 44.550888, lng: -80.933063 },
  "38 5th Ave E": { lat: 44.550888, lng: -80.933073 },
  "40 5th Ave E": { lat: 44.550889, lng: -80.933082 },
  "42 5th Ave E": { lat: 44.55089, lng: -80.933092 },
  "44 5th Ave E": { lat: 44.550891, lng: -80.933101 },
  "46 5th Ave E": { lat: 44.55089, lng: -80.93311 },
  "48 5th Ave E": { lat: 44.55089, lng: -80.93312 },
  "50 5th Ave E": { lat: 44.550889, lng: -80.933129 },
  "52 5th Ave E": { lat: 44.550889, lng: -80.933139 },
  "54 5th Ave E": { lat: 44.550888, lng: -80.933148 },
  "56 5th Ave E": { lat: 44.550887, lng: -80.933158 },
  "58 5th Ave E": { lat: 44.550885, lng: -80.933167 },
  "60 5th Ave E": { lat: 44.550884, lng: -80.933176 },
  "62 5th Ave E": { lat: 44.550882, lng: -80.933185 },
  "64 5th Ave E": { lat: 44.550881, lng: -80.933195 },
  "66 5th Ave E": { lat: 44.550879, lng: -80.933204 },
  "68 5th Ave E": { lat: 44.550876, lng: -80.933213 },
  "70 5th Ave E": { lat: 44.550874, lng: -80.933222 },
  "2 5th Ave W": { lat: 44.548824, lng: -80.946488 },
  "4 5th Ave W": { lat: 44.548827, lng: -80.946489 },
  "6 5th Ave W": { lat: 44.548831, lng: -80.94649 },
  "8 5th Ave W": { lat: 44.548834, lng: -80.946491 },
  "10 5th Ave W": { lat: 44.548837, lng: -80.946491 },
  "12 5th Ave W": { lat: 44.548841, lng: -80.946492 },
  "14 5th Ave W": { lat: 44.548844, lng: -80.946493 },
  "16 5th Ave W": { lat: 44.548848, lng: -80.946493 },
  "18 5th Ave W": { lat: 44.548851, lng: -80.946494 },
  "20 5th Ave W": { lat: 44.548854, lng: -80.946495 },
  "22 5th Ave W": { lat: 44.548858, lng: -80.946496 },
  "24 5th Ave W": { lat: 44.548861, lng: -80.946496 },
  "26 5th Ave W": { lat: 44.548865, lng: -80.946497 },
  "28 5th Ave W": { lat: 44.548868, lng: -80.946498 },
  "30 5th Ave W": { lat: 44.548871, lng: -80.946499 },
  "32 5th Ave W": { lat: 44.548875, lng: -80.946499 },
  "34 5th Ave W": { lat: 44.548878, lng: -80.9465 },
  "36 5th Ave W": { lat: 44.548882, lng: -80.946501 },
  "38 5th Ave W": { lat: 44.548885, lng: -80.946502 },
  "40 5th Ave W": { lat: 44.548888, lng: -80.946502 },
  "42 5th Ave W": { lat: 44.548892, lng: -80.946503 },
  "44 5th Ave W": { lat: 44.548895, lng: -80.946504 },
  "46 5th Ave W": { lat: 44.548899, lng: -80.946504 },
  "48 5th Ave W": { lat: 44.548902, lng: -80.946505 },
  "50 5th Ave W": { lat: 44.548905, lng: -80.946506 },
  "52 5th Ave W": { lat: 44.548909, lng: -80.946507 },
  "54 5th Ave W": { lat: 44.548912, lng: -80.946507 },
  "56 5th Ave W": { lat: 44.548916, lng: -80.946508 },
  "58 5th Ave W": { lat: 44.548919, lng: -80.946509 },
  "60 5th Ave W": { lat: 44.548922, lng: -80.94651 },
  "62 5th Ave W": { lat: 44.548926, lng: -80.94651 },
  "64 5th Ave W": { lat: 44.548929, lng: -80.946511 },
  "66 5th Ave W": { lat: 44.548933, lng: -80.946512 },
  "68 5th Ave W": { lat: 44.548936, lng: -80.946512 },
  "2 6th Ave E": { lat: 44.55182, lng: -80.930988 },
  "4 6th Ave E": { lat: 44.551821, lng: -80.930987 },
  "6 6th Ave E": { lat: 44.551823, lng: -80.930987 },
  "8 6th Ave E": { lat: 44.551824, lng: -80.930986 },
  "10 6th Ave E": { lat: 44.551826, lng: -80.930986 },
  "12 6th Ave E": { lat: 44.551827, lng: -80.930986 },
  "14 6th Ave E": { lat: 44.551829, lng: -80.930985 },
  "16 6th Ave E": { lat: 44.551831, lng: -80.930985 },
  "18 6th Ave E": { lat: 44.551832, lng: -80.930984 },
  "20 6th Ave E": { lat: 44.551834, lng: -80.930984 },
  "22 6th Ave E": { lat: 44.551835, lng: -80.930984 },
  "24 6th Ave E": { lat: 44.551837, lng: -80.930983 },
  "26 6th Ave E": { lat: 44.551838, lng: -80.930983 },
  "28 6th Ave E": { lat: 44.55184, lng: -80.930982 },
  "30 6th Ave E": { lat: 44.551841, lng: -80.930982 },
  "32 6th Ave E": { lat: 44.551843, lng: -80.930981 },
  "34 6th Ave E": { lat: 44.551844, lng: -80.930981 },
  "36 6th Ave E": { lat: 44.551846, lng: -80.93098 },
  "38 6th Ave E": { lat: 44.551847, lng: -80.93098 },
  "40 6th Ave E": { lat: 44.551849, lng: -80.93098 },
  "42 6th Ave E": { lat: 44.551851, lng: -80.930979 },
  "44 6th Ave E": { lat: 44.551852, lng: -80.930979 },
  "46 6th Ave E": { lat: 44.551854, lng: -80.930978 },
  "48 6th Ave E": { lat: 44.551855, lng: -80.930978 },
  "50 6th Ave E": { lat: 44.551857, lng: -80.930978 },
  "52 6th Ave E": { lat: 44.551858, lng: -80.930977 },
  "54 6th Ave E": { lat: 44.55186, lng: -80.930977 },
  "56 6th Ave E": { lat: 44.551861, lng: -80.930976 },
  "58 6th Ave E": { lat: 44.551863, lng: -80.930976 },
  "60 6th Ave E": { lat: 44.551864, lng: -80.930975 },
  "62 6th Ave E": { lat: 44.551866, lng: -80.930975 },
  "64 6th Ave E": { lat: 44.551868, lng: -80.930974 },
  "66 6th Ave E": { lat: 44.551869, lng: -80.930974 },
  "68 6th Ave E": { lat: 44.551871, lng: -80.930974 },
  "70 6th Ave E": { lat: 44.551872, lng: -80.930973 },
  "2 7th Ave E": { lat: 44.548822, lng: -80.929896 },
  "4 7th Ave E": { lat: 44.548879, lng: -80.929877 },
  "6 7th Ave E": { lat: 44.548935, lng: -80.929857 },
  "8 7th Ave E": { lat: 44.548992, lng: -80.929837 },
  "10 7th Ave E": { lat: 44.549048, lng: -80.929818 },
  "12 7th Ave E": { lat: 44.549105, lng: -80.929798 },
  "14 7th Ave E": { lat: 44.549161, lng: -80.929778 },
  "16 7th Ave E": { lat: 44.549218, lng: -80.929759 },
  "18 7th Ave E": { lat: 44.549274, lng: -80.929739 },
  "20 7th Ave E": { lat: 44.549331, lng: -80.929719 },
  "22 7th Ave E": { lat: 44.549387, lng: -80.9297 },
  "24 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "26 7th Ave E": { lat: 44.549503, lng: -80.929669 },
  "28 7th Ave E": { lat: 44.549561, lng: -80.929657 },
  "30 7th Ave E": { lat: 44.54962, lng: -80.929646 },
  "32 7th Ave E": { lat: 44.549679, lng: -80.929634 },
  "34 7th Ave E": { lat: 44.549738, lng: -80.929623 },
  "36 7th Ave E": { lat: 44.549235, lng: -80.929753 },
  "38 7th Ave E": { lat: 44.550143, lng: -80.929613 },
  "40 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "42 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "44 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "46 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "48 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "50 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "52 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "54 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "56 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "58 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "60 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "62 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "64 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "66 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "68 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "70 7th Ave E": { lat: 44.549444, lng: -80.92968 },
  "2 8th Ave E": { lat: 44.555721, lng: -80.929348 },
  "4 8th Ave E": { lat: 44.555723, lng: -80.929349 },
  "6 8th Ave E": { lat: 44.555725, lng: -80.929349 },
  "8 8th Ave E": { lat: 44.555727, lng: -80.92935 },
  "10 8th Ave E": { lat: 44.555729, lng: -80.92935 },
  "12 8th Ave E": { lat: 44.555731, lng: -80.929351 },
  "14 8th Ave E": { lat: 44.555733, lng: -80.929351 },
  "16 8th Ave E": { lat: 44.555735, lng: -80.929352 },
  "18 8th Ave E": { lat: 44.555737, lng: -80.929353 },
  "20 8th Ave E": { lat: 44.555739, lng: -80.929353 },
  "22 8th Ave E": { lat: 44.555741, lng: -80.929354 },
  "24 8th Ave E": { lat: 44.555743, lng: -80.929354 },
  "26 8th Ave E": { lat: 44.555745, lng: -80.929355 },
  "28 8th Ave E": { lat: 44.555747, lng: -80.929355 },
  "30 8th Ave E": { lat: 44.555749, lng: -80.929356 },
  "32 8th Ave E": { lat: 44.555751, lng: -80.929356 },
  "34 8th Ave E": { lat: 44.555753, lng: -80.929357 },
  "36 8th Ave E": { lat: 44.555755, lng: -80.929357 },
  "38 8th Ave E": { lat: 44.555757, lng: -80.929358 },
  "40 8th Ave E": { lat: 44.555759, lng: -80.929358 },
  "42 8th Ave E": { lat: 44.555761, lng: -80.929359 },
  "44 8th Ave E": { lat: 44.555763, lng: -80.929359 },
  "46 8th Ave E": { lat: 44.555765, lng: -80.92936 },
  "48 8th Ave E": { lat: 44.555767, lng: -80.92936 },
  "50 8th Ave E": { lat: 44.555769, lng: -80.929361 },
  "52 8th Ave E": { lat: 44.555771, lng: -80.929361 },
  "54 8th Ave E": { lat: 44.555773, lng: -80.929362 },
  "56 8th Ave E": { lat: 44.555774, lng: -80.929362 },
  "58 8th Ave E": { lat: 44.555776, lng: -80.929362 },
  "60 8th Ave E": { lat: 44.555778, lng: -80.929363 },
  "62 8th Ave E": { lat: 44.55578, lng: -80.929363 },
  "64 8th Ave E": { lat: 44.555782, lng: -80.929364 },
  "66 8th Ave E": { lat: 44.555784, lng: -80.929364 },
  "68 8th Ave E": { lat: 44.555786, lng: -80.929365 },
  "70 8th Ave E": { lat: 44.555788, lng: -80.929365 },
  "2 9th Ave E": { lat: 44.558405, lng: -80.925775 },
  "4 9th Ave E": { lat: 44.558406, lng: -80.925775 },
  "6 9th Ave E": { lat: 44.558407, lng: -80.925776 },
  "8 9th Ave E": { lat: 44.558408, lng: -80.925776 },
  "10 9th Ave E": { lat: 44.55841, lng: -80.925776 },
  "12 9th Ave E": { lat: 44.558411, lng: -80.925777 },
  "14 9th Ave E": { lat: 44.558412, lng: -80.925777 },
  "16 9th Ave E": { lat: 44.558413, lng: -80.925777 },
  "18 9th Ave E": { lat: 44.558415, lng: -80.925777 },
  "20 9th Ave E": { lat: 44.558416, lng: -80.925778 },
  "22 9th Ave E": { lat: 44.558417, lng: -80.925778 },
  "24 9th Ave E": { lat: 44.558418, lng: -80.925778 },
  "26 9th Ave E": { lat: 44.55842, lng: -80.925779 },
  "28 9th Ave E": { lat: 44.558421, lng: -80.925779 },
  "30 9th Ave E": { lat: 44.558422, lng: -80.925779 },
  "32 9th Ave E": { lat: 44.558423, lng: -80.92578 },
  "34 9th Ave E": { lat: 44.558425, lng: -80.92578 },
  "36 9th Ave E": { lat: 44.558426, lng: -80.92578 },
  "38 9th Ave E": { lat: 44.558427, lng: -80.92578 },
  "40 9th Ave E": { lat: 44.558428, lng: -80.925781 },
  "42 9th Ave E": { lat: 44.55843, lng: -80.925781 },
  "44 9th Ave E": { lat: 44.558431, lng: -80.925781 },
  "46 9th Ave E": { lat: 44.558432, lng: -80.925782 },
  "48 9th Ave E": { lat: 44.558433, lng: -80.925782 },
  "50 9th Ave E": { lat: 44.558435, lng: -80.925782 },
  "52 9th Ave E": { lat: 44.558436, lng: -80.925782 },
  "54 9th Ave E": { lat: 44.558437, lng: -80.925783 },
  "56 9th Ave E": { lat: 44.558438, lng: -80.925783 },
  "58 9th Ave E": { lat: 44.55844, lng: -80.925783 },
  "60 9th Ave E": { lat: 44.558441, lng: -80.925784 },
  "62 9th Ave E": { lat: 44.558442, lng: -80.925784 },
  "64 9th Ave E": { lat: 44.558443, lng: -80.925784 },
  "66 9th Ave E": { lat: 44.558445, lng: -80.925785 },
  "68 9th Ave E": { lat: 44.558446, lng: -80.925785 },
  "70 9th Ave E": { lat: 44.558447, lng: -80.925785 },
  "2 10th St E": { lat: 44.567585, lng: -80.944575 },
  "4 10th St E": { lat: 44.567585, lng: -80.944577 },
  "6 10th St E": { lat: 44.567584, lng: -80.944579 },
  "8 10th St E": { lat: 44.567584, lng: -80.944581 },
  "10 10th St E": { lat: 44.567654, lng: -80.943931 },
  "12 10th St E": { lat: 44.567654, lng: -80.943931 },
  "14 10th St E": { lat: 44.567654, lng: -80.943931 },
  "16 10th St E": { lat: 44.567654, lng: -80.943931 },
  "18 10th St E": { lat: 44.567654, lng: -80.943931 },
  "20 10th St E": { lat: 44.567654, lng: -80.943931 },
  "22 10th St E": { lat: 44.567654, lng: -80.943931 },
  "24 10th St E": { lat: 44.567654, lng: -80.943931 },
  "26 10th St E": { lat: 44.567654, lng: -80.943931 },
  "28 10th St E": { lat: 44.567654, lng: -80.943931 },
  "30 10th St E": { lat: 44.567654, lng: -80.943931 },
  "32 10th St E": { lat: 44.567654, lng: -80.943931 },
  "34 10th St E": { lat: 44.567654, lng: -80.943931 },
  "36 10th St E": { lat: 44.567654, lng: -80.943931 },
  "38 10th St E": { lat: 44.567654, lng: -80.943931 },
  "40 10th St E": { lat: 44.567654, lng: -80.943931 },
  "42 10th St E": { lat: 44.567654, lng: -80.943931 },
  "44 10th St E": { lat: 44.567654, lng: -80.943931 },
  "46 10th St E": { lat: 44.567654, lng: -80.943931 },
  "48 10th St E": { lat: 44.567654, lng: -80.943931 },
  "50 10th St E": { lat: 44.567654, lng: -80.943931 },
  "52 10th St E": { lat: 44.567654, lng: -80.943931 },
  "54 10th St E": { lat: 44.567654, lng: -80.943931 },
  "56 10th St E": { lat: 44.567654, lng: -80.943931 },
  "58 10th St E": { lat: 44.567654, lng: -80.943931 },
  "60 10th St E": { lat: 44.567654, lng: -80.943931 },
  "62 10th St E": { lat: 44.567654, lng: -80.943931 },
  "64 10th St E": { lat: 44.567654, lng: -80.943931 },
  "66 10th St E": { lat: 44.567654, lng: -80.943931 },
  "68 10th St E": { lat: 44.567654, lng: -80.943931 },
  "2 11th St E": { lat: 44.569423, lng: -80.944687 },
  "4 11th St E": { lat: 44.569422, lng: -80.944696 },
  "6 11th St E": { lat: 44.569421, lng: -80.944706 },
  "8 11th St E": { lat: 44.56942, lng: -80.944715 },
  "10 11th St E": { lat: 44.569418, lng: -80.944725 },
  "12 11th St E": { lat: 44.569417, lng: -80.944734 },
  "14 11th St E": { lat: 44.569416, lng: -80.944743 },
  "16 11th St E": { lat: 44.569415, lng: -80.944753 },
  "18 11th St E": { lat: 44.569413, lng: -80.944762 },
  "20 11th St E": { lat: 44.569412, lng: -80.944772 },
  "22 11th St E": { lat: 44.569411, lng: -80.944781 },
  "24 11th St E": { lat: 44.569409, lng: -80.944791 },
  "26 11th St E": { lat: 44.569408, lng: -80.9448 },
  "28 11th St E": { lat: 44.569407, lng: -80.94481 },
  "30 11th St E": { lat: 44.569406, lng: -80.944819 },
  "32 11th St E": { lat: 44.569404, lng: -80.944829 },
  "34 11th St E": { lat: 44.569403, lng: -80.944838 },
  "36 11th St E": { lat: 44.569402, lng: -80.944847 },
  "38 11th St E": { lat: 44.569401, lng: -80.944857 },
  "40 11th St E": { lat: 44.569399, lng: -80.944866 },
  "42 11th St E": { lat: 44.569398, lng: -80.944876 },
  "44 11th St E": { lat: 44.569397, lng: -80.944885 },
  "46 11th St E": { lat: 44.569396, lng: -80.944895 },
  "48 11th St E": { lat: 44.569394, lng: -80.944904 },
  "50 11th St E": { lat: 44.569393, lng: -80.944914 },
  "52 11th St E": { lat: 44.569392, lng: -80.944923 },
  "54 11th St E": { lat: 44.56939, lng: -80.944933 },
  "56 11th St E": { lat: 44.569389, lng: -80.944942 },
  "58 11th St E": { lat: 44.569388, lng: -80.944951 },
  "60 11th St E": { lat: 44.569387, lng: -80.944961 },
  "62 11th St E": { lat: 44.569385, lng: -80.94497 },
  "64 11th St E": { lat: 44.569384, lng: -80.94498 },
  "66 11th St E": { lat: 44.569383, lng: -80.944989 },
  "68 11th St E": { lat: 44.569382, lng: -80.944999 },
  "2 12th St E": { lat: 44.571557, lng: -80.924262 },
  "4 12th St E": { lat: 44.571557, lng: -80.924262 },
  "6 12th St E": { lat: 44.571557, lng: -80.924262 },
  "8 12th St E": { lat: 44.571557, lng: -80.924262 },
  "10 12th St E": { lat: 44.571557, lng: -80.924262 },
  "12 12th St E": { lat: 44.571557, lng: -80.924262 },
  "14 12th St E": { lat: 44.571557, lng: -80.924262 },
  "16 12th St E": { lat: 44.571557, lng: -80.924262 },
  "18 12th St E": { lat: 44.571557, lng: -80.924262 },
  "20 12th St E": { lat: 44.571557, lng: -80.924262 },
  "22 12th St E": { lat: 44.571557, lng: -80.924262 },
  "24 12th St E": { lat: 44.571557, lng: -80.924262 },
  "26 12th St E": { lat: 44.571557, lng: -80.924262 },
  "28 12th St E": { lat: 44.571557, lng: -80.924262 },
  "30 12th St E": { lat: 44.571557, lng: -80.924262 },
  "32 12th St E": { lat: 44.571557, lng: -80.924262 },
  "34 12th St E": { lat: 44.571557, lng: -80.924262 },
  "36 12th St E": { lat: 44.571557, lng: -80.924262 },
  "38 12th St E": { lat: 44.571557, lng: -80.924262 },
  "40 12th St E": { lat: 44.571557, lng: -80.924262 },
  "42 12th St E": { lat: 44.571557, lng: -80.924262 },
  "44 12th St E": { lat: 44.571557, lng: -80.924262 },
  "46 12th St E": { lat: 44.571557, lng: -80.924262 },
  "48 12th St E": { lat: 44.571557, lng: -80.924262 },
  "50 12th St E": { lat: 44.571557, lng: -80.924262 },
  "52 12th St E": { lat: 44.571557, lng: -80.924262 },
  "54 12th St E": { lat: 44.571557, lng: -80.924262 },
  "56 12th St E": { lat: 44.571557, lng: -80.924262 },
  "58 12th St E": { lat: 44.571557, lng: -80.924262 },
  "60 12th St E": { lat: 44.571557, lng: -80.924262 },
  "62 12th St E": { lat: 44.571557, lng: -80.924262 },
  "64 12th St E": { lat: 44.571557, lng: -80.924262 },
  "66 12th St E": { lat: 44.571557, lng: -80.924262 },
  "68 12th St E": { lat: 44.571557, lng: -80.924262 },
  "2 13th St E": { lat: 44.572957, lng: -80.937489 },
  "4 13th St E": { lat: 44.572957, lng: -80.937489 },
  "6 13th St E": { lat: 44.572957, lng: -80.937489 },
  "8 13th St E": { lat: 44.572957, lng: -80.937489 },
  "10 13th St E": { lat: 44.572957, lng: -80.937489 },
  "12 13th St E": { lat: 44.572957, lng: -80.937489 },
  "14 13th St E": { lat: 44.572957, lng: -80.937489 },
  "16 13th St E": { lat: 44.572957, lng: -80.937489 },
  "18 13th St E": { lat: 44.572957, lng: -80.937489 },
  "20 13th St E": { lat: 44.572957, lng: -80.937489 },
  "22 13th St E": { lat: 44.572957, lng: -80.937489 },
  "24 13th St E": { lat: 44.572957, lng: -80.937489 },
  "26 13th St E": { lat: 44.572957, lng: -80.937489 },
  "28 13th St E": { lat: 44.572957, lng: -80.937489 },
  "30 13th St E": { lat: 44.572957, lng: -80.937489 },
  "32 13th St E": { lat: 44.572957, lng: -80.937489 },
  "34 13th St E": { lat: 44.572957, lng: -80.937489 },
  "36 13th St E": { lat: 44.572957, lng: -80.937489 },
  "38 13th St E": { lat: 44.572957, lng: -80.937489 },
  "40 13th St E": { lat: 44.572957, lng: -80.937489 },
  "42 13th St E": { lat: 44.572957, lng: -80.937489 },
  "44 13th St E": { lat: 44.572957, lng: -80.937489 },
  "46 13th St E": { lat: 44.572957, lng: -80.937489 },
  "48 13th St E": { lat: 44.572957, lng: -80.937489 },
  "50 13th St E": { lat: 44.572957, lng: -80.937489 },
  "52 13th St E": { lat: 44.572957, lng: -80.937489 },
  "54 13th St E": { lat: 44.572957, lng: -80.937489 },
  "56 13th St E": { lat: 44.572957, lng: -80.937489 },
  "58 13th St E": { lat: 44.572957, lng: -80.937489 },
  "60 13th St E": { lat: 44.572957, lng: -80.937489 },
  "62 13th St E": { lat: 44.57224, lng: -80.945423 },
  "64 13th St E": { lat: 44.57224, lng: -80.945427 },
  "66 13th St E": { lat: 44.572241, lng: -80.94543 },
  "68 13th St E": { lat: 44.572242, lng: -80.945434 },
};
const VERIFIED = new Date();

// ── Cultural name pools ───────────────────────────────────────────────────────
const GROUPS = [
  {
    first: ["James","William","Thomas","Robert","David","Michael","John","Richard","Charles","George","Mary","Patricia","Linda","Barbara","Elizabeth","Jennifer","Susan","Margaret","Dorothy","Helen","Daniel","Matthew","Andrew","Joshua","Ryan","Emma","Olivia","Sophia","Charlotte","Grace"],
    last:  ["Smith","Johnson","Brown","Wilson","Taylor","Anderson","Thomas","Martin","White","Harris"],
  },
  {
    first: ["Jean","Pierre","Michel","François","Philippe","André","Louis","Jacques","Henri","Luc","Marie","Isabelle","Sophie","Camille","Amélie","Claire","Nathalie","Céline","Monique","Brigitte"],
    last:  ["Tremblay","Gagnon","Roy","Côté","Bouchard","Lavoie","Fortin","Gauthier","Morin","Pelletier"],
  },
  {
    first: ["Rahul","Arjun","Vikram","Suresh","Rajesh","Amit","Priya","Anjali","Deepa","Sunita","Neha","Pooja","Kavya","Ravi","Anil","Sanjay","Meera","Divya","Kiran","Manish"],
    last:  ["Patel","Singh","Kumar","Sharma","Jain","Shah","Mehta","Gupta","Verma","Agarwal"],
  },
  {
    first: ["Wei","Ming","Jun","Fang","Yan","Hui","Lin","Ying","Hong","Xiao","Jing","Tao","Yong","Feng","Lei","Na","Hua","Bo","Chen","Li"],
    last:  ["Chen","Wang","Li","Zhang","Liu","Huang","Wu","Yang","Zhou","Xu"],
  },
  {
    first: ["Kwame","Kofi","Emeka","Chidi","Tunde","Yaw","Ade","Bayo","Seun","Dele","Amara","Nkechi","Fatima","Zainab","Aisha","Yewande","Folake","Ngozi","Chiamaka","Abena"],
    last:  ["Okafor","Mensah","Diallo","Nkosi","Owusu","Adeyemi","Ibrahim","Kamara","Diop","Asante"],
  },
];

function culturalGroup(hhIdx: number) {
  const pos = hhIdx % 100;
  if (pos < 30) return GROUPS[0];
  if (pos < 50) return GROUPS[1];
  if (pos < 70) return GROUPS[2];
  if (pos < 85) return GROUPS[3];
  return GROUPS[4];
}

function supportLevel(personIdx: number): string | null {
  if (personIdx <  225) return "strong_yes";
  if (personIdx <  405) return "soft_yes";
  if (personIdx <  630) return "undecided";
  if (personIdx <  765) return "soft_no";
  if (personIdx <  855) return "strong_no";
  if (personIdx <  900) return "not_home";
  return null;
}

function phoneHome(personIdx: number): string | null {
  if (personIdx >= 800) return null;
  const xxxx = String(1000 + ((personIdx * 7919 + 3141) % 9000));
  return `(519) 555-${xxxx}`;
}

function phoneMobile(personIdx: number): string | null {
  if (personIdx >= 300) return null;
  const xxxx = String(1000 + ((personIdx * 6271 + 2718) % 9000));
  return `(416) 555-${xxxx}`;
}

async function main() {
  console.log("🌱 Seeding database...");

  const HASH = await bcrypt.hash("password", 12);

  // ── Cleanup (FK-safe order) ───────────────────────────────────────────────
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.volunteerShiftAttendee.deleteMany(),
    db.volunteerShift.deleteMany(),
    db.volunteerRecord.deleteMany(),
    db.donor.deleteMany(),
    db.outreachLog.deleteMany(),
    db.canvassResponse.deleteMany(),
    db.canvassAssignment.deleteMany(),
    db.canvassListEntry.deleteMany(),
    db.canvassList.deleteMany(),
    db.task.deleteMany(),
    db.note.deleteMany(),
    db.personTag.deleteMany(),
    db.tag.deleteMany(),
    db.addressChangeRequest.deleteMany(),
    db.person.deleteMany(),
    db.household.deleteMany(),
    db.address.deleteMany(),
    db.campaignMembership.deleteMany(),
    db.campaignOverride.deleteMany(),
    db.campaign.deleteMany(),
    db.user.deleteMany(),
    db.platformSettings.deleteMany(),
  ]);
  console.log("  ✓ Cleaned up existing data");

  // ── Campaign ──────────────────────────────────────────────────────────────
  const campaign = await db.campaign.create({
    data: {
      name:         "Owen Sound Ward 4 — 2026",
      ballotName:   "Alex Chen",
      officeSought: "Ward 4 Councillor",
      description:  "Municipal election campaign for Ward 4, Owen Sound, Ontario. Focus on affordable housing, active transportation, and neighbourhood safety.",
      municipality: "Owen Sound",
      wards:        ["Ward 4"],
      city:         "Owen Sound",
      province:     "ON",
      year:         2026,
      electionDate: new Date("2026-10-26T00:00:00.000Z"),
      isActive:      true,
      plan:          process.env.DEMO_MODE === "true" ? "demo" : "election",
      planActivated: true,
    },
  });
  console.log(`  ✓ Campaign: ${campaign.name}`);

  // ── Users ─────────────────────────────────────────────────────────────────
  const [
    alexChen,
    mariaSantos,
    jamesOkafor,
    sarahKim,
    claireMorgan,
    robertBell,
    danWu,
    saraBishop,
    priyaNair,
    kevinLafleur,
    amyZhang,
    tomOkonkwo,
  ] = await Promise.all([
    db.user.create({ data: { email: "alex.chen@example.com",    passwordHash: HASH, firstName: "Alex",   lastName: "Chen",     phoneHome: "613-555-0100", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "maria.santos@example.com", passwordHash: HASH, firstName: "Maria",  lastName: "Santos",   phoneHome: "613-555-0101", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "james.okafor@example.com", passwordHash: HASH, firstName: "James",  lastName: "Okafor",   phoneHome: "613-555-0102", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "sarah.kim@example.com",    passwordHash: HASH, firstName: "Sarah",  lastName: "Kim",      phoneHome: "613-555-0103", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "claire.morgan@example.com",passwordHash: HASH, firstName: "Claire", lastName: "Morgan",   phoneHome: "613-555-0104", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "robert.bell@example.com",  passwordHash: HASH, firstName: "Robert", lastName: "Bell",     phoneHome: "613-555-0105", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "dan.wu@example.com",       passwordHash: HASH, firstName: "Dan",    lastName: "Wu",       phoneHome: "613-555-0106", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "sara.bishop@example.com",  passwordHash: HASH, firstName: "Sara",   lastName: "Bishop",   phoneHome: "613-555-0107", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "priya.nair@example.com",   passwordHash: HASH, firstName: "Priya",  lastName: "Nair",     phoneHome: "613-555-0108", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "kevin.lafleur@example.com",passwordHash: HASH, firstName: "Kevin",  lastName: "Lafleur",  phoneHome: "613-555-0109", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "amy.zhang@example.com",    passwordHash: HASH, firstName: "Amy",    lastName: "Zhang",    phoneHome: "613-555-0110", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "tom.okonkwo@example.com",  passwordHash: HASH, firstName: "Tom",    lastName: "Okonkwo",  phoneHome: "613-555-0111", emailVerified: VERIFIED } }),
  ]);

  await db.user.upsert({
    where:  { email: "superuser@localseat.io" },
    create: { email: "superuser@localseat.io", passwordHash: HASH, firstName: "Super", lastName: "User", isActive: true, platformRole: "super_user", emailVerified: VERIFIED },
    update: { passwordHash: HASH, platformRole: "super_user", emailVerified: VERIFIED },
  });

  const demoUser = await db.user.upsert({
    where:  { email: "demo@localseat.io" },
    create: { email: "demo@localseat.io", passwordHash: HASH, firstName: "Demo", lastName: "Login", isActive: true, emailVerified: VERIFIED },
    update: { passwordHash: HASH, emailVerified: VERIFIED },
  });
  console.log("  ✓ Users: 14 (including platform superuser and demo account)");

  // ── Campaign memberships ──────────────────────────────────────────────────
  await db.campaignMembership.createMany({
    data: [
      { userId: alexChen.id,     campaignId: campaign.id, role: "candidate"             },
      { userId: mariaSantos.id,  campaignId: campaign.id, role: "campaign_manager"      },
      { userId: jamesOkafor.id,  campaignId: campaign.id, role: "field_organizer"       },
      { userId: sarahKim.id,     campaignId: campaign.id, role: "field_organizer"       },
      { userId: claireMorgan.id, campaignId: campaign.id, role: "co_chair"              },
      { userId: robertBell.id,   campaignId: campaign.id, role: "co_chair"              },
      { userId: danWu.id,        campaignId: campaign.id, role: "finance_lead"          },
      { userId: saraBishop.id,   campaignId: campaign.id, role: "volunteer_coordinator" },
      { userId: priyaNair.id,    campaignId: campaign.id, role: "canvasser"             },
      { userId: kevinLafleur.id, campaignId: campaign.id, role: "canvasser"             },
      { userId: amyZhang.id,     campaignId: campaign.id, role: "canvasser"             },
      { userId: tomOkonkwo.id,   campaignId: campaign.id, role: "canvasser"             },
      { userId: demoUser.id,     campaignId: campaign.id, role: "candidate"             },
    ],
  });
  console.log("  ✓ Campaign memberships: 13");

  // ── Tags ──────────────────────────────────────────────────────────────────
  await db.tag.createMany({
    data: [
      { name: "field-entry",        color: "#475569" },
      { name: "record-outdated",    color: "#dc2626" },
      { name: "strong-supporter",   color: "#16a34a" },
      { name: "needs-sign",         color: "#2563eb" },
      { name: "volunteer-interest", color: "#7c3aed" },
      { name: "donor-prospect",     color: "#ea6c0a" },
    ],
  });
  console.log("  ✓ Tags: 6");

  // ── Streets, addresses, households, placeholder voters ───────────────────
  //
  // 16 real Owen Sound streets across 4 neighbourhoods.
  // 11 streets × 35 + 5 streets × 34 = 555 addresses.
  // House numbers: even side only (2, 4, 6, …).
  // All addresses are pre-geocoded with real approximate coordinates.
  //
  // Household size pattern — boundary table:
  // 100 single + 200 two + 100 three + 75 four + 80 five = 555 HH, 1500 voters exactly.

  interface StreetDef {
    name:       string;
    postalCode: string;
    poll:       string;
    baseLat:    number;
    baseLng:    number;
    latStep:    number;
    lngStep:    number;
  }

  const STREETS: StreetDef[] = [
    // ── Neighbourhood 1: Downtown East — avenues run N-S, lat increments per house ──
    { name: "2nd Ave E", postalCode: "N4K 2H1", poll: "Poll 1", baseLat: 44.5580, baseLng: -80.9401, latStep: 0.00012, lngStep: 0 },
    { name: "3rd Ave E", postalCode: "N4K 2H1", poll: "Poll 1", baseLat: 44.5580, baseLng: -80.9375, latStep: 0.00012, lngStep: 0 },
    { name: "4th Ave E", postalCode: "N4K 2H1", poll: "Poll 2", baseLat: 44.5580, baseLng: -80.9348, latStep: 0.00012, lngStep: 0 },
    { name: "5th Ave E", postalCode: "N4K 2H1", poll: "Poll 2", baseLat: 44.5580, baseLng: -80.9322, latStep: 0.00012, lngStep: 0 },
    // ── Neighbourhood 2: East Side Residential — avenues run N-S ───────────
    { name: "6th Ave E", postalCode: "N4K 3C4", poll: "Poll 3", baseLat: 44.5580, baseLng: -80.9295, latStep: 0.00012, lngStep: 0 },
    { name: "7th Ave E", postalCode: "N4K 3C4", poll: "Poll 3", baseLat: 44.5580, baseLng: -80.9268, latStep: 0.00012, lngStep: 0 },
    { name: "8th Ave E", postalCode: "N4K 3C4", poll: "Poll 4", baseLat: 44.5580, baseLng: -80.9242, latStep: 0.00012, lngStep: 0 },
    { name: "9th Ave E", postalCode: "N4K 3C4", poll: "Poll 4", baseLat: 44.5580, baseLng: -80.9215, latStep: 0.00012, lngStep: 0 },
    // ── Neighbourhood 3: West Side — avenues run N-S ────────────────────────
    { name: "2nd Ave W", postalCode: "N4K 1T6", poll: "Poll 5", baseLat: 44.5580, baseLng: -80.9468, latStep: 0.00012, lngStep: 0 },
    { name: "3rd Ave W", postalCode: "N4K 1T6", poll: "Poll 5", baseLat: 44.5580, baseLng: -80.9495, latStep: 0.00012, lngStep: 0 },
    { name: "4th Ave W", postalCode: "N4K 1T6", poll: "Poll 6", baseLat: 44.5580, baseLng: -80.9522, latStep: 0.00012, lngStep: 0 },
    { name: "5th Ave W", postalCode: "N4K 1T6", poll: "Poll 6", baseLat: 44.5580, baseLng: -80.9548, latStep: 0.00012, lngStep: 0 },
    // ── Neighbourhood 4: North End — streets run E-W, lng increments per house ──
    { name: "10th St E", postalCode: "N4K 4L8", poll: "Poll 7", baseLat: 44.5756, baseLng: -80.9548, latStep: 0, lngStep: 0.00018 },
    { name: "11th St E", postalCode: "N4K 4L8", poll: "Poll 7", baseLat: 44.5770, baseLng: -80.9548, latStep: 0, lngStep: 0.00018 },
    { name: "12th St E", postalCode: "N4K 4L8", poll: "Poll 8", baseLat: 44.5784, baseLng: -80.9548, latStep: 0, lngStep: 0.00018 },
    { name: "13th St E", postalCode: "N4K 4L8", poll: "Poll 8", baseLat: 44.5798, baseLng: -80.9548, latStep: 0, lngStep: 0.00018 },
  ];

  function hhSize(idx: number): number {
    if (idx <  100) return 1;
    if (idx <  300) return 2;
    if (idx <  400) return 3;
    if (idx <  475) return 4;
    return               5;
  }

  const HOUSES_PER_STREET = [35,35,35,35,35,35,35,35,35,35,35,34,34,34,34,34];

  const addressRows = STREETS.flatMap((street, si) =>
    Array.from({ length: HOUSES_PER_STREET[si] }, (_, i) => {
      const streetNumber = String((i + 1) * 2);
      const streetName   = street.name;
      const coordKey     = `${streetNumber} ${streetName}`;
      return {
        campaignId:   campaign.id,
        streetNumber,
        streetName,
        city:         "Owen Sound",
        province:     "ON",
        postalCode:   street.postalCode,
        lat:          GEOCODED_COORDS[coordKey]?.lat ?? null,
        lng:          GEOCODED_COORDS[coordKey]?.lng ?? null,
      };
    })
  );

  const addresses = await db.address.createManyAndReturn({ data: addressRows });
  console.log(`  ✓ Addresses: ${addresses.length}`);

  const householdRows = addresses.map((addr) => ({
    campaignId: campaign.id,
    addressId:  addr.id,
  }));

  const households = await db.household.createManyAndReturn({ data: householdRows });
  console.log(`  ✓ Households: ${households.length}`);

  const streetStartIdx: number[] = [];
  let runningIdx = 0;
  HOUSES_PER_STREET.forEach((count) => {
    streetStartIdx.push(runningIdx);
    runningIdx += count;
  });

  const personRows: {
    campaignId:    string;
    householdId:   string;
    firstName:     string;
    lastName:      string;
    pollNumber:    string;
    importSource:  string;
    supportLevel?: string;
    phoneHome?:    string;
    phoneMobile?:  string;
  }[] = [];

  households.forEach((hh, hhIdx) => {
    const streetIdx = HOUSES_PER_STREET.reduce((found, count, si) => {
      return hhIdx >= streetStartIdx[si] && hhIdx < streetStartIdx[si] + count ? si : found;
    }, 0);
    const poll  = STREETS[streetIdx].poll;
    const size  = hhSize(hhIdx);
    const group = culturalGroup(hhIdx);
    const lastName = group.last[hhIdx % group.last.length];

    for (let p = 0; p < size; p++) {
      const firstName = group.first[(hhIdx * 7 + p) % group.first.length];
      const pIdx = personRows.length;
      const sl   = supportLevel(pIdx);
      const ph   = phoneHome(pIdx);
      const pm   = phoneMobile(pIdx);
      personRows.push({
        campaignId:   campaign.id,
        householdId:  hh.id,
        firstName,
        lastName,
        pollNumber:   poll,
        importSource: "2022 Municipal Voter List",
        ...(sl ? { supportLevel: sl } : {}),
        ...(ph ? { phoneHome:    ph } : {}),
        ...(pm ? { phoneMobile:  pm } : {}),
      });
    }
  });

  await db.person.createMany({ data: personRows });
  console.log(`  ✓ Placeholder voters: ${personRows.length}`);

  // ── Walk lists, assignments, entries, canvass responses ───────────────────
  const NOTE_POOL = [
    "Very supportive, wants sign",
    "Concerned about traffic",
    "Moving next month",
    "Already voted advance",
    "Wants to volunteer",
    "Not interested",
    "Will consider",
    "Requested more info",
  ];

  function randomRespondedAt(): Date {
    const d = new Date(Date.now() - Math.random() * 21 * 24 * 60 * 60 * 1000);
    d.setHours(9 + Math.floor(Math.random() * 11), Math.floor(Math.random() * 60), 0, 0);
    return d;
  }

  const WALK_LIST_DEFS = [
    {
      name:           "Downtown East Route",
      description:    "Initial door knock on 2nd Ave E",
      street:         "2nd Ave E",
      canvasser:      priyaNair,
      totalEntries:   40,
      completedCount: 24,
    },
    {
      name:           "East Side Route",
      description:    "6th Ave E east side canvass",
      street:         "6th Ave E",
      canvasser:      kevinLafleur,
      totalEntries:   35,
      completedCount: 14,
    },
    {
      name:           "West Side Route",
      description:    "Full 2nd Ave W sweep",
      street:         "2nd Ave W",
      canvasser:      amyZhang,
      totalEntries:   45,
      completedCount:  9,
    },
    {
      name:           "North End Route",
      description:    "10th St E first pass",
      street:         "10th St E",
      canvasser:      tomOkonkwo,
      totalEntries:   30,
      completedCount:  0,
    },
  ];

  let totalResponses = 0;

  for (let listIdx = 0; listIdx < WALK_LIST_DEFS.length; listIdx++) {
    const def = WALK_LIST_DEFS[listIdx];
    const streetPersons = await db.person.findMany({
      where: {
        campaignId: campaign.id,
        household:  { address: { streetName: def.street } },
      },
      take: def.totalEntries,
    });

    const canvassList = await db.canvassList.create({
      data: {
        campaignId:  campaign.id,
        name:        def.name,
        description: def.description,
      },
    });

    const assignment = await db.canvassAssignment.create({
      data: {
        canvassListId: canvassList.id,
        canvasserId:   def.canvasser.id,
      },
    });

    await db.canvassListEntry.createMany({
      data: streetPersons.map((p) => ({
        canvassListId: canvassList.id,
        personId:      p.id,
        addedById:     jamesOkafor.id,
      })),
    });

    const completedPersons = streetPersons.slice(0, def.completedCount);
    if (completedPersons.length > 0) {
      await db.canvassResponse.createMany({
        data: completedPersons.map((p, ri) => {
          const sl      = p.supportLevel as SupportLevel | null;
          const outcome = sl === "not_home"
            ? CanvassOutcome.not_home
            : CanvassOutcome.contacted;
          const note    = ri % 10 < 3
            ? NOTE_POOL[(listIdx * 3 + ri) % NOTE_POOL.length]
            : undefined;
          return {
            assignmentId: assignment.id,
            personId:     p.id,
            outcome,
            ...(sl && sl !== "not_home" ? { supportLevel: sl as SupportLevel } : {}),
            respondedAt:  randomRespondedAt(),
            ...(note ? { notes: note } : {}),
          };
        }),
      });
      totalResponses += completedPersons.length;
    }

    console.log(
      `  ✓ "${def.name}": ${streetPersons.length} entries, ${completedPersons.length} responses`
    );
  }
  console.log(`  ✓ Walk lists: 4 | Canvass responses: ${totalResponses}`);

  // ── Competitors ───────────────────────────────────────────────────────────
  const competitors = await Promise.all([
    db.campaignCompetitor.create({ data: { campaignId: campaign.id, name: "Akshay Kumar", sortOrder: 1 } }),
    db.campaignCompetitor.create({ data: { campaignId: campaign.id, name: "Charles Wong", sortOrder: 2 } }),
    db.campaignCompetitor.create({ data: { campaignId: campaign.id, name: "Walter Smith", sortOrder: 3 } }),
  ]);
  console.log("  ✔ Competitors: 3");

  // ── Extended canvass responses (voter ID story) ───────────────────────────
  const dtAssignment = await db.canvassAssignment.findFirst({
    where: { canvassList: { campaignId: campaign.id, name: "Downtown East Route" } },
    include: { canvassList: { select: { id: true, name: true, campaignId: true } } },
  });
  console.log("  dtAssignment:", dtAssignment?.id, "canvassList.campaignId:", (dtAssignment as any)?.canvassList?.campaignId, "campaign.id:", campaign.id);

  const uncontactedPeople = await db.person.findMany({
    where: {
      campaignId: campaign.id,
      canvassResponses: { none: {} },
      deletedAt: null,
    },
    take: 200,
    orderBy: { createdAt: "asc" },
  });

  if (dtAssignment && uncontactedPeople.length >= 115) {
    // 50 strong yes / soft yes for our candidate
    const forUsData = uncontactedPeople.slice(0, 50).map((p, i) => ({
      assignmentId: dtAssignment.id,
      personId: p.id,
      outcome: "contacted" as const,
      supportLevel: i < 25 ? "strong_yes" as const : "soft_yes" as const,
      respondedAt: randomRespondedAt(),
    }));

    // 20 supporting Akshay Kumar
    const akshayData = uncontactedPeople.slice(50, 70).map((p) => ({
      assignmentId: dtAssignment.id,
      personId: p.id,
      outcome: "other_candidate" as const,
      competitorId: competitors[0].id,
      respondedAt: randomRespondedAt(),
    }));

    // 30 supporting Charles Wong
    const charlesData = uncontactedPeople.slice(70, 100).map((p) => ({
      assignmentId: dtAssignment.id,
      personId: p.id,
      outcome: "other_candidate" as const,
      competitorId: competitors[1].id,
      respondedAt: randomRespondedAt(),
    }));

    // 15 supporting Walter Smith
    const walterData = uncontactedPeople.slice(100, 115).map((p) => ({
      assignmentId: dtAssignment.id,
      personId: p.id,
      outcome: "other_candidate" as const,
      competitorId: competitors[2].id,
      respondedAt: randomRespondedAt(),
    }));

    const created = await db.canvassResponse.createMany({
      data: [...forUsData, ...akshayData, ...charlesData, ...walterData],
    });
    console.log("  Created responses:", created.count);

    console.log("  ✔ Extended canvass responses: 50 for us, 20 Akshay Kumar, 30 Charles Wong, 15 Walter Smith");
  }

  // ── Follow-up tasks ───────────────────────────────────────────────────────
  const FOLLOW_UP_NOTES = [
    "Call back after 6pm",
    "Wants to volunteer",
    "Request for lawn sign",
    "Follow up on noise complaint concern",
    "Interested in donating",
    "Wants candidate to visit street",
    "Needs sign removal after election",
    "Strong supporter — ask to bring friends",
  ];

  const followUpPersons = await db.person.findMany({
    where: { campaignId: campaign.id },
    take: 30,
    skip: 10,
  });

  const followUpAssignees = [jamesOkafor, sarahKim, priyaNair, kevinLafleur];
  const nowMs          = Date.now();
  const THREE_WEEKS_MS = 21 * 24 * 60 * 60 * 1000;
  const TWO_WEEKS_MS   = 14 * 24 * 60 * 60 * 1000;

  await db.task.createMany({
    data: followUpPersons.map((p, i) => {
      const isCompleted = i >= 15;
      const assignee    = followUpAssignees[i % followUpAssignees.length];
      const createdAt   = new Date(nowMs - Math.random() * THREE_WEEKS_MS);
      const completedAt = isCompleted
        ? new Date(nowMs - Math.random() * TWO_WEEKS_MS)
        : null;
      return {
        campaignId: campaign.id,
        personId:   p.id,
        assignedTo: assignee.id,
        title:      FOLLOW_UP_NOTES[i % FOLLOW_UP_NOTES.length],
        notes:      FOLLOW_UP_NOTES[i % FOLLOW_UP_NOTES.length],
        completed:  isCompleted,
        createdAt,
        ...(completedAt ? { completedAt } : {}),
      };
    }),
  });
  console.log("  ✓ Follow-up tasks: 30 (15 open, 15 completed)");

  // ── Donor prospects ───────────────────────────────────────────────────────
  const donorPersons = await db.person.findMany({
    where: { campaignId: campaign.id },
    take: 20,
    skip: 50,
  });

  const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

  const DONOR_NOTES: (string | null)[] = [
    null, null, null, null, null, null, null, null,
    "Pledged at door", "Pledged at door", "Pledged at door", "Pledged at door", "Pledged at door",
    "E-transfer received", "E-transfer received", "Cheque by mail", "Cheque by mail",
    "E-transfer received", "Cheque by mail", "E-transfer received",
  ];

  await db.donor.createMany({
    data: donorPersons.map((p, i) => {
      const isReceived = i >= 13;
      const isThanked  = i >= 17;
      const status     = i < 8  ? DonorStatus.interested
                       : i < 13 ? DonorStatus.pledged
                       :           DonorStatus.received;
      const createdAt  = new Date(nowMs - Math.random() * FOUR_WEEKS_MS);
      const amount     = 50 + Math.floor(Math.random() * 701);
      return {
        campaignId:    campaign.id,
        firstName:     p.firstName,
        lastName:      p.lastName,
        ...(p.phoneHome ? { phoneHome: p.phoneHome } : {}),
        linkedPersonId: p.id,
        createdById:   danWu.id,
        status,
        amount,
        ...(isReceived ? { donationDate: createdAt } : {}),
        thankYouSent:  isThanked,
        ...(isThanked  ? { thankYouDate: new Date(nowMs - Math.random() * 7 * 24 * 60 * 60 * 1000) } : {}),
        ...(DONOR_NOTES[i] ? { notes: DONOR_NOTES[i]! } : {}),
        createdAt,
      };
    }),
  });
  console.log("  ✓ Donor prospects: 20 (8 interested, 5 pledged, 4 received, 3 thanked)");

  // ── Volunteer shifts ──────────────────────────────────────────────────────
  const SHIFT_DEFS = [
    { name: "Saturday Canvass — Downtown East", date: new Date("2026-04-18T00:00:00Z"), startTime: "09:00", endTime: "13:00", maxVolunteers:  8 },
    { name: "Phone Banking Evening",            date: new Date("2026-04-21T00:00:00Z"), startTime: "18:00", endTime: "21:00", maxVolunteers:  6 },
    { name: "Sign Installation",                date: new Date("2026-04-25T00:00:00Z"), startTime: "10:00", endTime: "14:00", maxVolunteers: 10 },
    { name: "Voter Contact Blitz",              date: new Date("2026-05-02T00:00:00Z"), startTime: "09:00", endTime: "12:00", maxVolunteers:  8 },
    { name: "Final Push Canvass",               date: new Date("2026-10-24T00:00:00Z"), startTime: "08:00", endTime: "17:00", maxVolunteers: 15 },
  ];

  const shifts = await Promise.all(
    SHIFT_DEFS.map((s) =>
      db.volunteerShift.create({
        data: {
          campaignId:    campaign.id,
          name:          s.name,
          date:          s.date,
          startTime:     s.startTime,
          endTime:       s.endTime,
          maxVolunteers: s.maxVolunteers,
        },
      })
    )
  );

  const volPersons = await db.person.findMany({
    where: { campaignId: campaign.id },
    take: 5,
    skip: 100,
  });

  const volRecords = await Promise.all(
    volPersons.map((p) =>
      db.volunteerRecord.create({
        data: {
          campaignId: campaign.id,
          personId:   p.id,
          status:     "committed",
        },
      })
    )
  );

  await db.volunteerShiftAttendee.createMany({
    data: [
      ...volRecords.slice(0, 4).map((r) => ({
        shiftId:  shifts[0].id,
        recordId: r.id,
        status:   "attended" as const,
      })),
      ...volRecords.slice(0, 3).map((r) => ({
        shiftId:  shifts[1].id,
        recordId: r.id,
        status:   "pending" as const,
      })),
    ],
  });
  console.log("  ✓ Volunteer shifts: 5 (4 attended shift 1, 3 pending shift 2)");

  // ── Outreach log ──────────────────────────────────────────────────────────
  const SIX_WEEKS_MS = 42 * 24 * 60 * 60 * 1000;

  function randomOutreachDate(): Date {
    return new Date(nowMs - Math.random() * SIX_WEEKS_MS);
  }

  function outreachOutcome(sl: string | null): string {
    if (sl === "strong_yes" || sl === "soft_yes") return "positive";
    if (sl === "undecided") return "neutral";
    if (sl === "soft_no" || sl === "strong_no") return "negative";
    if (sl === "not_home") return "not_home";
    return "contacted";
  }

  const canvassResponses = await db.canvassResponse.findMany({
    include: { assignment: true },
  });

  await db.outreachLog.createMany({
    data: canvassResponses.map((r) => ({
      campaignId: campaign.id,
      personId:   r.personId,
      userId:     r.assignment.canvasserId,
      channel:    OutreachChannel.door_knock,
      date:       r.respondedAt,
      outcome:    outreachOutcome(r.supportLevel),
      ...(r.notes ? { notes: r.notes } : {}),
    })),
  });

  const manualPersons = await db.person.findMany({
    where: { campaignId: campaign.id },
    take: 100,
    skip: 200,
  });

  const fieldUsers = [jamesOkafor, sarahKim, mariaSantos, priyaNair, kevinLafleur, amyZhang, tomOkonkwo];

  const PHONE_NOTES = [
    "Reached, very supportive",
    "Left voicemail",
    "Discussed housing concerns",
    "Spoke about transit plans",
    "Requested callback",
  ];
  const DOOR_NOTES = [
    "Resident not home",
    "Spoke at door briefly",
    "Left flyer",
    "Positive conversation",
    "Spoke with tenant, not owner",
  ];
  const EMAIL_NOTES = [
    "Replied with support",
    "No response yet",
    "Asked about platform positions",
    "Forwarded to neighbours",
    "Requested more information",
  ];
  const EVENT_NOTES = [
    "Met at community meeting",
    "Spoke at school council event",
    "Connected at local library",
    "Met at farmers market",
    "Approached at neighbourhood cafe",
  ];

  const PHONE_OUTCOMES = ["positive", "voicemail", "no_answer", "neutral", "not_home"];
  const DOOR_OUTCOMES  = ["positive", "not_home", "neutral", "negative", "positive"];
  const EMAIL_OUTCOMES = ["positive", "neutral", "no_response", "positive", "neutral"];

  const manualRows: {
    campaignId: string;
    personId:   string;
    userId:     string;
    channel:    OutreachChannel;
    date:       Date;
    outcome:    string;
    notes:      string;
  }[] = [];

  for (let i = 0; i < 40 && i < manualPersons.length; i++) {
    manualRows.push({
      campaignId: campaign.id,
      personId:   manualPersons[i].id,
      userId:     fieldUsers[i % fieldUsers.length].id,
      channel:    OutreachChannel.phone_call,
      date:       randomOutreachDate(),
      outcome:    PHONE_OUTCOMES[i % PHONE_OUTCOMES.length],
      notes:      PHONE_NOTES[i % PHONE_NOTES.length],
    });
  }

  for (let i = 40; i < 70 && i < manualPersons.length; i++) {
    manualRows.push({
      campaignId: campaign.id,
      personId:   manualPersons[i].id,
      userId:     fieldUsers[i % fieldUsers.length].id,
      channel:    OutreachChannel.door_knock,
      date:       randomOutreachDate(),
      outcome:    DOOR_OUTCOMES[i % DOOR_OUTCOMES.length],
      notes:      DOOR_NOTES[i % DOOR_NOTES.length],
    });
  }

  for (let i = 70; i < 90 && i < manualPersons.length; i++) {
    manualRows.push({
      campaignId: campaign.id,
      personId:   manualPersons[i].id,
      userId:     [mariaSantos, jamesOkafor, sarahKim][i % 3].id,
      channel:    OutreachChannel.email,
      date:       randomOutreachDate(),
      outcome:    EMAIL_OUTCOMES[i % EMAIL_OUTCOMES.length],
      notes:      EMAIL_NOTES[i % EMAIL_NOTES.length],
    });
  }

  for (let i = 90; i < 100 && i < manualPersons.length; i++) {
    manualRows.push({
      campaignId: campaign.id,
      personId:   manualPersons[i].id,
      userId:     [alexChen, mariaSantos, jamesOkafor][i % 3].id,
      channel:    OutreachChannel.in_person,
      date:       randomOutreachDate(),
      outcome:    "positive",
      notes:      EVENT_NOTES[i % EVENT_NOTES.length],
    });
  }

  await db.outreachLog.createMany({ data: manualRows });
  console.log(
    `  ✓ Outreach log: ${canvassResponses.length + manualRows.length} entries ` +
    `(${canvassResponses.length} from canvass, ${manualRows.length} manual)`
  );

  // ── Audit log ─────────────────────────────────────────────────────────────
  function randomAuditDate(): Date {
    return new Date(nowMs - Math.random() * SIX_WEEKS_MS);
  }

  const auditRows: {
    campaignId?: string;
    userId?:     string;
    action:      string;
    entityType:  string;
    entityId:    string;
    before?:     object;
    after?:      object;
    createdAt:   Date;
  }[] = [];

  const allFieldUsers  = [jamesOkafor, sarahKim, priyaNair, kevinLafleur];
  const canvassersOnly = [priyaNair, kevinLafleur, amyZhang, tomOkonkwo];
  const loginUsers     = [alexChen, mariaSantos, jamesOkafor, sarahKim, priyaNair, kevinLafleur, amyZhang, tomOkonkwo];

  for (let i = 0; i < 15; i++) {
    const u = loginUsers[i % loginUsers.length];
    auditRows.push({ campaignId: campaign.id, userId: u.id, action: "LOGIN",                         entityType: "user",                   entityId: u.id,        createdAt: randomAuditDate() });
  }
  for (let i = 0; i < 10; i++) {
    const u = canvassersOnly[i % canvassersOnly.length];
    auditRows.push({ campaignId: campaign.id, userId: u.id, action: "CANVASS_RESPONSE_SAVED",        entityType: "canvass_response",       entityId: campaign.id, createdAt: randomAuditDate() });
  }
  for (let i = 0; i < 8; i++) {
    const u = allFieldUsers[i % allFieldUsers.length];
    auditRows.push({ campaignId: campaign.id, userId: u.id, action: "FOLLOW_UP_CREATED",             entityType: "task",                   entityId: campaign.id, createdAt: randomAuditDate() });
  }
  for (let i = 0; i < 8; i++) {
    const u = allFieldUsers[i % allFieldUsers.length];
    auditRows.push({ campaignId: campaign.id, userId: u.id, action: "FOLLOW_UP_COMPLETED",           entityType: "task",                   entityId: campaign.id, createdAt: randomAuditDate() });
  }
  for (let i = 0; i < 8; i++) {
    const u = [jamesOkafor, sarahKim, mariaSantos, priyaNair][i % 4];
    auditRows.push({ campaignId: campaign.id, userId: u.id, action: "NOTE_ADDED",                    entityType: "note",                   entityId: campaign.id, createdAt: randomAuditDate() });
  }
  for (let i = 0; i < 8; i++) {
    auditRows.push({ campaignId: campaign.id, userId: mariaSantos.id, action: "VOTER_LIST_IMPORTED",  entityType: "voter_list",             entityId: campaign.id, createdAt: randomAuditDate(), after: { count: 50 + i * 20 } });
  }
  for (let i = 0; i < 6; i++) {
    auditRows.push({ campaignId: campaign.id, userId: mariaSantos.id, action: "MEMBER_ADDED",         entityType: "campaign_membership",    entityId: campaign.id, createdAt: randomAuditDate() });
  }
  for (let i = 0; i < 5; i++) {
    auditRows.push({ campaignId: campaign.id, userId: mariaSantos.id, action: "ROLE_CHANGED",         entityType: "campaign_membership",    entityId: campaign.id, createdAt: randomAuditDate(), before: { role: "canvasser" }, after: { role: "field_organizer" } });
  }
  for (let i = 0; i < 5; i++) {
    const u = [mariaSantos, jamesOkafor, sarahKim][i % 3];
    auditRows.push({ campaignId: campaign.id, userId: u.id,           action: "EXPORT_VOTER_LIST",    entityType: "voter_list",             entityId: campaign.id, createdAt: randomAuditDate(), after: { format: "csv", rows: 100 + i * 50 } });
  }
  for (let i = 0; i < 4; i++) {
    auditRows.push({ campaignId: campaign.id, userId: jamesOkafor.id, action: "ADDRESS_CHANGE_APPROVED", entityType: "address_change_request", entityId: campaign.id, createdAt: randomAuditDate() });
  }
  for (let i = 0; i < 3; i++) {
    const u = [priyaNair, kevinLafleur, amyZhang][i];
    auditRows.push({ userId: u.id, action: "PASSWORD_RESET_REQUESTED", entityType: "user", entityId: u.id, createdAt: randomAuditDate() });
  }

  await db.auditLog.createMany({ data: auditRows });
  console.log(`  ✓ Audit log: ${auditRows.length} entries`);

  // ── Address change requests ───────────────────────────────────────────────
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const [acrSource1, acrSource2, acrSource3] = await Promise.all([
    db.person.findMany({
      where: { campaignId: campaign.id, household: { address: { streetName: "2nd Ave E" } } },
      take: 1,
      include: { household: true },
    }),
    db.person.findMany({
      where: { campaignId: campaign.id, household: { address: { streetName: "3rd Ave E" } } },
      take: 2,
      include: { household: true },
    }),
    db.person.findMany({
      where: { campaignId: campaign.id, household: { address: { streetName: "2nd Ave W" } } },
      take: 1,
      include: { household: true },
    }),
  ]);

  await db.addressChangeRequest.createMany({
    data: [
      {
        campaignId:        campaign.id,
        requestedByUserId: priyaNair.id,
        personId:          acrSource1[0].id,
        affectedPersonIds: [acrSource1[0].id],
        oldAddressId:      acrSource1[0].household?.addressId ?? undefined,
        newAddressData:    { streetNumber: "45", streetName: "4th Ave E", city: "Owen Sound", province: "ON", postalCode: "N4K 2H1" },
        createdAt:         new Date(nowMs - Math.random() * ONE_WEEK_MS),
      },
      {
        campaignId:        campaign.id,
        requestedByUserId: kevinLafleur.id,
        personId:          acrSource2[0].id,
        affectedPersonIds: [acrSource2[0].id, acrSource2[1].id],
        oldAddressId:      acrSource2[0].household?.addressId ?? undefined,
        newAddressData:    { streetNumber: "88", streetName: "6th Ave E", city: "Owen Sound", province: "ON", postalCode: "N4K 3C4" },
        createdAt:         new Date(nowMs - Math.random() * ONE_WEEK_MS),
      },
      {
        campaignId:        campaign.id,
        requestedByUserId: amyZhang.id,
        personId:          acrSource3[0].id,
        affectedPersonIds: [acrSource3[0].id],
        oldAddressId:      acrSource3[0].household?.addressId ?? undefined,
        newAddressData:    { streetNumber: "12", streetName: "10th St E", city: "Owen Sound", province: "ON", postalCode: "N4K 4L8" },
        createdAt:         new Date(nowMs - Math.random() * ONE_WEEK_MS),
      },
    ],
  });
  console.log("  ✓ Address change requests: 3 pending");

  console.log("\n✅ Foundation seed complete.\n");
  console.log("Test credentials (all passwords: 'password'):");
  console.log("  demo_entry            → demo@localseat.io");
  console.log("  superuser             → superuser@localseat.io");
  console.log("  candidate             → alex.chen@example.com");
  console.log("  campaign_manager      → maria.santos@example.com");
  console.log("  field_organizer       → james.okafor@example.com");
  console.log("  field_organizer       → sarah.kim@example.com");
  console.log("  co_chair              → claire.morgan@example.com");
  console.log("  co_chair              → robert.bell@example.com");
  console.log("  finance_lead          → dan.wu@example.com");
  console.log("  volunteer_coordinator → sara.bishop@example.com");
  console.log("  canvasser             → priya.nair@example.com");
  console.log("  canvasser             → kevin.lafleur@example.com");
  console.log("  canvasser             → amy.zhang@example.com");
  console.log("  canvasser             → tom.okonkwo@example.com");

  // ── Platform Settings ─────────────────────────────────────────────────────
  const SETTINGS: { key: string; value: string }[] = [
    { key: "starter_price",                   value: "149"      },
    { key: "campaign_price",                  value: "349"      },
    { key: "election_price",                  value: "699"      },
    { key: "starter_label",                   value: "Starter"  },
    { key: "campaign_label",                  value: "Campaign" },
    { key: "election_label",                  value: "Election" },
    { key: "starter_constituent_limit",       value: "2500"     },
    { key: "campaign_constituent_limit",      value: "15000"    },
    { key: "election_constituent_limit",      value: "0"        },
    { key: "starter_canvasser_limit",         value: "3"        },
    { key: "campaign_canvasser_limit",        value: "0"        },
    { key: "election_canvasser_limit",        value: "0"        },
    { key: "starter_campaign_manager_limit",  value: "1"        },
    { key: "campaign_campaign_manager_limit", value: "0"        },
    { key: "election_campaign_manager_limit", value: "0"        },
    { key: "starter_cochair_limit",           value: "0"        },
    { key: "campaign_cochair_limit",          value: "2"        },
    { key: "election_cochair_limit",          value: "0"        },
    { key: "starter_field_organizer_limit",   value: "1"        },
    { key: "campaign_field_organizer_limit",  value: "0"        },
    { key: "election_field_organizer_limit",  value: "0"        },
  ];

  for (let i = 0; i < SETTINGS.length; i++) {
    const s = SETTINGS[i];
    await db.platformSettings.upsert({
      where:  { key: s.key },
      create: { key: s.key, value: s.value },
      update: { value: s.value },
    });
  }
  console.log(`  ✓ Platform settings: ${SETTINGS.length} entries`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
