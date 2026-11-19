import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CloudUpload,
  Download,
  Globe2,
  Heart,
  Home,
  Languages,
  Leaf,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { PROGRAM_DAYS, SAMPLE_HOSTS, SAMPLE_STUDENTS } from './data.js'
import {
  buildStudentGroups,
  formatSlot,
  getHostOverlap,
  getScheduleHealth,
  intersectSlots,
  parseCsv,
  serializeCsv,
} from './matching.js'

const avatarColors = ['avatar-sage', 'avatar-sun', 'avatar-rose', 'avatar-lilac', 'avatar-blue']

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function overlapsForGroup(host, group) {
  return intersectSlots(host.availability, group.availability)
}

function HostAvailability({ host, assignedGroups }) {
  const highlighted = new Set(assignedGroups.length ? getHostOverlap(host, assignedGroups) : host.availability)
  return (
    <div className="availability-wrap">
      <div className="availability-label">
        <span><CalendarDays size={13} /> DECEMBER AVAILABILITY</span>
        <div className="grid-legend"><i /> Available <b>·</b> Unavailable</div>
      </div>
      <div className="calendar-grid" role="grid" aria-label={`${host.name} December 13 to 27 availability`}>
        <div className="meal-labels"><span /><span>L</span><span>D</span></div>
        {PROGRAM_DAYS.map(({ day, weekday }) => (
          <div className="calendar-day" key={day}>
            <span className="day-number">{day}</span>
            <span className={`slot-dot ${host.availability.includes(`${day}-Lunch`) ? 'is-available' : ''} ${highlighted.has(`${day}-Lunch`) ? 'is-highlighted' : ''}`} title={`Dec ${day} Lunch`} />
            <span className={`slot-dot ${host.availability.includes(`${day}-Dinner`) ? 'is-available' : ''} ${highlighted.has(`${day}-Dinner`) ? 'is-highlighted' : ''}`} title={`Dec ${day} Dinner`} />
            <span className="sr-only">{weekday}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StudentAvatar({ student, index, size = 'normal' }) {
  return <div className={`avatar ${avatarColors[index % avatarColors.length]} ${size === 'small' ? 'avatar-small' : ''}`} title={student.name}>{initials(student.name)}</div>
}

function StudentDetails({ member, index }) {
  return (
    <div className="member-row">
      <StudentAvatar student={member} index={index} />
      <div className="member-main">
        <strong>{member.name}</strong>
        <span>{member.university || 'Affiliation not provided'}</span>
      </div>
      <span className="country-label">{member.country}</span>
    </div>
  )
}

function InfoTile({ icon: Icon, label, value, className = '' }) {
  return (
    <div className={`info-tile ${className}`}>
      <span className="tile-icon"><Icon size={14} /></span>
      <div><span className="tile-label">{label}</span><span className="tile-value">{value || 'Not specified'}</span></div>
    </div>
  )
}

function App() {
  const [hosts, setHosts] = useState(SAMPLE_HOSTS)
  const [students, setStudents] = useState(SAMPLE_STUDENTS)
  const [assignments, setAssignments] = useState({})
  const [query, setQuery] = useState('')
  const [hostQuery, setHostQuery] = useState('')
  const [toast, setToast] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [sheetUrl, setSheetUrl] = useState('')
  const [syncUrl, setSyncUrl] = useState('')
  const [loadingSheet, setLoadingSheet] = useState(false)
  const hostFileRef = useRef(null)
  const studentFileRef = useRef(null)
  const restoredSheetRef = useRef(false)
  const groups = useMemo(() => buildStudentGroups(students), [students])

  useEffect(() => {
    if (restoredSheetRef.current) return
    restoredSheetRef.current = true
    try {
      const savedUrl = window.localStorage.getItem('gatherwell.sheetUrl') ?? ''
      setSheetUrl(savedUrl)
      if (savedUrl) loadGoogleSheetUrl(savedUrl)
    } catch {
      showToast('Browser storage is unavailable; the sheet URL will not be remembered.', 'error')
    }
  }, [])

  const getAssignedGroups = (hostId, currentAssignments = assignments) => (
    (currentAssignments[hostId] ?? []).map((id) => groups.find((group) => group.id === id)).filter(Boolean)
  )
  const assignedCount = useMemo(() => Object.values(assignments).flat().length, [assignments])
  const assignedStudentsCount = useMemo(() => Object.values(assignments).flat()
    .map((id) => groups.find((group) => group.id === id)?.members.length ?? 0)
    .reduce((sum, count) => sum + count, 0), [assignments, groups])

  const visibleGroups = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    return groups.filter((group) => !search || group.members.some((member) =>
      [member.name, member.university, member.country, member.religion].join(' ').toLocaleLowerCase().includes(search),
    ))
  }, [groups, query])
  const visibleHosts = useMemo(() => hosts.filter((host) =>
    !hostQuery.trim() || [host.name, host.district, host.venue].join(' ').toLocaleLowerCase().includes(hostQuery.trim().toLocaleLowerCase()),
  ), [hosts, hostQuery])

  function showToast(message, type = 'success') {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 4200)
  }

  function assignGroup(host, group) {
    const alreadyHere = (assignments[host.id] ?? []).includes(group.id)
    if (alreadyHere) return
    const next = Object.fromEntries(Object.entries(assignments).map(([id, ids]) => [id, ids.filter((groupId) => groupId !== group.id)]))
    const nextHostGroups = (next[host.id] ?? []).map((id) => groups.find((item) => item.id === id)).filter(Boolean)
    const capacityUsed = nextHostGroups.reduce((sum, item) => sum + item.members.length, 0)
    const overlap = overlapsForGroup(host, group)
    if (capacityUsed + group.members.length > host.capacity) {
      showToast(`${host.name} doesn't have room for this group.`, 'error')
      return
    }
    if (!overlap.length) {
      showToast(`${host.name} has no meal time in common with this group.`, 'error')
      return
    }
    next[host.id] = [...(next[host.id] ?? []), group.id]
    setAssignments(next)
    showToast(`${group.members.length > 1 ? `${group.members.length} students` : group.members[0].name} matched with ${host.name}.`)
  }

  function unassignGroup(hostId, groupId) {
    setAssignments((current) => ({ ...current, [hostId]: (current[hostId] ?? []).filter((id) => id !== groupId) }))
    showToast('Student group unassigned.')
  }

  async function importFile(event, kind) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const records = parseCsv(await file.text(), kind)
      if (kind === 'hosts') {
        setHosts(records)
        setAssignments({})
      } else {
        setStudents(records)
        setAssignments({})
      }
      showToast(`Loaded ${records.length} ${kind === 'hosts' ? 'host families' : 'students'} from ${file.name}.`)
    } catch (error) {
      showToast(error.message || 'Could not read that CSV file.', 'error')
    }
  }

  async function loadGoogleSheetUrl(url) {
    const enteredUrl = url.trim()
    const sheetId = enteredUrl.match(/^https?:\/\/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([a-z0-9_-]+)/i)?.[1]
    if (!sheetId) {
      showToast('Paste a valid Google Sheets URL containing /spreadsheets/d/<sheet-id>.', 'error')
      return
    }
    setLoadingSheet(true)
    try {
      const tabs = [
        ['hosts', 'Family - Responses'],
        ['students', 'Students - Responses'],
      ]
      const loaded = await Promise.all(tabs.map(async ([kind, tab]) => {
        const endpoint = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 15_000)
        try {
          const response = await fetch(endpoint, { signal: controller.signal })
          if (!response.ok) throw new Error(`${tab} request returned ${response.status}.`)
          const csv = await response.text()
          if (/^\s*</.test(csv)) throw new Error(`${tab} did not return CSV data.`)
          return [kind, parseCsv(csv, kind)]
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error(`${tab} request timed out after 15 seconds.`)
          }
          throw error
        } finally {
          window.clearTimeout(timeout)
        }
      }))
      const records = Object.fromEntries(loaded)
      setHosts(records.hosts)
      setStudents(records.students)
      setAssignments({})
      try {
        window.localStorage.setItem('gatherwell.sheetUrl', enteredUrl)
        showToast(`Loaded ${records.hosts.length} hosts and ${records.students.length} students from Google Sheets.`)
      } catch {
        showToast('Sheet data loaded, but browser storage is unavailable so the URL could not be remembered.', 'error')
      }
    } catch (error) {
      const details = error instanceof Error ? ` ${error.message}` : ''
      showToast(`Could not load the sheet. Check that sharing is set to “Anyone with the link can view”, both tab names match, and the sheet is reachable.${details}`, 'error')
    } finally {
      setLoadingSheet(false)
    }
  }

  function handleSheetSubmit(event) {
    event.preventDefault()
    loadGoogleSheetUrl(sheetUrl)
  }

  async function confirmExport() {
    try {
      const csv = serializeCsv(hosts, assignments, groups)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'gatherwell-christmas-matches.csv'
      link.click()
      URL.revokeObjectURL(link.href)
      if (syncUrl.trim()) {
        const response = await fetch(syncUrl.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'text/csv;charset=utf-8' },
          body: csv,
        })
        if (!response.ok) throw new Error(`CSV downloaded, but the sync endpoint returned ${response.status} ${response.statusText}.`)
      }
      setExportOpen(false)
      showToast(syncUrl.trim() ? 'CSV exported and synced successfully.' : 'Your matching CSV is ready to download.')
    } catch (error) {
      showToast(error.message || 'Could not export the matching CSV.', 'error')
    }
  }

  function hostCanTakeGroup(host, group) {
    const existing = getAssignedGroups(host.id).filter((item) => item.id !== group.id)
    const used = existing.reduce((sum, item) => sum + item.members.length, 0)
    return used + group.members.length <= host.capacity && overlapsForGroup(host, group).length > 0
  }

  function hostSoftNotes(host, group) {
    const notes = []
    const restrictions = group.members.map((member) => member.dietary).filter((diet) => diet && !/no restrictions|none|n\/a|not provided|prefer not to say/i.test(diet))
    if (restrictions.length) notes.push(`Dietary: ${[...new Set(restrictions)].join(', ')}`)
    const preferred = [...new Set(group.members.map((member) => member.language).filter(Boolean))]
    const shared = preferred.filter((language) => host.languages.some((spoken) => spoken.toLowerCase() === language.toLowerCase()))
    if (preferred.length && !shared.length) notes.push('No shared preferred language')
    return notes
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Gatherwell home">
          <span className="brand-mark"><Heart size={18} fill="currentColor" /></span>
          <span className="brand-name">gatherwell<span>.</span></span>
          <span className="brand-divider" />
          <span className="brand-program">Christmas dinners</span>
        </a>
        <div className="topbar-right">
          <form className="sheet-loader" onSubmit={handleSheetSubmit}>
            <label className="sr-only" htmlFor="sheet-url">Load from Google Sheet URL</label>
            <input id="sheet-url" type="url" value={sheetUrl} onChange={(event) => setSheetUrl(event.target.value)} placeholder="Load from Google Sheet URL" autoComplete="url" disabled={loadingSheet} />
            <button className="button button-dark" type="submit" disabled={loadingSheet}>{loadingSheet ? 'Loading…' : 'Load Sheet'}</button>
          </form>
          <button className="button button-dark" onClick={() => setExportOpen(true)} disabled={loadingSheet}><ArrowDownToLine size={16} /> Confirm &amp; export CSV</button>
        </div>
      </header>

      <main>
        <section className="welcome-row">
          <div>
            <div className="eyebrow"><span className="eyebrow-dot" /> THE SEASON OF TOGETHERNESS</div>
            <h1>Make room at the table.</h1>
            <p className="welcome-copy">Bring international students and local families together this Christmas.</p>
          </div>
          <div className="program-card">
            <div className="program-icon"><CalendarDays size={19} /></div>
            <div><span className="program-label">PROGRAM DATES</span><strong>December 13 — 27</strong><span className="program-sub">Lunch &amp; dinner · 15 days</span></div>
            <span className="program-live"><i /> MATCHING OPEN</span>
          </div>
        </section>

        <section className="summary-bar">
          <div className="summary-item"><span className="summary-icon"><Home size={17} /></span><span><strong>{hosts.length}</strong><small>{hosts.length === 1 ? 'host family' : 'host families'}</small></span></div>
          <span className="summary-separator" />
          <div className="summary-item"><span className="summary-icon students-icon"><Users size={17} /></span><span><strong>{students.length}</strong><small>{students.length === 1 ? 'student signed up' : 'students signed up'}</small></span></div>
          <span className="summary-separator" />
          <div className="summary-item"><span className="summary-icon matches-icon"><Heart size={16} /></span><span><strong>{assignedCount} <em>{assignedCount === 1 ? 'group' : 'groups'}</em></strong><small>{assignedStudentsCount} {assignedStudentsCount === 1 ? 'student' : 'students'} matched</small></span></div>
          <div className="summary-spacer" />
          <button className="upload-button" onClick={() => hostFileRef.current?.click()} disabled={loadingSheet}><CloudUpload size={15} /> Upload hosts CSV</button>
          <button className="upload-button" onClick={() => studentFileRef.current?.click()} disabled={loadingSheet}><CloudUpload size={15} /> Upload students CSV</button>
          <input ref={hostFileRef} type="file" accept=".csv,text/csv" className="hidden-input" onChange={(event) => importFile(event, 'hosts')} />
          <input ref={studentFileRef} type="file" accept=".csv,text/csv" className="hidden-input" onChange={(event) => importFile(event, 'students')} />
        </section>

        <section className="workspace-heading">
          <div><h2>Find the right fit</h2><p>Smart matches consider shared availability, group requests, and capacity.</p></div>
          <div className="matching-note"><Sparkles size={14} /> Friends stay together · {groups.length} student {groups.length === 1 ? 'group' : 'groups'}</div>
        </section>

        <section className="matching-workspace">
          <div className="pane host-pane">
            <div className="pane-header">
              <div className="pane-title"><span className="pane-icon host-pane-icon"><Home size={17} /></span><div><h3>Host families</h3><span>{hosts.length} {hosts.length === 1 ? 'welcoming table' : 'welcoming tables'}</span></div></div>
              <label className="search-field host-search"><Search size={15} /><input value={hostQuery} onChange={(event) => setHostQuery(event.target.value)} placeholder="Find a host" aria-label="Search hosts" /></label>
            </div>
            <div className="pane-scroll host-scroll">
              {visibleHosts.map((host) => {
                const hostGroupIds = assignments[host.id] ?? []
                const hostGroups = getAssignedGroups(host.id)
                const seated = hostGroups.reduce((sum, group) => sum + group.members.length, 0)
                const overlap = getHostOverlap(host, hostGroups)
                const health = hostGroups.length ? getScheduleHealth(overlap.length) : null
                return (
                  <article className={`host-card ${hostGroupIds.length ? 'host-card-seated' : ''}`} key={host.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                    event.preventDefault()
                    const group = groups.find((item) => item.id === event.dataTransfer.getData('text/plain'))
                    if (group) assignGroup(host, group)
                  }}>
                    <div className="host-card-top">
                      <div className="host-identity">
                        <div className="host-avatar"><Home size={18} /></div>
                        <div className="host-name-block"><h4>{host.name}</h4><span><MapPin size={12} /> {host.district} <b>·</b> {host.venue}</span></div>
                      </div>
                      <div className={`capacity ${seated >= host.capacity ? 'capacity-full' : ''}`}><Users size={13} /><strong>{seated}</strong><span>/ {host.capacity}</span><small>SPOTS</small></div>
                    </div>
                    <div className="host-meta">
                      <span className="meta-item"><Languages size={13} /> {host.languages.join(', ') || 'Languages not listed'}</span>
                      {host.remarks && <span className="meta-item remarks"><MessageCircle size={13} /> {host.remarks}</span>}
                    </div>
                    {hostGroups.length > 0 && (
                      <div className="assigned-section">
                        <div className="assigned-heading"><span>AT THE TABLE <b>{hostGroups.length}</b></span>
                          <span className={`health-pill health-${health.tone}`}>{health.tone === 'healthy' ? <CheckCircle2 size={12} /> : <CircleAlert size={12} />}{health.label} · {overlap.length} {overlap.length === 1 ? 'slot' : 'slots'}</span>
                        </div>
                        {hostGroups.map((group) => (
                          <div className="assigned-group" key={group.id}>
                            <div className="assigned-avatars">{group.members.map((member, index) => <StudentAvatar key={member.id} student={member} index={index} size="small" />)}</div>
                            <div className="assigned-name"><strong>{group.members.map((member) => member.name).join(' & ')}</strong><span>{group.members.length} {group.members.length === 1 ? 'student' : 'students'} together</span></div>
                            <button className="unassign-button" aria-label={`Unassign ${group.members.map((member) => member.name).join(' and ')}`} onClick={() => unassignGroup(host.id, group.id)}><X size={15} /></button>
                          </div>
                        ))}
                        {hostSoftNotes(host, hostGroups.flatMap((group) => group.members).length ? {
                          members: hostGroups.flatMap((group) => group.members),
                        } : { members: [] }).map((note) => <div className="soft-note" key={note}><Leaf size={12} /> {note}</div>)}
                        {overlap.length > 0 && <div className="overlap-preview"><Clock3 size={12} /> Shared: {overlap.slice(0, 4).map(formatSlot).join(' · ')}{overlap.length > 4 ? ` +${overlap.length - 4} more` : ''}</div>}
                      </div>
                    )}
                    <HostAvailability host={host} assignedGroups={hostGroups} />
                    {hostGroups.length === 0 && <div className="drop-hint"><Plus size={13} /> Drop a student group here to match</div>}
                  </article>
                )
              })}
              {!visibleHosts.length && <div className="empty-state"><Search size={20} /><strong>No hosts found</strong><span>Try a different name or district.</span></div>}
            </div>
          </div>

          <div className="pane student-pane">
            <div className="pane-header student-pane-header">
              <div className="pane-title"><span className="pane-icon student-pane-icon"><Users size={17} /></span><div><h3>Student groups</h3><span>{groups.length} {groups.length === 1 ? 'group' : 'groups'} · {students.length} {students.length === 1 ? 'student' : 'students'}</span></div></div>
              <label className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" aria-label="Search student groups" /></label>
            </div>
            <div className="pane-scroll student-scroll">
              {visibleGroups.map((group) => {
                const assignedHost = hosts.find((host) => (assignments[host.id] ?? []).includes(group.id))
                const availableHosts = hosts.map((host) => ({ host, overlap: overlapsForGroup(host, group) }))
                  .filter(({ host, overlap }) => hostCanTakeGroup(host, group) && overlap.length)
                  .sort((left, right) => right.overlap.length - left.overlap.length)
                const groupName = group.members.map((member) => member.name).join(' + ')
                return (
                  <article
                    className={`student-card ${assignedHost ? 'student-card-assigned' : ''}`}
                    key={group.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', group.id)
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                  >
                    <div className="student-card-heading">
                      <div className="student-group-avatars">{group.members.map((member, index) => <StudentAvatar key={member.id} student={member} index={index} />)}</div>
                      <div className="group-heading-name"><span className="group-kicker">{group.members.length > 1 ? 'FRIENDS TOGETHER' : 'LOOKING TO JOIN'}</span><h4>{groupName}</h4></div>
                      <span className={`group-status ${assignedHost ? 'status-assigned' : ''}`}>{assignedHost ? <><Check size={12} /> Matched</> : <><Sparkles size={12} /> Ready to match</>}</span>
                    </div>
                    <div className="member-list">{group.members.map((member, index) => <StudentDetails key={member.id} member={member} index={index} />)}</div>
                    <div className="details-grid">
                      <InfoTile icon={Heart} label="RELIGION / FAITH" value={[...new Set(group.members.map((member) => member.religion).filter(Boolean))].join(' · ')} />
                      <InfoTile icon={Globe2} label="COUNTRY" value={[...new Set(group.members.map((member) => member.country).filter(Boolean))].join(' · ')} />
                      <InfoTile icon={Leaf} label="DIETARY" value={[...new Set(group.members.map((member) => member.dietary).filter(Boolean))].join(' · ')} className="diet-tile" />
                      <InfoTile icon={Languages} label="LANGUAGE" value={[...new Set(group.members.map((member) => member.language).filter(Boolean))].join(' · ')} />
                    </div>
                    {group.missingRequests.length > 0 && (
                      <div className="missing-friend"><CircleAlert size={14} /><span><strong>Friend not signed up:</strong> {group.missingRequests.map((item) => item.name).join(', ')} <small>requested by {group.missingRequests.map((item) => item.from).join(', ')}</small></span></div>
                    )}
                    <div className="group-availability">
                      <div className="group-availability-heading"><span><Clock3 size={13} /> JOINTLY AVAILABLE MEALS</span><b>{group.availability.length} slots</b></div>
                      <div className="slot-chips">{group.availability.length
                        ? group.availability.map((slot) => <span className="slot-chip" key={slot}>{formatSlot(slot)}</span>)
                        : <span className="no-slots">No shared meal times — check individual availability</span>}</div>
                    </div>
                    <div className="recommendations">
                      <div className="recommendation-title"><span><Sparkles size={13} /> BEST-FIT HOSTS</span><span>{assignedHost ? 'Already matched' : 'Sorted by shared times'}</span></div>
                      {availableHosts.length > 0 ? <div className="recommendation-list">{availableHosts.slice(0, 3).map(({ host, overlap }) => (
                        <div className="recommendation-row" key={host.id}>
                          <div className="recommendation-host"><span className="mini-home"><Home size={13} /></span><div><strong>{host.name}</strong><span>{host.district} · {overlap.length} shared {overlap.length === 1 ? 'slot' : 'slots'}</span></div></div>
                          <button className={`assign-button ${(assignments[host.id] ?? []).includes(group.id) ? 'assign-done' : ''}`} disabled={(assignments[host.id] ?? []).includes(group.id)} onClick={() => assignGroup(host, group)}>{(assignments[host.id] ?? []).includes(group.id) ? <><Check size={13} /> Seated</> : <>Invite <ArrowRight size={13} /></>}</button>
                        </div>
                      ))}</div> : <div className="no-host-fit"><SlidersHorizontal size={14} /> No host currently fits capacity and shared availability.</div>}
                      {assignedHost && <div className="assigned-host-note"><CheckCircle2 size={13} /> This group is seated with {assignedHost.name} <button onClick={() => unassignGroup(assignedHost.id, group.id)}>Undo</button></div>}
                    </div>
                    <span className="drag-label"><span className="drag-grip">⠿</span> Drag group to a host card</span>
                  </article>
                )
              })}
              {!visibleGroups.length && <div className="empty-state"><Search size={20} /><strong>No student groups found</strong><span>Try another search or upload student data.</span></div>}
            </div>
          </div>
        </section>
        <footer className="page-footer"><span>Made for meaningful moments <Heart size={12} fill="currentColor" /></span><span>GATHERWELL · CHRISTMAS 2026</span></footer>
      </main>

      {exportOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setExportOpen(false)}>
          <section className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
            <button className="modal-close icon-button" onClick={() => setExportOpen(false)} aria-label="Close"><X size={17} /></button>
            <div className="export-icon"><Download size={20} /></div>
            <div className="eyebrow">READY TO SHARE</div>
            <h2 id="export-title">Confirm your matches</h2>
            <p className="export-description">Your CSV will include host details, matched students, shared meals, and schedule health.</p>
            <div className="export-summary">
              <span><Users size={15} /> {assignedStudentsCount} students</span><span><Heart size={15} /> {assignedCount} groups</span><span><Home size={15} /> {Object.values(assignments).filter((ids) => ids.length).length} hosts</span>
            </div>
            {assignedCount > 0 && <div className="export-preview">
              {hosts.filter((host) => (assignments[host.id] ?? []).length).map((host) => {
                const overlap = getHostOverlap(host, getAssignedGroups(host.id))
                const health = getScheduleHealth(overlap.length)
                return <div key={host.id}><span>{host.name}</span><b className={`health-text-${health.tone}`}>{health.label} · {overlap.length} slots</b></div>
              })}
            </div>}
            <label className="sync-label" htmlFor="sync-url"><span><Send size={14} /> Optional Google Apps Script sync</span><small>POST the same CSV after download</small></label>
            <input id="sync-url" className="sync-input" value={syncUrl} onChange={(event) => setSyncUrl(event.target.value)} placeholder="https://script.google.com/macros/s/.../exec" />
            <div className="modal-actions"><button className="button button-outline" onClick={() => setExportOpen(false)}>Keep matching</button><button className="button button-dark" onClick={confirmExport}><ArrowDownToLine size={15} /> Confirm &amp; export CSV</button></div>
          </section>
        </div>
      )}
      {toast && <div className={`toast toast-${toast.type}`} role="status">{toast.type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}{toast.message}</div>}
    </div>
  )
}

export default App
