import type { Beneficiary, Devotee, PoojaEnrollment } from "./types";

// Fixture data, seeded relative to "today" (computed at module load) so the
// dashboard always looks realistic no matter which real date it's viewed on.
// This stands in for the database until PLAN.md §11 phase 1b wires up Postgres.

const MOCK_TIMESTAMP = new Date().toISOString();

function offsetDate(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return { month: d.getMonth() + 1, day: d.getDate() };
}

const seedDevotees: Omit<Devotee, "createdAt" | "modifiedAt">[] = [
  {
    id: "d1",
    devoteeNo: "DEV-00001",
    fullName: "Ganesh Bhat",
    dateOfBirth: "1978-04-12",
    rashi: "Mesha",
    nakshatra: "Ashwini",
    gotra: "Kashyapa",
    phonePrimary: "98450 11234",
    addressLine1: "4th Cross, Malleshwaram",
    addressCity: "Bengaluru",
    addressState: "Karnataka",
    addressPostalCode: "560003",
  },
  {
    id: "d2",
    devoteeNo: "DEV-00002",
    fullName: "Suresh Rao",
    dateOfBirth: "1982-11-08",
    rashi: "Vrishabha",
    nakshatra: "Rohini",
    gotra: "Bharadwaja",
    phonePrimary: "99001 55678",
    addressLine1: "12th Main, Jayanagar",
    addressCity: "Bengaluru",
    addressState: "Karnataka",
    addressPostalCode: "560011",
  },
  {
    id: "d3",
    devoteeNo: "DEV-00003",
    fullName: "Vijaya Hegde",
    dateOfBirth: "1969-02-18",
    rashi: "Karka",
    nakshatra: "Pushya",
    gotra: "Vasishta",
    phonePrimary: null,
    addressLine1: "",
    addressCity: "",
    addressState: "",
    addressPostalCode: "",
  },
  {
    id: "d4",
    devoteeNo: "DEV-00004",
    fullName: "Deepa Shetty",
    dateOfBirth: "1988-06-24",
    rashi: "Mithuna",
    nakshatra: "Ardra",
    gotra: "Kashyapa",
    phonePrimary: "94480 22987",
    addressLine1: "Car Street",
    addressCity: "Kambaru",
    addressState: "Karnataka",
    addressPostalCode: "",
  },
  {
    id: "d5",
    devoteeNo: "DEV-00005",
    fullName: "Naveen Kumar",
    dateOfBirth: "1975-09-03",
    rashi: "Simha",
    nakshatra: "Magha",
    gotra: "Bharadwaja",
    phonePrimary: "98860 33456",
    addressLine1: "Temple Street",
    addressCity: "Kambaru",
    addressState: "Karnataka",
    addressPostalCode: "574xxx",
  },
  {
    id: "d6",
    devoteeNo: "DEV-00006",
    fullName: "Rohan Pai",
    dateOfBirth: "1991-01-15",
    rashi: "Makara",
    nakshatra: "Shravana",
    gotra: "Vasishta",
    phonePrimary: "97406 77812",
    addressLine1: "Court Road",
    addressCity: "Udupi",
    addressState: "Karnataka",
    addressPostalCode: "576101",
  },
  {
    id: "d7",
    devoteeNo: "DEV-00007",
    fullName: "Manjula Shenoy",
    dateOfBirth: "1985-08-21",
    rashi: "Kanya",
    nakshatra: "Hasta",
    gotra: "Kashyapa",
    phonePrimary: "98440 66123",
    addressLine1: "Bunder Road",
    addressCity: "Mangaluru",
    addressState: "Karnataka",
    addressPostalCode: "575001",
  },
  {
    id: "d8",
    devoteeNo: "DEV-00008",
    fullName: "Ramesh Kamath",
    dateOfBirth: "1972-12-30",
    rashi: "Dhanu",
    nakshatra: "Mula",
    gotra: "Bharadwaja",
    phonePrimary: "96110 98234",
    addressLine1: "Station Road",
    addressCity: "Udupi",
    addressState: "Karnataka",
    addressPostalCode: "576101",
  },
];

