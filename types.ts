export type Category = 'Member' | 'First Timer/Guest' | 'Revisiting/Returning Member';
export type Sex = 'Male' | 'Female';
export type Location = 'OJO' | 'IBA' | 'AGBARA' | 'IGANDO' | 'AKESAN' | 'IYANA-IPAJA' | 'IKOTUN' | 'IJEGUN' | 'OKE-ODO' | 'AYOBO-IPAJA' | 'EGBEDA/AKOWONJO' | 'IYANA ERA' | 'AMUWO ODOFIN';
export type AgeRange = 'under 19' | '19-26' | '27-36' | '37-45' | '46-55' | '55 and above';

export interface AttendanceData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  category: Category;
  sex: Sex;
  location: Location;
  ageRange: AgeRange;
  eventId: string;
  createdAt: any; // Using serverTimestamp()
}

export interface FormState extends Omit<AttendanceData, 'eventId' | 'createdAt'> {}

export interface FormErrors {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  category?: string;
  sex?: string;
  location?: string;
  ageRange?: string;
}