import Papa from 'papaparse'
import { MEALS } from './data.js'

const clean = (value) => String(value ?? '').trim()
const key = (value) => clean(value).toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthNumber = (value) => {
  const month = clean(value).toLocaleLowerCase().replace(/\.$/, '')
  return monthNames.findIndex((name) => name.toLocaleLowerCase() === month || name.slice(0, 3).toLocaleLowerCase() === month || (month === 'sept' && name === 'September')) + 1
}
const asList = (value) => Array.isArray(value)
  ? value.map(clean).filter(Boolean)
  : clean(value).split(/[;,|]/).map(clean).filter(Boolean)

export function intersectSlots(...collections) {
  if (!collections.length) return []
  const [first, ...rest] = collections
  const otherSets = rest.map((values) => new Set(values))
  return [...new Set(first)].filter((slot) => otherSets.every((set) => set.has(slot)))
}

export function formatDate(date, month = 'short') {
  const [monthNumberValue, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month, day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2024, monthNumberValue - 1, day)))
}

export function formatSlot(slot) {
  const separator = slot.lastIndexOf('-')
  const date = slot.slice(0, separator)
  const meal = slot.slice(separator + 1)
  return `${formatDate(date)} · ${meal}`
}

function normalizeName(name) {
  return key(name)
}

function nameMatches(candidate, student) {
  const candidateKey = normalizeName(candidate)
  const fullName = normalizeName(student.name)
  if (!candidateKey) return false
  if (candidateKey === fullName) return true

  const candidateParts = clean(candidate).toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const studentParts = clean(student.name).toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (candidateParts.length === 1) {
    return studentParts.some((part) => part === candidateParts[0] || (part.length > 2 && part.startsWith(candidateParts[0])))
  }
  return candidateParts.every((part) =>
    studentParts.some((studentPart) => studentPart === part || (part.length > 2 && studentPart.startsWith(part))),
  )
}

export function buildStudentGroups(students) {
  const assigned = new Set()
  const groups = []

  for (const student of students) {
    if (assigned.has(student.id)) continue
    const members = new Set([student.id])
    let grew = true

    while (grew) {
      grew = false
      for (const member of students) {
        if (members.has(member.id)) continue
        const linked = [...members].some((memberId) => {
          const current = students.find((item) => item.id === memberId)
          return asList(current?.requests).some((request) => nameMatches(request, member)) ||
            asList(member.requests).some((request) => nameMatches(request, current))
        })
        if (linked) {
          members.add(member.id)
          grew = true
        }
      }
    }

    const groupMembers = students.filter((item) => members.has(item.id))
    groupMembers.forEach((item) => assigned.add(item.id))
    const missingRequests = groupMembers.flatMap((member) => asList(member.requests)
      .filter((request) => !students.some((candidate) => candidate.id !== member.id && nameMatches(request, candidate)))
      .map((name) => ({ from: member.name, name })))
    groups.push({
      id: groupMembers.map((item) => item.id).sort().join('+'),
      members: groupMembers,
      availability: intersectSlots(...groupMembers.map((item) => item.availability)),
      missingRequests,
    })
  }
  return groups
}

export function getHostOverlap(host, groups) {
  return intersectSlots(host.availability, ...groups.map((group) => group.availability))
}

export function getScheduleHealth(overlapCount) {
  if (overlapCount === 0) return { label: 'Schedule conflict', tone: 'conflict' }
  if (overlapCount === 1) return { label: 'Tight margin', tone: 'tight' }
  return { label: 'Healthy schedule', tone: 'healthy' }
}

function normalizeAvailability(value) {
  return asList(value).flatMap((entry) => {
    const date = dateHeader(entry)
    return date ? slotsForDate(date, entry) : []
  })
}