const firstNames = [
  "Asha", "Anitha", "Bhavana", "Chandra", "Divya", "Geetha", "Harish", "Jayashree",
  "Kavya", "Krishna", "Latha", "Madhava", "Nandini", "Pradeep", "Radha", "Raghavendra",
  "Savitha", "Shankar", "Sudha", "Umesh", "Vanitha", "Vasudeva", "Vidya",
];
const lastNames = ["Acharya", "Bhat", "Hegde", "Kamath", "Kumar", "Nayak", "Pai", "Rao", "Shenoy", "Shetty"];
const locations = [
  ["Kambaru", "Dakshina Kannada", "574220"],
  ["Mangaluru", "Dakshina Kannada", "575001"],
  ["Udupi", "Udupi", "576101"],
  ["Bengaluru", "Bengaluru Urban", "560001"],
  ["Puttur", "Dakshina Kannada", "574201"],
  ["Kasargod", "Kasargod", "671121"],
] as const;
const rashis = ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena"];
const nakshatras = ["Ashwini", "Bharani", "Rohini", "Ardra", "Pushya", "Magha", "Hasta", "Swati", "Anuradha", "Mula", "Shravana", "Revati"];
const gotras = ["Kashyapa", "Bharadwaja", "Vasishta", "Gautama", "Atri"];

const generatedDevotees: Omit<Devotee, "createdAt" | "modifiedAt">[] = Array.from(
  { length: 92 },
  (_, offset) => {
    const number = offset + 9;
    const location = locations[offset % locations.length];
    const missingPhone = number % 23 === 0;
    const missingAddress = number % 31 === 0;
    return {
      id: `d${number}`,
      devoteeNo: `DEV-${String(number).padStart(5, "0")}`,
      fullName: `${firstNames[offset % firstNames.length]} ${lastNames[(offset * 3) % lastNames.length]}`,
      dateOfBirth: `${1955 + (offset % 45)}-${String((offset % 12) + 1).padStart(2, "0")}-${String((offset % 27) + 1).padStart(2, "0")}`,
      phonePrimary: missingPhone ? null : `9${String(100000000 + number * 7919).slice(-9)}`,
      phoneAlternate: number % 7 === 0 ? `8${String(100000000 + number * 3571).slice(-9)}` : undefined,
      email: number % 4 === 0 ? `devotee${number}@example.test` : undefined,
      rashi: rashis[offset % rashis.length],
      nakshatra: nakshatras[(offset * 5) % nakshatras.length],
      gotra: gotras[offset % gotras.length],
      notes: number % 13 === 0 ? "Synthetic test profile" : undefined,
      addressLine1: missingAddress ? "" : `${number}, Temple Road`,
      addressLine2: !missingAddress && number % 3 === 0 ? `Ward ${number % 12 || 12}` : undefined,
      addressCity: missingAddress ? "" : location[0],
      addressDistrict: missingAddress ? undefined : location[1],
      addressState: missingAddress ? "" : location[0] === "Kasargod" ? "Kerala" : "Karnataka",
      addressPostalCode: missingAddress ? "" : location[2],
    };
  },
);

export const devotees: Devotee[] = [...seedDevotees, ...generatedDevotees].map((devotee) => ({
  ...devotee,
  createdAt: MOCK_TIMESTAMP,
  modifiedAt: MOCK_TIMESTAMP,
}));

const seedBeneficiaries: Omit<Beneficiary, "createdAt" | "modifiedAt">[] = [
  { id: "b1", devoteeId: "d2", fullName: "Lakshmi R.", relation: "wife" },
  { id: "b2", devoteeId: "d2", fullName: "Anand Rao", relation: "son" },
  { id: "b3", devoteeId: "d4", fullName: "Prakash Shetty", relation: "father" },
  { id: "b4", devoteeId: "d5", fullName: "Kamala Devi", relation: "mother" },
  { id: "b5", devoteeId: "d7", fullName: "Suma Shenoy", relation: "daughter" },
];

const generatedBeneficiaries: Omit<Beneficiary, "createdAt" | "modifiedAt">[] = devotees.map(
  (devotee, index) => ({
    id: `b-gen-${devotee.id}`,
    devoteeId: devotee.id,
    fullName: `${firstNames[(index + 6) % firstNames.length]} ${lastNames[(index * 3) % lastNames.length]}`,
    relation: (["son", "daughter", "wife", "husband", "father", "mother", "other"] as const)[index % 7],
    phone: index % 5 === 0 ? devotee.phonePrimary ?? undefined : undefined,
    rashi: rashis[(index + 2) % rashis.length],
    nakshatra: nakshatras[(index + 3) % nakshatras.length],
    gotra: gotras[index % gotras.length],
  }),
);

