import Papa from 'papaparse'
import { MEALS, PROGRAM_DAYS } from './data.js'

const clean = (value) => String(value ?? '').trim()
const key = (value) => clean(value).toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
const asList = (value) => Array.isArray(value)
  ? value.map(clean).filter(Boolean)
  : clean(value).split(/[;,|]/).map(clean).filter(Boolean)

export function intersectSlots(...collections) {
  if (!collections.length) return []
  const [first, ...rest] = collections
  const otherSets = rest.map((values) => new Set(values))
  return [...new Set(first)].filter((slot) => otherSets.every((set) => set.has(slot))).sort(compareSlots)
}

export function compareSlots(left, right) {
  const [leftDay, leftMeal] = left.split('-')
  const [rightDay, rightMeal] = right.split('-')
  return Number(leftDay) - Number(rightDay) || MEALS.indexOf(leftMeal) - MEALS.indexOf(rightMeal)
}

export function formatSlot(slot) {
  const [day, meal] = slot.split('-')
  return `Dec ${day} · ${meal}`
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
    const match = entry.match(/(?:dec(?:ember)?\s*)?(\d{1,2})\s*[-,· ]\s*(lunch|dinner)/i)
    if (!match) return []
    const day = Number(match[1])
    if (!PROGRAM_DAYS.some((item) => item.day === day)) return []
    return [`${day}-${match[2][0].toUpperCase()}${match[2].slice(1).toLowerCase()}`]
  })
}

function rowValue(row, aliases) {
  const entries = Object.entries(row)
  for (const alias of aliases) {
    const found = entries.find(([header]) => key(header) === key(alias))
    if (found && found[1] !== undefined && found[1] !== '') return found[1]
  }
  return ''
}

function toHost(row, index) {
  const name = clean(rowValue(row, ['name', 'host name', 'family', 'host']))
  return {
    id: `host-import-${Date.now()}-${index}`,
    name,
    district: clean(rowValue(row, ['district', 'neighborhood', 'area'])) || 'Not specified',
    venue: /restaurant/i.test(clean(rowValue(row, ['venue', 'location type']))) ? 'Restaurant' : 'Home',
    languages: asList(rowValue(row, ['languages', 'languages spoken', 'language'])),
    remarks: clean(rowValue(row, ['remarks', 'notes', 'comments'])),
    capacity: Math.max(0, Number(rowValue(row, ['capacity', 'max spots', 'spots'])) || 0),
    availability: normalizeAvailability(rowValue(row, ['availability', 'available slots', 'slots'])),
  }
}

function toStudent(row, index) {
  const name = clean(rowValue(row, ['name', 'student name', 'full name', 'student']))
  return {
    id: `student-import-${Date.now()}-${index}`,
    name,
    university: clean(rowValue(row, ['university', 'affiliation', 'school'])),
    religion: clean(rowValue(row, ['religion', 'faith'])),
    country: clean(rowValue(row, ['country', 'nationality'])),
    dietary: clean(rowValue(row, ['dietary', 'dietary restrictions', 'diet', 'food restrictions'])),
    language: clean(rowValue(row, ['language', 'language preference', 'preferred language'])),
    requests: clean(rowValue(row, ['requests', 'pair with', 'friends', 'requested friends', 'friend requests'])),
    availability: normalizeAvailability(rowValue(row, ['availability', 'available slots', 'slots'])),
  }
}

export function parseCsv(text, kind) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', transformHeader: (header) => clean(header) })
  if (parsed.errors.length) throw new Error(parsed.errors[0].message)
  const convert = kind === 'hosts' ? toHost : toStudent
  const records = parsed.data.map(convert).filter((record) => record.name)
  if (!records.length) throw new Error(`No ${kind === 'hosts' ? 'host' : 'student'} rows found. Check the CSV headers and data.`)
  return records
}

export function parseSheetJson(payload, kind) {
  let rows = payload
  if (payload && !Array.isArray(payload)) {
    rows = payload.values ?? payload.data ?? payload.rows
    if (!rows && payload.table?.rows) {
      const columns = payload.table.cols.map((column) => column.label || column.id)
      rows = payload.table.rows.map((row) => Object.fromEntries(
        columns.map((column, index) => [column, row.c?.[index]?.v ?? '']),
      ))
    }
  }
  if (!Array.isArray(rows) || !rows.length) throw new Error('The endpoint did not return a non-empty array of rows.')
  if (Array.isArray(rows[0])) {
    const [headers, ...data] = rows
    rows = data.map((row) => Object.fromEntries(headers.map((header, index) => [clean(header), row[index] ?? ''])))
  }
  const convert = kind === 'hosts' ? toHost : toStudent
  const records = rows.map((row, index) => convert(row, index)).filter((record) => record.name)
  if (!records.length) throw new Error(`No ${kind === 'hosts' ? 'host' : 'student'} rows found in the endpoint response.`)
  return records
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
