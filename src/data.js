export const MEALS = ['Lunch', 'Dinner']
export const SAMPLE_DATES = Array.from({ length: 15 }, (_, index) => `12-${String(index + 13).padStart(2, '0')}`)

export const SAMPLE_HOSTS = [
  {
    id: 'host-sample-a',
    name: 'Sample Host A',
    district: 'Sample District',
    venue: 'Home',
    languages: ['English'],
    remarks: 'Placeholder record — replace with your sheet data.',
    capacity: 4,
    availability: ['12-13-Lunch', '12-14-Dinner', '12-16-Dinner'],
  },
]

export const SAMPLE_STUDENTS = [
  {
    id: 'student-1',
    name: 'Student 1',
    university: 'Sample University',
    religion: 'Not provided',
    country: 'Country A',
    dietary: 'Not provided',
    language: 'English',
    requests: 'Student 2',
    availability: ['12-13-Lunch', '12-14-Dinner', '12-16-Dinner'],
  },
  {
    id: 'student-2',
    name: 'Student 2',
    university: 'Sample University',
    religion: 'Not provided',
    country: 'Country B',
    dietary: 'Not provided',
    language: 'English',
    requests: 'Student 1',
    availability: ['12-13-Lunch', '12-14-Dinner', '12-16-Dinner'],
  },
]
