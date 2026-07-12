"use client";

import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { DEPARTMENTS } from "@/lib/location/peru-ubigeo";

type LocationSelectsProps = {
  initialDepartment?: string | null;
  initialProvince?: string | null;
  initialDistrict?: string | null;
  disabled?: boolean;
  compact?: boolean; // When true, only render hidden inputs (for collapsed sections)
};

export function LocationSelects({
  initialDepartment,
  initialProvince,
  initialDistrict,
  disabled,
  compact,
}: LocationSelectsProps) {
  const [departmentCode, setDepartmentCode] = useState(
    initialDepartment ? findDepartmentCode(initialDepartment) : "",
  );
  const [provinceCode, setProvinceCode] = useState(
    initialProvince && departmentCode ? findProvinceCode(departmentCode, initialProvince) : "",
  );
  const [districtCode, setDistrictCode] = useState(
    initialDistrict && departmentCode && provinceCode ? findDistrictCode(departmentCode, provinceCode, initialDistrict) : "",
  );

  // Fallback: if no UBIGEO match found, preserve original text
  const fallbackDepartment = !departmentCode && initialDepartment ? initialDepartment : "";
  const fallbackProvince = !provinceCode && initialProvince ? initialProvince : "";
  const fallbackDistrict = !districtCode && initialDistrict ? initialDistrict : "";

  const departmentOptions = useMemo(() => DEPARTMENTS.map((d) => ({ code: d.code, name: d.name })), []);

  const provinceOptions = useMemo(() => {
    if (!departmentCode) return [];
    const dept = DEPARTMENTS.find((d) => d.code === departmentCode);
    return (dept?.provinces ?? []).map((p) => ({ code: p.code, name: p.name }));
  }, [departmentCode]);

  const districtOptions = useMemo(() => {
    if (!departmentCode || !provinceCode) return [];
    const dept = DEPARTMENTS.find((d) => d.code === departmentCode);
    const province = dept?.provinces.find((p) => p.code === provinceCode);
    return (province?.districts ?? []).map((d) => ({ code: d.code, name: d.name }));
  }, [departmentCode, provinceCode]);

  const selectedDepartmentName = departmentOptions.find((d) => d.code === departmentCode)?.name ?? fallbackDepartment;
  const selectedProvinceName = provinceOptions.find((p) => p.code === provinceCode)?.name ?? fallbackProvince;
  const selectedDistrictName = districtOptions.find((d) => d.code === districtCode)?.name ?? fallbackDistrict;

  function handleDepartmentChange(value: string) {
    setDepartmentCode(value);
    setProvinceCode("");
    setDistrictCode("");
  }

  function handleProvinceChange(value: string) {
    setProvinceCode(value);
    setDistrictCode("");
  }

  const selectClass = "w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm disabled:opacity-50";

  return (
    <>
      {/* Hidden inputs always rendered for form submission */}
      <input type="hidden" name="region" value={selectedDepartmentName} />
      <input type="hidden" name="province" value={selectedProvinceName} />
      <input type="hidden" name="district" value={selectedDistrictName} />

      {!compact ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="loc-department">Departamento</Label>
            <select
              id="loc-department"
              value={departmentCode}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              disabled={disabled}
              className={selectClass}
            >
              <option value="">Seleccionar departamento</option>
              {departmentOptions.map((d) => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="loc-province">Provincia</Label>
            <select
              id="loc-province"
              value={provinceCode}
              onChange={(e) => handleProvinceChange(e.target.value)}
              disabled={disabled || !departmentCode}
              className={selectClass}
            >
              <option value="">Seleccionar provincia</option>
              {provinceOptions.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="loc-district">Distrito</Label>
            <select
              id="loc-district"
              value={districtCode}
              onChange={(e) => setDistrictCode(e.target.value)}
              disabled={disabled || !provinceCode}
              className={selectClass}
            >
              <option value="">Seleccionar distrito</option>
              {districtOptions.map((d) => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </>
  );
}

function findDepartmentCode(departmentName: string): string {
  const dept = DEPARTMENTS.find(
    (d) => normalizeCompare(d.name) === normalizeCompare(departmentName),
  );
  return dept?.code ?? "";
}

function findProvinceCode(departmentCode: string, provinceName: string): string {
  if (!departmentCode) return "";
  const dept = DEPARTMENTS.find((d) => d.code === departmentCode);
  const province = dept?.provinces.find(
    (p) => normalizeCompare(p.name) === normalizeCompare(provinceName),
  );
  return province?.code ?? "";
}

function findDistrictCode(departmentCode: string, provinceCode: string, districtName: string): string {
  if (!departmentCode || !provinceCode) return "";
  const dept = DEPARTMENTS.find((d) => d.code === departmentCode);
  const province = dept?.provinces.find((p) => p.code === provinceCode);
  const district = province?.districts.find(
    (d) => normalizeCompare(d.name) === normalizeCompare(districtName),
  );
  return district?.code ?? "";
}

function normalizeCompare(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
