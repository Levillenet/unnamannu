// Client-safe metadata for Ebeco settings: labels, enum options, UI grouping.
//
// HUOM: Ebecon julkinen Cloud API:n UpdateUserDevice -endpoint hyväksyy
// käytännössä vain kolme kenttää: `powerOn`, `selectedProgram` ja
// `temperatureSet`. Muut kentät palaavat 200:lla mutta eivät päivity
// laitteelle. Tästä syystä tässä näytetään vain ne asetukset joita
// järjestelmämme oikeasti voi ohjata Ebeco-pilven kautta.
//
// `powerOn` (enabled) ja `temperatureSet` (current_setpoint) ohjataan
// omilla UI-komponenteillaan termostaattisivulla, joten asetustabeissa
// näkyy vain `selectedProgram`.

export type SettingType = "boolean" | "number" | "slider" | "select" | "text";

export type SettingMeta = {
  field: string; // Ebeco patch field name
  column?: string; // local DB column for reading current value
  label: string;
  help?: string;
  type: SettingType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};

export const SETTING_GROUPS: { id: string; label: string; settings: SettingMeta[] }[] = [
  {
    id: "program",
    label: "Ohjelma",
    settings: [
      {
        field: "selectedProgram",
        column: "selected_program",
        label: "Aktiivinen ohjelma",
        help: "Vaihtaa termostaatin ohjelmatilan Ebecon kautta.",
        type: "select",
        options: [
          { value: "home", label: "Kotona" },
          { value: "away", label: "Poissa" },
          { value: "vacation", label: "Loma" },
          { value: "schedule", label: "Aikataulu" },
          { value: "manual", label: "Manuaalinen" },
        ],
      },
    ],
  },
];

export function findSettingMeta(field: string): SettingMeta | undefined {
  for (const g of SETTING_GROUPS) {
    const m = g.settings.find((s) => s.field === field);
    if (m) return m;
  }
  return undefined;
}
