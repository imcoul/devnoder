import React, { useState, useCallback } from 'react';
import { bufferManager, $activeBuffer } from '../../services/editor/BufferManager';
import './FlutterEditor.css';

interface WidgetNode {
  id: string;
  type: string;
  props: Record<string, string>;
  children: WidgetNode[];
}

const WIDGET_TEMPLATES: Record<string, { props: Record<string, string>; children?: boolean }> = {
  Scaffold:      { props: { backgroundColor: 'Colors.white' }, children: true },
  AppBar:        { props: { title: "'My App'" }, children: false },
  Column:        { props: { mainAxisAlignment: 'MainAxisAlignment.start' }, children: true },
  Row:           { props: { mainAxisAlignment: 'MainAxisAlignment.start' }, children: true },
  Container:     { props: { width: '100', height: '100', color: 'Colors.blue' }, children: true },
  Text:          { props: { data: "'Hello'", fontSize: '16' }, children: false },
  ElevatedButton:{ props: { label: "'Press me'" }, children: false },
  Image:         { props: { url: "'https://picsum.photos/200'" }, children: false },
  Padding:       { props: { all: '16' }, children: true },
  SizedBox:      { props: { width: '16', height: '16' }, children: false },
  ListView:      { props: { shrinkWrap: 'true' }, children: true },
  Card:          { props: { elevation: '4' }, children: true },
  FloatingActionButton: { props: { label: "'Add'" }, children: false },
};

function nodeToCode(node: WidgetNode, indent = 2): string {
  const pad = ' '.repeat(indent);
  const props = Object.entries(node.props)
    .map(([k, v]) => `${pad}  ${k}: ${v},`).join('\n');
  const childCode = node.children.length
    ? `\n${pad}  children: [\n${node.children.map(c => `${pad}    ${nodeToCode(c, indent + 4)},`).join('\n')}\n${pad}  ],`
    : '';

  if (node.type === 'Text') return `Text(${node.props.data}, style: TextStyle(fontSize: ${node.props.fontSize}))`;
  if (node.type === 'SizedBox') return `SizedBox(width: ${node.props.width}, height: ${node.props.height})`;

  return `${node.type}(\n${props}${childCode}\n${pad})`;
}

function treeToFile(root: WidgetNode): string {
  return `import 'package:flutter/material.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: ${nodeToCode(root, 6)},
    );
  }
}
`;
}

let _nextId = 1;
function makeNode(type: string): WidgetNode {
  const tmpl = WIDGET_TEMPLATES[type] ?? { props: {}, children: true };
  return { id: String(_nextId++), type, props: { ...tmpl.props }, children: [] };
}

function TreeNode({ node, selected, onSelect, onDelete, onAddChild }: {
  node: WidgetNode;
  selected: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, type: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isSelected = node.id === selected;
  const canHaveChildren = WIDGET_TEMPLATES[node.type]?.children !== false;

  return (
    <div className="tree-node">
      <div className={`tree-row ${isSelected ? 'selected' : ''}`} onClick={() => onSelect(node.id)}>
        {canHaveChildren && (
          <button className="tree-toggle" onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}>
            {expanded ? '▾' : '▸'}
          </button>
        )}
        {!canHaveChildren && <span className="tree-toggle-spacer" />}
        <span className="tree-type">{node.type}</span>
        <button className="tree-del" onClick={e => { e.stopPropagation(); onDelete(node.id); }}>×</button>
      </div>
      {expanded && canHaveChildren && (
        <div className="tree-children">
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} selected={selected}
              onSelect={onSelect} onDelete={onDelete} onAddChild={onAddChild} />
          ))}
          <select className="tree-add-select"
            value="" onChange={e => { if (e.target.value) onAddChild(node.id, e.target.value); }}>
            <option value="">+ Add widget</option>
            {Object.keys(WIDGET_TEMPLATES).map(w => <option key={w}>{w}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

export default function FlutterEditor() {
  const [root, setRoot] = useState<WidgetNode>(() => {
    const scaffold = makeNode('Scaffold');
    const appBar = makeNode('AppBar');
    const col = makeNode('Column');
    const text = makeNode('Text');
    col.children.push(text);
    scaffold.children.push(appBar, col);
    return scaffold;
  });
  const [selected, setSelected] = useState<string | null>(null);

  const findAndUpdate = useCallback((
    node: WidgetNode,
    id: string,
    updater: (n: WidgetNode) => WidgetNode
  ): WidgetNode => {
    if (node.id === id) return updater(node);
    return { ...node, children: node.children.map(c => findAndUpdate(c, id, updater)) };
  }, []);

  const findAndDelete = useCallback((node: WidgetNode, id: string): WidgetNode => ({
    ...node,
    children: node.children
      .filter(c => c.id !== id)
      .map(c => findAndDelete(c, id)),
  }), []);

  const addChild = (parentId: string, type: string) => {
    setRoot(r => findAndUpdate(r, parentId, n => ({ ...n, children: [...n.children, makeNode(type)] })));
  };

  const deleteNode = (id: string) => {
    if (id === root.id) return;
    setRoot(r => findAndDelete(r, id));
    if (selected === id) setSelected(null);
  };

  const pushToCode = () => {
    const id = $activeBuffer.get();
    if (id) bufferManager.update(id, treeToFile(root));
  };

  const selectedNode = selected ? (() => {
    const find = (n: WidgetNode): WidgetNode | null => {
      if (n.id === selected) return n;
      for (const c of n.children) { const f = find(c); if (f) return f; }
      return null;
    };
    return find(root);
  })() : null;

  return (
    <div className="flutter-editor">
      <div className="flutter-tree">
        <div className="flutter-tree-head">
          <span>Widget Tree</span>
          <button className="flutter-push-btn" onClick={pushToCode}>→ Code</button>
        </div>
        <div className="flutter-tree-scroll">
          <TreeNode node={root} selected={selected}
            onSelect={setSelected} onDelete={deleteNode} onAddChild={addChild} />
        </div>
      </div>
      {selectedNode && (
        <div className="flutter-props">
          <div className="flutter-props-head">{selectedNode.type} props</div>
          {Object.entries(selectedNode.props).map(([k, v]) => (
            <div key={k} className="flutter-prop-row">
              <label className="flutter-prop-key">{k}</label>
              <input className="flutter-prop-val" value={v}
                onChange={e => setRoot(r => findAndUpdate(r, selectedNode.id, n => ({
                  ...n, props: { ...n.props, [k]: e.target.value },
                })))} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
