
export type Category = 'Member' | 'First Timer/Guest';

export interface AttendanceData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  category: Category;
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
}