export const beneficiaries: Beneficiary[] = [...seedBeneficiaries, ...generatedBeneficiaries].map(
  (beneficiary) => ({
    ...beneficiary,
    createdAt: MOCK_TIMESTAMP,
    modifiedAt: MOCK_TIMESTAMP,
  }),
);

interface EnrollmentSpec {
  id: string;
  devoteeId: string;
  forSelf: boolean;
  beneficiaryId?: string;
  offsetDays: number;
  annualMonth?: number;
  annualDay?: number;
  exception?: string;
  customAddress?: PoojaEnrollment["customAddress"];
  notes?: string;
}

const seedEnrollmentSpecs: EnrollmentSpec[] = [
  // ---- Today (7 due; 2 exceptions) ----
  { id: "e1", devoteeId: "d1", forSelf: true, offsetDays: 0 },
  { id: "e2", devoteeId: "d2", forSelf: false, beneficiaryId: "b1", offsetDays: 0, customAddress: { line1: "9th Cross, Basavanagudi", city: "Bengaluru", state: "Karnataka", postalCode: "560004" }, notes: "Custom address" },
  { id: "e3", devoteeId: "d2", forSelf: false, beneficiaryId: "b2", offsetDays: 0 },
  { id: "e4", devoteeId: "d3", forSelf: true, offsetDays: 0, exception: "Called once, no answer" },
  { id: "e5", devoteeId: "d4", forSelf: false, beneficiaryId: "b3", offsetDays: 0, exception: "Address on file, missing PIN" },
  { id: "e6", devoteeId: "d5", forSelf: false, beneficiaryId: "b4", offsetDays: 0 },
  { id: "e7", devoteeId: "d6", forSelf: true, offsetDays: 0 },

  // ---- Tomorrow (3 due) ----
  { id: "e8", devoteeId: "d7", forSelf: false, beneficiaryId: "b5", offsetDays: 1 },
  { id: "e9", devoteeId: "d8", forSelf: true, offsetDays: 1 },
  { id: "e10", devoteeId: "d1", forSelf: true, offsetDays: 1, notes: "Second pooja this year" },

  // ---- +2 days: none (rest day in the strip) ----

  // ---- +3 days (5 due) ----
  { id: "e11", devoteeId: "d2", forSelf: true, offsetDays: 3 },
  { id: "e12", devoteeId: "d3", forSelf: true, offsetDays: 3 },
  { id: "e13", devoteeId: "d4", forSelf: true, offsetDays: 3 },
  { id: "e14", devoteeId: "d5", forSelf: true, offsetDays: 3 },
  { id: "e15", devoteeId: "d6", forSelf: false, beneficiaryId: "b2", offsetDays: 3 },

  // ---- +4 days (1 due) ----
  { id: "e16", devoteeId: "d7", forSelf: true, offsetDays: 4 },

  // ---- +5 days: none ----

  // ---- +6 days (3 due) ----
  { id: "e17", devoteeId: "d8", forSelf: true, offsetDays: 6 },
  { id: "e18", devoteeId: "d1", forSelf: false, beneficiaryId: "b1", offsetDays: 6 },
  { id: "e19", devoteeId: "d2", forSelf: true, offsetDays: 6 },

  // ---- Scattered elsewhere this month/year, for the month tile + week/day views ----
  { id: "e20", devoteeId: "d3", forSelf: true, offsetDays: -9 },
  { id: "e21", devoteeId: "d4", forSelf: true, offsetDays: -7 },
  { id: "e22", devoteeId: "d5", forSelf: true, offsetDays: -4 },
  { id: "e23", devoteeId: "d6", forSelf: true, offsetDays: 10 },
  { id: "e24", devoteeId: "d7", forSelf: true, offsetDays: 12 },
  { id: "e25", devoteeId: "d8", forSelf: true, offsetDays: -12 },
  { id: "e26", devoteeId: "d1", forSelf: true, offsetDays: 20, exception: "No phone on file" },
  { id: "e27", devoteeId: "d2", forSelf: false, beneficiaryId: "b1", offsetDays: -20 },

  // ---- A paused/cancelled example, to prove they're excluded from due lists ----
  { id: "e28", devoteeId: "d3", forSelf: true, offsetDays: 0, notes: "Paused example — should NOT appear in Today" },
];

