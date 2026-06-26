import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { Extension } from '@codemirror/state';

// Rule: color + weight + style — never color alone
const makeHighlight = (opts: {
  keyword: string; string: string; comment: string;
  number: string; type: string; function: string; operator: string;
}) =>
  HighlightStyle.define([
    { tag: t.keyword,           color: opts.keyword,   fontWeight: '700' },
    { tag: t.string,            color: opts.string,    fontStyle: 'italic' },
    { tag: t.comment,           color: opts.comment,   fontStyle: 'italic', opacity: '0.7' },
    { tag: t.number,            color: opts.number },
    { tag: t.typeName,          color: opts.type,      fontWeight: '600' },
    { tag: t.function(t.variableName), color: opts.function },
    { tag: t.operator,          color: opts.operator },
    { tag: t.variableName,      color: opts.function },
    { tag: t.propertyName,      color: opts.type },
    { tag: t.tagName,           color: opts.keyword,   fontWeight: '700' },
    { tag: t.attributeName,     color: opts.type },
    { tag: t.invalid,           color: '#ef4444',      textDecoration: 'underline wavy #ef4444' },
    { tag: t.strikethrough,     textDecoration: 'line-through' },
    { tag: t.strong,            fontWeight: '700' },
    { tag: t.emphasis,          fontStyle: 'italic' },
    { tag: t.link,              color: opts.keyword,   textDecoration: 'underline' },
    { tag: t.heading,           color: opts.function,  fontWeight: '700' },
  ]);

export const THEME_HIGHLIGHTS: Record<string, Extension> = {
  'default': syntaxHighlighting(makeHighlight({
    keyword: '#c792ea', string: '#c3e88d', comment: '#546e7a',
    number: '#f78c6c', type: '#ffcb6b', function: '#82aaff', operator: '#89ddff',
  })),
  'light': syntaxHighlighting(makeHighlight({
    keyword: '#7c3aed', string: '#16a34a', comment: '#6b7280',
    number: '#dc2626', type: '#d97706', function: '#2563eb', operator: '#0891b2',
  })),
  'protanopia': syntaxHighlighting(makeHighlight({
    keyword: '#60a5fa', string: '#fcd34d', comment: '#6b7280',
    number: '#a78bfa', type: '#93c5fd', function: '#fbbf24', operator: '#e5e7eb',
  })),
  'deuteranopia': syntaxHighlighting(makeHighlight({
    keyword: '#93c5fd', string: '#fcd34d', comment: '#6b7280',
    number: '#c4b5fd', type: '#bfdbfe', function: '#fde68a', operator: '#e5e7eb',
  })),
  'tritanopia': syntaxHighlighting(makeHighlight({
    keyword: '#f87171', string: '#a78bfa', comment: '#6b7280',
    number: '#fb923c', type: '#f472b6', function: '#e879f9', operator: '#e5e7eb',
  })),
  'hc-aaa': syntaxHighlighting(makeHighlight({
    keyword: '#00ffff', string: '#ffff00', comment: '#aaaaaa',
    number: '#ff00ff', type: '#00ff00', function: '#ffffff', operator: '#cccccc',
  })),
  'hc-light': syntaxHighlighting(makeHighlight({
    keyword: '#000080', string: '#006400', comment: '#555555',
    number: '#8b0000', type: '#4b0082', function: '#00008b', operator: '#333333',
  })),
  'grayscale': syntaxHighlighting(makeHighlight({
    keyword: '#ffffff', string: '#bbbbbb', comment: '#666666',
    number: '#cccccc', type: '#dddddd', function: '#eeeeee', operator: '#aaaaaa',
  })),
};
