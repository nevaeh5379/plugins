import React from 'react';
import type { ColorPalette } from '../../../types';

interface HeaderTagsProps {
    tags: string[];
    color: ColorPalette;
    variant?: 'default' | 'modern' | 'smart' | 'banner' | 'simple' | 'compact' | 'cover';
}

/**
 * 헤더 태그 렌더링 컴포넌트.
 * variant에 따라 스타일이 달라집니다.
 */
const HeaderTags: React.FC<HeaderTagsProps> = ({ tags, color, variant = 'default' }) => {
    if (tags.length === 0) return null;

    switch (variant) {
        case 'modern':
            return (
                <div style={{ display: 'flex', gap: '5px' }}>
                    {tags.map((tag, i) => (
                        <span key={i} style={{
                            fontSize: '0.72em', color: color.textSecondary,
                            backgroundColor: 'rgba(0,0,0,0.2)',
                            padding: '2px 8px', borderRadius: '4px',
                            border: `1px solid ${color.border}`,
                        }}>{tag}</span>
                    ))}
                </div>
            );

        case 'smart':
            return (
                <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {tags.map((tag, i) => (
                        <span key={i} style={{
                            fontSize: '0.72em', color: color.nameColor,
                            background: color.quoteBg,
                            padding: '3px 9px', borderRadius: '6px',
                            fontWeight: 600,
                        }}>{tag}</span>
                    ))}
                </div>
            );

        case 'banner':
            return (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {tags.map((tag, i) => (
                        <span key={i} style={{
                            background: 'rgba(0,0,0,0.4)', color: '#fff',
                            padding: '4px 10px', borderRadius: '100px',
                            fontSize: '0.78em', border: '1px solid rgba(255,255,255,0.2)',
                        }}>{tag}</span>
                    ))}
                </div>
            );

        case 'simple':
            return (
                <div style={{ fontSize: '0.82em', color: color.textSecondary || color.text }}>
                    {tags.join(' · ')}
                </div>
            );

        case 'cover':
            return (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {tags.map((tag, i) => (
                        <span key={i} style={{
                            fontSize: '0.72em', padding: '2px 7px',
                            borderRadius: '4px', border: `1px solid ${color.border}`,
                            color: color.textSecondary, opacity: 0.8,
                        }}>{tag}</span>
                    ))}
                </div>
            );

        case 'compact':
            return (
                <div style={{ marginTop: '0.6em', display: 'flex', justifyContent: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    {tags.map((tag, i) => (
                        <span key={i} style={{
                            background: color.cardBg, color: color.textSecondary || color.text,
                            padding: '2px 8px', borderRadius: '100px',
                            fontSize: '0.72em', border: `1px solid ${color.border}`,
                        }}>{tag}</span>
                    ))}
                </div>
            );

        case 'default':
        default:
            return (
                <div style={{ marginTop: '0.8em', display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {tags.map((tag, i) => (
                        <span key={i} style={{
                            background: color.cardBg, color: color.textSecondary || color.text,
                            padding: '3px 10px', borderRadius: '100px',
                            fontSize: '0.78em', border: `1px solid ${color.border}`,
                        }}>{tag}</span>
                    ))}
                </div>
            );
    }
};

export default HeaderTags;