const generatedEnrollmentSpecs: EnrollmentSpec[] = Array.from({ length: 222 }, (_, offset) => {
  const number = offset + 29;
  const devoteeNumber = (offset % devotees.length) + 1;
  const devotee = devotees[devoteeNumber - 1];
  const forSelf = number % 3 !== 0;
  const location = locations[(offset + 2) % locations.length];
  return {
    id: `e${number}`,
    devoteeId: devotee.id,
    forSelf,
    beneficiaryId: forSelf ? undefined : `b-gen-${devotee.id}`,
    // The first group makes Today exceed one 15-label A4 page. The rest cover the year.
    offsetDays: offset < 14 ? 0 : ((offset * 37 + 14) % 365) - 182,
    annualMonth: offset === 14 ? 2 : undefined,
    annualDay: offset === 14 ? 29 : undefined,
    customAddress:
      offset === 15
        ? {
            line1: "ಶ್ರೀ ದುರ್ಗಾ ನಿವಾಸ, ದೇವಸ್ಥಾನ ಮುಖ್ಯ ರಸ್ತೆ",
            line2: "ಅಂಚೆ ಕಚೇರಿ ಹತ್ತಿರ, ಕಂಬಾರು ಗ್ರಾಮ",
            city: "ಮಂಗಳೂರು",
            district: "ದಕ್ಷಿಣ ಕನ್ನಡ",
            state: "ಕರ್ನಾಟಕ",
            postalCode: "574220",
          }
        : number % 11 === 0
        ? {
            line1: `${number}, Festival Cross`,
            line2: number % 22 === 0 ? "Near Main Temple" : undefined,
            city: location[0],
            district: location[1],
            state: location[0] === "Kasargod" ? "Kerala" : "Karnataka",
            postalCode: location[2],
          }
        : undefined,
    notes: number % 19 === 0 ? "Synthetic annual pooja enrollment" : undefined,
  };
});

const specs = [...seedEnrollmentSpecs, ...generatedEnrollmentSpecs];

export const enrollments: (PoojaEnrollment & { exception?: string })[] = specs.map((s) => {
  const { month, day } = offsetDate(s.offsetDays);
  return {
    id: s.id,
    devoteeId: s.devoteeId,
    forSelf: s.forSelf,
    beneficiaryId: s.beneficiaryId ?? null,
    annualMonth: s.annualMonth ?? month,
    annualDay: s.annualDay ?? day,
    addressMode: s.customAddress ? "custom" : "devotee_primary",
    customAddress: s.customAddress,
    status:
      s.id === "e28" || Number(s.id.slice(1)) % 17 === 0
        ? "paused"
        : Number(s.id.slice(1)) % 29 === 0
          ? "cancelled"
          : "active",
    leapDayPolicy: "feb_28",
    feeMinor: 100000,
    currency: "INR",
    paymentReference: Number(s.id.slice(1)) % 4 === 0 ? `MOCK-${s.id.toUpperCase()}` : undefined,
    enrollmentDate: MOCK_TIMESTAMP.slice(0, 10),
    createdBy: "mock-admin-user",
    notes: s.notes,
    exception: s.exception,
    createdAt: MOCK_TIMESTAMP,
    modifiedAt: MOCK_TIMESTAMP,
  };
});

/**
 * Stable record IDs for manual/E2E scenario checks. Keeping this catalog beside
 * the fixtures makes edge-case coverage reviewable instead of relying on volume.
 */
export const mockScenarioCatalog = {
  todayMoreThanOneLabelPage: ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e30", "e31", "e32", "e33", "e35", "e36", "e37", "e38", "e39", "e40", "e41", "e42"],
  tomorrow: ["e8", "e9", "e10"],
  multiplePoojasSameDevoteeAndDate: ["e2", "e3"],
  reusableBeneficiaryAcrossDates: ["e2", "e18", "e27"],
  devoteePrimaryAddress: ["e1"],
  customAddress: ["e2"],
  longKannadaCustomAddress: ["e44"],
  missingPhone: ["e4"],
  incompleteAddress: ["e5"],
  paused: ["e28"],
  cancelled: ["e29"],
  february29: ["e43"],
  paidWithReference: ["e4"],
  paidWithoutReference: ["e1"],
} as const;
