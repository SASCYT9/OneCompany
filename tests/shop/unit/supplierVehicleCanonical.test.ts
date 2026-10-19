import assert from "node:assert/strict";
import test from "node:test";

import type { SupplierCopyVehicle } from "../../../src/lib/supplierCatalogCopy";
import { canonicalizeSupplierVehicles } from "../../../src/lib/supplierVehicleCanonical";

const vehicle = (
  make: string,
  model: string,
  chassisCode: string | null = null,
  yearFrom: number | null = null,
  yearTo: number | null = null
): SupplierCopyVehicle => ({
  make,
  model,
  chassisCode,
  engine: null,
  yearFrom,
  yearTo,
  market: null,
  note: null,
});

const picker = (vehicles: SupplierCopyVehicle[]) =>
  canonicalizeSupplierVehicles(vehicles).map(
    (item) => `${item.make} ${item.model} ${item.chassisCode ?? "-"}`
  );

test("BMW trims become the picker's series and X models", () => {
  assert.deepEqual(picker([vehicle("BMW", "330i xDrive", "G20")]), ["BMW 3 Series G20"]);
  assert.deepEqual(picker([vehicle("BMW", "M340i", "G20")]), ["BMW 3 Series G20"]);
  assert.deepEqual(picker([vehicle("BMW", "M240i xDrive", "F22/F23")]), [
    "BMW 2 Series F22",
    "BMW 2 Series F23",
  ]);
  assert.deepEqual(picker([vehicle("BMW", "X5 xDrive40i", "G05")]), ["BMW X5 G05"]);
  assert.deepEqual(picker([vehicle("BMW", "M3", "E90/E92/E93")]), [
    "BMW M3 E90",
    "BMW M3 E92",
    "BMW M3 E93",
  ]);
});

test("an M chassis names the M car, and engine codes are not cars", () => {
  assert.deepEqual(picker([vehicle("BMW", "X5", "F95")]), ["BMW X5 M F95"]);
  assert.deepEqual(picker([vehicle("BMW", "B58TU"), vehicle("BMW", "4-Cylinder B-Series")]), []);
});

test("model years without a chassis pick the generations they cover", () => {
  assert.deepEqual(picker([vehicle("BMW", "X5", null, 2014, 2018)]), ["BMW X5 F15"]);
  assert.deepEqual(picker([vehicle("BMW", "X5 M50i", null, 2019, 2024)]), ["BMW X5 G05"]);
  assert.deepEqual(picker([vehicle("Volkswagen", "Golf R", null, 2015, 2019)]), [
    "Volkswagen Golf R MK7",
    "Volkswagen Golf R MK7.5",
  ]);
  // No years and no chassis: every generation of the model.
  assert.deepEqual(picker([vehicle("BMW", "540i")]), ["BMW 5 Series -"]);
});

test("VW and Audi names and platforms map onto the picker", () => {
  assert.deepEqual(picker([vehicle("VW", "GTI", "MK7/MK7.5")]), [
    "Volkswagen Golf GTI MK7",
    "Volkswagen Golf GTI MK7.5",
  ]);
  assert.deepEqual(picker([vehicle("Volkswagen", "Golf R", "MQB", 2015, 2017)]), [
    "Volkswagen Golf R MK7",
  ]);
  assert.deepEqual(picker([vehicle("Audi", "A3 Quattro", "MQB Evo", 2022, 2024)]), ["Audi A3 8Y"]);
  assert.deepEqual(picker([vehicle("Audi", "TT RS Quattro", null, 2018, 2022)]), ["Audi TTRS 8S"]);
  assert.deepEqual(picker([vehicle("Audi", "RS7 Sportback", "C8")]), ["Audi RS7 C8"]);
  assert.deepEqual(picker([vehicle("Audi", "2.0T EA113 / EA888.1 / EA888.2")]), []);
});

test("MINI, Supra and Link ECU's Japanese cars use the picker's generations", () => {
  assert.deepEqual(picker([vehicle("MINI", "Cooper Countryman", "F60")]), ["MINI Countryman F60"]);
  assert.deepEqual(picker([vehicle("Toyota", "Supra", "A90")]), ["Toyota GR Supra A90"]);
  assert.deepEqual(picker([vehicle("Subaru", "Impreza WRX", "GC8B")]), ["Subaru Impreza I GC8B"]);
  assert.deepEqual(picker([vehicle("Mitsubishi", "Lancer Evolution", "CT9A", 2005, 2007)]), [
    "Mitsubishi Lancer Evolution IX CT9A",
  ]);
});
