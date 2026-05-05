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
import React, { useMemo } from 'react'
import { renderMarkdown, substitutePlaceholders } from '../lib/markdown'

interface PreviewPaneProps {
  content: string
  characterName?: string
}

/**
 * Markdown preview pane with CBS placeholder substitution.
 * Renders content using the built-in markdown renderer and
 * substitutes basic {{char}}/{{user}} placeholders.
 */
export const PreviewPane: React.FC<PreviewPaneProps> = ({
  content,
  characterName,
}) => {
  const html = useMemo(() => {
    const substituted = substitutePlaceholders(content, {
      char: characterName || '{{char}}',
      user: '{{user}}',
    })
    return renderMarkdown(substituted)
  }, [content, characterName])

  return (
    <div className="re-preview-pane">
      <div className="re-preview-header">
        <span className="re-preview-header-label">Preview</span>
      </div>
      <div
        className="re-preview-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
