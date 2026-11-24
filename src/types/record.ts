/** What a person types into the record form. */
export interface RecordFields {
  fullName: string;
  idNumber: string;
  residence: string;
  age: number;
  referringDoctor: string;
  examType: string;
  filmType: string;
}

/** A saved record. All times are milliseconds since 1970. */
export interface PatientRecord extends RecordFields {
  id: string;
  /** When the exam was done: set once, at the moment the record is first saved. Reports are built on this. */
  examAt: number;
  createdAt: number;
  updatedAt: number;
}

/** The values offered by the "type or choose" fields. */
export interface RecordOptions {
  examTypes: string[];
  filmTypes: string[];
  /** The referring doctors seen so far, so the same doctor is always written the same way (the reports count by it). */
  doctors: string[];
}
