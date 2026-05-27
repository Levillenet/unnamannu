// Client-safe metadata for Ebeco settings: labels, enum options, UI grouping.

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
    id: "temperature",
    label: "Lämpötila",
    settings: [
      {
        field: "minSetpoint",
        column: "min_setpoint",
        label: "Sallittu min",
        type: "number",
        min: 5,
        max: 35,
        step: 0.5,
        unit: "°C",
      },
      {
        field: "maxSetpoint",
        column: "max_setpoint",
        label: "Sallittu max",
        type: "number",
        min: 5,
        max: 35,
        step: 0.5,
        unit: "°C",
      },
      {
        field: "temperatureCalibrationRoom",
        column: "temperature_calibration_room",
        label: "Huoneanturin kalibrointi",
        type: "number",
        min: -5,
        max: 5,
        step: 0.1,
        unit: "°C",
      },
      {
        field: "temperatureCalibrationFloor",
        column: "temperature_calibration_floor",
        label: "Lattia-anturin kalibrointi",
        type: "number",
        min: -5,
        max: 5,
        step: 0.1,
        unit: "°C",
      },
      {
        field: "adaptiveStart",
        column: "adaptive_start",
        label: "Ennakoiva lämmitys (Adaptive Start)",
        help: "Käynnistää lämmityksen etukäteen niin että haluttu lämpötila saavutetaan ajallaan.",
        type: "boolean",
      },
      {
        field: "openWindowDetection",
        column: "open_window_detection",
        label: "Avoimen ikkunan tunnistus",
        type: "boolean",
      },
      {
        field: "openWindowSensitivity",
        label: "Ikkunatunnistuksen herkkyys",
        type: "slider",
        min: 0,
        max: 10,
        step: 1,
      },
    ],
  },
  {
    id: "sensor",
    label: "Anturi",
    settings: [
      {
        field: "sensorApplication",
        column: "sensor_application",
        label: "Anturin käyttötapa",
        type: "select",
        options: [
          { value: "floor", label: "Lattia-anturi" },
          { value: "room", label: "Huoneanturi" },
          { value: "roomAndFloor", label: "Huone + lattia (rajaus)" },
        ],
      },
      {
        field: "sensorType",
        column: "sensor_type",
        label: "Anturin tyyppi (NTC)",
        type: "select",
        options: [
          { value: "ntc10k", label: "NTC 10 kΩ" },
          { value: "ntc12k", label: "NTC 12 kΩ" },
          { value: "ntc15k", label: "NTC 15 kΩ" },
          { value: "ntc22k", label: "NTC 22 kΩ" },
          { value: "ntc33k", label: "NTC 33 kΩ" },
          { value: "ntc47k", label: "NTC 47 kΩ" },
        ],
      },
      {
        field: "minFloorTemp",
        column: "min_floor_temp",
        label: "Lattian min-lämpötila",
        type: "number",
        min: 5,
        max: 40,
        step: 0.5,
        unit: "°C",
      },
      {
        field: "maxFloorTemp",
        column: "max_floor_temp",
        label: "Lattian max-lämpötila",
        type: "number",
        min: 5,
        max: 40,
        step: 0.5,
        unit: "°C",
      },
      {
        field: "floorTempCutOff",
        column: "floor_temp_cut_off",
        label: "Lattian turvakatkaisu",
        type: "number",
        min: 5,
        max: 45,
        step: 0.5,
        unit: "°C",
      },
    ],
  },
  {
    id: "display",
    label: "Näyttö",
    settings: [
      {
        field: "displayWhenIdle",
        column: "display_when_idle",
        label: "Näyttö kun laitetta ei käytetä",
        help: "Mitä näkyy, kun käyttäjä ei kosketa termostaattia.",
        type: "select",
        options: [
          { value: "off", label: "Pimeä" },
          { value: "dateAndTime", label: "Päivämäärä ja kello" },
          { value: "temperature", label: "Lämpötila" },
          { value: "temperatureAndTime", label: "Lämpötila + kello" },
        ],
      },
      {
        field: "lightLedTextWhenIdle",
        column: "light_idle",
        label: "Taustavalo idle-tilassa",
        type: "slider",
        min: 0,
        max: 100,
        step: 5,
        unit: "%",
      },
      {
        field: "lightLedTextDuringOperation",
        column: "light_active",
        label: "Taustavalo käytön aikana",
        type: "slider",
        min: 0,
        max: 100,
        step: 5,
        unit: "%",
      },
      {
        field: "language",
        column: "language",
        label: "Näytön kieli",
        type: "select",
        options: [
          { value: "fi", label: "Suomi" },
          { value: "sv", label: "Ruotsi" },
          { value: "en", label: "Englanti" },
          { value: "no", label: "Norja" },
          { value: "da", label: "Tanska" },
        ],
      },
      {
        field: "timeFormat",
        label: "Aikamuoto",
        type: "select",
        options: [
          { value: "24h", label: "24-tuntinen" },
          { value: "12h", label: "12-tuntinen" },
        ],
      },
      {
        field: "screenSaverEnabled",
        label: "Näytönsäästäjä",
        type: "boolean",
      },
    ],
  },
  {
    id: "lock",
    label: "Lukitus",
    settings: [
      {
        field: "childLock",
        column: "child_lock",
        label: "Lapsilukko",
        help: "Estää käyttäjää muuttamasta asetuksia ilman koodia.",
        type: "boolean",
      },
      {
        field: "pinCodeEnabled",
        label: "PIN-koodi käytössä",
        type: "boolean",
      },
      {
        field: "installerLock",
        label: "Asentajalukko",
        type: "boolean",
      },
    ],
  },
  {
    id: "program",
    label: "Ohjelma",
    settings: [
      {
        field: "selectedProgram",
        column: "selected_program",
        label: "Aktiivinen ohjelma",
        type: "select",
        options: [
          { value: "home", label: "Kotona" },
          { value: "away", label: "Poissa" },
          { value: "vacation", label: "Loma" },
          { value: "schedule", label: "Aikataulu" },
          { value: "manual", label: "Manuaalinen" },
        ],
      },
      {
        field: "awayTemperature",
        label: "Poissa-lämpötila",
        type: "number",
        min: 5,
        max: 35,
        step: 0.5,
        unit: "°C",
      },
      {
        field: "vacationTemperature",
        label: "Loma-lämpötila",
        type: "number",
        min: 5,
        max: 35,
        step: 0.5,
        unit: "°C",
      },
    ],
  },
  {
    id: "install",
    label: "Asennus",
    settings: [
      {
        field: "installedEffect",
        column: "installed_effect_w",
        label: "Asennettu teho",
        type: "number",
        min: 0,
        max: 10000,
        step: 50,
        unit: "W",
      },
      {
        field: "regulatorMode",
        label: "Säätötapa",
        type: "select",
        options: [
          { value: "pwm", label: "PWM (pulssimoduloitu)" },
          { value: "thermostat", label: "Termostaatti" },
        ],
      },
      {
        field: "pwmPeriod",
        label: "PWM-jakson pituus",
        type: "number",
        min: 0,
        max: 120,
        step: 1,
        unit: "min",
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
