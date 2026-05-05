/**
 * risup-editor-plugin, a RisuAI plugin for editing character lorebooks, prompts, and settings
 * Copyright (C) 2026 nevaeh5379
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { VscWarning } from 'react-icons/vsc'
import { UniversalEditor } from './editors/UniversalEditor'
import type { LoreBook } from '../types/risuai.d.ts'
import { PreviewPane } from './PreviewPane'

interface LoreEntryEditorProps {
  /** Raw JSON content of the lorebook entry */
  content: string
  filePath: string | null
  onChange: (value: string) => void
  showPreview?: boolean
  characterName?: string
}

type LoreMode = LoreBook['mode']
const LORE_MODES: LoreMode[] = ['multiple', 'constant', 'normal', 'child', 'folder']

/**
 * Form-based editor for lorebook entries. Default view shows the `content`
 * field in a Monaco editor (full height) with a meta sidebar on the right.
 * A toggle switches to a raw JSON view for power users.
 */
export const LoreEntryEditor: React.FC<LoreEntryEditorProps> = ({
  content,
  filePath,
  onChange,
  showPreview = false,
  characterName,
}) => {
  const [rawMode, setRawMode] = useState(false)

  // Parse incoming JSON into a working entry. We keep parse errors so the
  // user can drop into raw mode and fix them.
  const parsed = useMemo<{ entry: Partial<LoreBook> | null; error: string | null }>(() => {
    try {
      return { entry: JSON.parse(content) as Partial<LoreBook>, error: null }
    } catch (e) {
      return { entry: null, error: (e as Error).message }
    }
  }, [content])

  // Re-emit JSON whenever the user mutates a field. We do not own state for
  // the entry — content is the source of truth — so every edit re-serializes
  // the *whole* JSON object to preserve any extra fields we don't know about.
  const update = useCallback(
    (patch: Partial<LoreBook>) => {
      if (!parsed.entry) return
      const next = { ...parsed.entry, ...patch }
      onChange(JSON.stringify(next, null, 2))
    },
    [parsed.entry, onChange]
  )

  // ── Raw mode: a single Monaco editor on the entire JSON ─────────────────
  if (rawMode) {
    return (
      <div className="re-lore-editor">
        <div className="re-lore-toolbar">
          <button
            className="re-btn re-btn-icon-text"
            onClick={() => setRawMode(false)}
            title="Switch to form view"
          >
            ✦ Form view
          </button>
          <span className="re-lore-toolbar-hint">Raw JSON</span>
        </div>
        <div className="re-lore-content">
          <RawJsonEditor content={content} filePath={filePath} onChange={onChange} />
        </div>
      </div>
    )
  }

  // ── Parse failure: force raw mode so user can fix it ────────────────────
  if (!parsed.entry) {
    return (
      <div className="re-lore-editor">
        <div className="re-lore-toolbar re-lore-toolbar-error">
          <span><VscWarning /> Cannot parse JSON: {parsed.error}</span>
          <button className="re-btn" onClick={() => setRawMode(true)}>
            Fix in raw mode
          </button>
        </div>
        <div className="re-lore-content">
          <RawJsonEditor content={content} filePath={filePath} onChange={onChange} />
        </div>
      </div>
    )
  }

  const entry = parsed.entry
  const entryContent = typeof entry.content === 'string' ? entry.content : ''
  const isFolder = entry.mode === 'folder'

  return (
    <div className="re-lore-editor">
      <div className="re-lore-toolbar">
        <span className="re-lore-toolbar-title">
          {isFolder ? '📁 ' : '📖 '}
          {entry.comment || entry.key || (isFolder ? 'Folder' : 'Lorebook Entry')}
        </span>
        <button
          className="re-btn re-btn-icon-text"
          onClick={() => setRawMode(true)}
          title="Switch to raw JSON view"
        >
          { } Raw JSON
        </button>
      </div>
      <div className="re-lore-body">
        <div className="re-lore-main">
          {isFolder ? (
            <div className="re-lore-folder-notice">
              <p>This is a <strong>folder</strong> — it organizes child entries but has no content itself.</p>
              <p>Child entries are shown nested under this folder in the file explorer.</p>
            </div>
          ) : (
            <>
              <div className="re-lore-content-label">Content</div>
              {showPreview ? (
                <div className="re-editor-split" style={{ flex: 1, minHeight: 0 }}>
                  <div className="re-lore-content">
                    <ContentEditor
                      key={filePath}
                      value={entryContent}
                      onChange={(v) => update({ content: v })}
                    />
                  </div>
                  <PreviewPane content={entryContent} characterName={characterName} />
                </div>
              ) : (
                <div className="re-lore-content">
                  <ContentEditor
                    key={filePath}
                    value={entryContent}
                    onChange={(v) => update({ content: v })}
                  />
                </div>
              )}
            </>
          )}
        </div>
        <aside className="re-lore-meta">
          <Field label="Title (comment)">
            <input
              className="re-input"
              type="text"
              value={entry.comment ?? ''}
              onChange={(e) => update({ comment: e.target.value })}
            />
          </Field>
          <Field label={isFolder ? 'Folder key (auto-generated)' : 'Keys'} hint={isFolder ? 'Internal identifier for folder reference' : 'Comma-separated trigger words'}>
            <input
              className={`re-input${isFolder ? ' re-input-readonly' : ''}`}
              type="text"
              value={entry.key ?? ''}
              onChange={(e) => update({ key: e.target.value })}
              readOnly={isFolder}
            />
          </Field>
          {!isFolder && (
            <>
              <Field label="Secondary keys" hint="Required additionally when 'selective' is on">
                <input
                  className="re-input"
                  type="text"
                  value={entry.secondkey ?? ''}
                  onChange={(e) => update({ secondkey: e.target.value })}
                />
              </Field>
            </>
          )}
          <Field label="Mode">
            <select
              className="re-input"
              value={entry.mode ?? 'normal'}
              onChange={(e) => update({ mode: e.target.value as LoreMode })}
            >
              {LORE_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Insertion order" hint="Higher = inserted later (closer to last message)">
            <input
              className="re-input"
              type="number"
              value={entry.insertorder ?? 100}
              onChange={(e) => update({ insertorder: Number(e.target.value) })}
            />
          </Field>
          {!isFolder && (
            <>
              <Field label="Activation %" hint="Probability (0–100). Empty = always trigger when keys match">
                <input
                  className="re-input"
                  type="number"
                  min={0}
                  max={100}
                  value={entry.activationPercent ?? ''}
                  onChange={(e) =>
                    update({
                      activationPercent:
                        e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Toggle
                label="Always active"
                checked={!!entry.alwaysActive}
                onChange={(v) => update({ alwaysActive: v })}
                hint="Activate regardless of keys"
              />
              <Toggle
                label="Selective"
                checked={!!entry.selective}
                onChange={(v) => update({ selective: v })}
                hint="Require both key and secondary key to match"
              />
              <Toggle
                label="Use regex"
                checked={!!entry.useRegex}
                onChange={(v) => update({ useRegex: v })}
                hint="Treat keys as regular expressions"
              />
              <Toggle
                label="Case sensitive"
                checked={!!entry.extentions?.risu_case_sensitive}
                onChange={(v) =>
                  update({
                    extentions: {
                      ...entry.extentions,
                      risu_case_sensitive: v || undefined,
                    } as any,
                  })
                }
                hint="Keys must match exact letter case"
              />
            </>
          )}
          {entry.id !== undefined && (
            <Field label="Entry ID" hint="Internal identifier">
              <input
                className="re-input re-input-readonly"
                type="text"
                value={entry.id ?? ''}
                readOnly
              />
            </Field>
          )}
        </aside>
      </div>
    </div>
  )
}

// ── Field row + Toggle helpers ─────────────────────────────────────────────

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div className="re-lore-field">
    <label className="re-lore-field-label">{label}</label>
    {children}
    {hint && <div className="re-lore-field-hint">{hint}</div>}
  </div>
)

const Toggle: React.FC<{
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}> = ({ label, checked, onChange, hint }) => (
  <label className="re-lore-toggle">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="re-lore-toggle-label">{label}</span>
    {hint && <span className="re-lore-toggle-hint">{hint}</span>}
  </label>
)

const ContentEditor: React.FC<{ value: string; onChange: (v: string) => void }> = ({
  value,
  onChange,
}) => {
  return (
    <UniversalEditor
      content={value}
      language="markdown"
      filePath="content.md"
      onChange={(v) => onChange(v ?? '')}
    />
  )
}

const RawJsonEditor: React.FC<{
  content: string
  filePath: string | null
  onChange: (v: string) => void
}> = ({ content, filePath, onChange }) => {
  return (
    <UniversalEditor
      content={content}
      language="json"
      filePath={filePath || 'raw.json'}
      onChange={(v) => onChange(v ?? '')}
    />
  )
}