function dateKey(month, day) {
  const date = new Date(Date.UTC(2024, month - 1, day))
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function dateHeader(value) {
  const text = clean(value)
  const isoDate = text.match(/\b\d{4}[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (isoDate) return dateKey(Number(isoDate[1]), Number(isoDate[2]))

  const monthFirst = text.match(/\b([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(?:19|20)\d{2})?\b/i)
  if (monthFirst) {
    const month = monthNumber(monthFirst[1])
    if (month) return dateKey(month, Number(monthFirst[2]))
  }

  const dayFirst = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?(?:,?\s+(?:19|20)\d{2})?\b/i)
  if (dayFirst) {
    const month = monthNumber(dayFirst[2])
    if (month) return dateKey(month, Number(dayFirst[1]))
  }

  const numericDate = text.match(/\b(\d{1,2})[-/.](\d{1,2})(?:[-/.](?:19|20)?\d{2})?\b/)
  if (numericDate) {
    let month = Number(numericDate[1])
    let day = Number(numericDate[2])
    if (month > 12) [month, day] = [day, month]
    return dateKey(month, day)
  }
  return null
}

function slotsForDate(date, value) {
  const text = clean(value).toLocaleLowerCase()
  if (!text || /\b(no|not|unavailable|false|none|n\/a)\b/.test(text)) return []
  const lunch = /\blunch(?:time)?\b/.test(text) || /^l$/.test(text)
  const dinner = /\bdinner\b/.test(text) || /^d$/.test(text)
  const both = /\b(yes|y|true|1|available|both|all day|all meals)\b/.test(text)
  return [
    ...(lunch || both ? [`${date}-${MEALS[0]}`] : []),
    ...(dinner || both ? [`${date}-${MEALS[1]}`] : []),
  ]
}

function availabilityFromRow(row) {
  const listedSlots = normalizeAvailability(rowValue(row, ['availability', 'available slots', 'slots']))
  const datedSlots = Object.entries(row).flatMap(([header, value]) => {
    const date = dateHeader(header)
    return date ? slotsForDate(date, value) : []
  })
  return [...new Set([...listedSlots, ...datedSlots])]
}

function rowValue(row, aliases) {
  const entries = Object.entries(row).map(([header, value]) => [key(header), value])
  for (const alias of aliases) {
    const aliasKey = key(alias)
    const found = entries.find(([header]) => header === aliasKey)
    if (found && found[1] !== undefined && found[1] !== '') return found[1]
  }
  const exactOnly = new Set(['name', 'student', 'host', 'family'])
  const partialAliases = aliases.map(key).filter((alias) => alias.length >= 4 && !exactOnly.has(alias)).sort((a, b) => b.length - a.length)
  for (const alias of partialAliases) {
    const found = entries.find(([header, value]) => header.includes(alias) && value !== undefined && value !== '')
    if (found) return found[1]
  }
  return ''
}

function prefersMandarin(value) {
  const preference = clean(value)
  if (/\b(no|false|0|not|never)\b/i.test(preference)) return false
  return /mandarin/i.test(preference) || /\b(yes|true|1|preferred)\b/i.test(preference)
}

function languagePreference(value) {
  const preference = clean(value)
  if (!preference || /\b(no|false|0|none|n\/a|not interested)\b/i.test(preference)) return ''
  return prefersMandarin(preference) ? 'Mandarin' : preference
}

function toHost(row, index) {
  const name = clean(rowValue(row, ['name', 'host name', 'family name']))
  const languages = asList(rowValue(row, ['languages', 'languages spoken']))
  const mandarinPreference = rowValue(row, ['mandarin preference', 'mandarin'])
  if (prefersMandarin(mandarinPreference) && !languages.some((language) => /mandarin/i.test(language))) languages.push('Mandarin')
  const capacityText = clean(rowValue(row, [
    'capacity',
    'max spots',
    'spots',
    'how many students would you like to host',
    'number of students to host',
  ]))
  return {
    id: `host-import-${Date.now()}-${index}`,
    name,
    phone: clean(rowValue(row, ['phone', 'telephone', 'mobile'])),
    email: clean(rowValue(row, ['email', 'e-mail'])),
    district: clean(rowValue(row, ['district', 'neighborhood', 'area', 'home restaurant of choice'])) || 'Not specified',
    venue: /restaurant/i.test(clean(rowValue(row, ['venue', 'location type', 'where will you host']))) ? 'Restaurant' : 'Home',
    languages,
    remarks: clean(rowValue(row, ['remarks', 'notes', 'comments'])),
    capacity: Math.max(0, Number(capacityText.match(/\d+/)?.[0]) || 0),
    availability: availabilityFromRow(row),
  }
}

function toStudent(row, index) {
  const firstName = clean(rowValue(row, ['first name']))
  const lastName = clean(rowValue(row, ['last name']))
  const name = clean(rowValue(row, ['name', 'student name', 'full name', 'student'])) || [firstName, lastName].filter(Boolean).join(' ')
  return {
    id: `student-import-${Date.now()}-${index}`,
    name,
    gender: clean(rowValue(row, ['gender'])),
    whatsapp: clean(rowValue(row, ['whatsapp', 'whats app', 'phone'])),
    university: clean(rowValue(row, ['university', 'affiliation', 'school'])),
    religion: clean(rowValue(row, ['religion', 'faith'])),
    country: clean(rowValue(row, ['country', 'home country', 'nationality'])),
    dietary: clean(rowValue(row, ['dietary', 'dietary restrictions', 'diet', 'food restrictions'])),
    language: languagePreference(rowValue(row, ['language', 'language preference', 'preferred language', 'mandarin preference', 'mandarin'])),
    requests: clean(rowValue(row, [
      'requests',
      'pair with',
      'friends',
      'requested friends',
      'friend requests',
      'specific students to be grouped with',
      'specific students',
      'students to be grouped',
      'group with',
    ])),
    availability: availabilityFromRow(row),
  }
}

export function parseCsv(text, kind) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', transformHeader: (header) => clean(header) })
  if (parsed.errors.length) throw new Error(parsed.errors[0].message)
  const convert = kind === 'hosts' ? toHost : toStudent
  const records = parsed.data.map(convert).filter((record) => record.name)
  if (!records.length) throw new Error(`No ${kind === 'hosts' ? 'host' : 'student'} rows found. Check the CSV headers and data.`)
  const headerDates = (parsed.meta.fields ?? []).map(dateHeader).filter(Boolean)
  const dates = [...new Set([
    ...headerDates,
    ...records.flatMap((record) => record.availability.map((slot) => slot.slice(0, slot.lastIndexOf('-')))),
  ])]
  if (!dates.length) throw new Error('No event dates found. Add date columns such as “Aug 13” or “2027-08-13”.')
  return { records, dates }
}

export function serializeCsv(hosts, assignments, groups) {
  const rows = hosts.flatMap((host) => {
    const assignedGroups = assignments[host.id] ?? []
    if (!assignedGroups.length) return []
    const resolved = assignedGroups.map((id) => groups.find((group) => group.id === id)).filter(Boolean)
    const overlap = getHostOverlap(host, resolved)
    const health = getScheduleHealth(overlap.length)
    return [{
      'Host Name': host.name,
      District: host.district,
      Venue: host.venue,
      'Host Languages': host.languages.join('; '),
      'Matched Students': resolved.flatMap((group) => group.members.map((member) => member.name)).join('; '),
      Universities: [...new Set(resolved.flatMap((group) => group.members.map((member) => member.university).filter(Boolean)))].join('; '),
      Religions: [...new Set(resolved.flatMap((group) => group.members.map((member) => member.religion).filter(Boolean)))].join('; '),
      'Dietary Notes': [...new Set(resolved.flatMap((group) => group.members.map((member) => member.dietary).filter(Boolean)))].join('; '),
      'Overlapping Available Meals': overlap.map(formatSlot).join('; '),
      'Schedule Health': `${health.label} (${overlap.length} ${overlap.length === 1 ? 'slot' : 'slots'})`,
    }]
  })
  if (!rows.length) throw new Error('Assign at least one student group before exporting.')
  return Papa.unparse(rows)
}
