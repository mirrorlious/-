import React from 'react';

const LogicTreeNode = ({ node, isRoot = false, displayMode, nodePath = 'root', collapsedNodes, onToggle, isEditing = false, onUpdateNode, onAddChild, onDeleteNode }) => {
    if (!node) return null;
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isCollapsed = hasChildren && collapsedNodes?.has(nodePath);
    const nodeLabel = node.nameZh || node.nameEn || '未命名分支';

    const renderText = () => {
        const mainColor = isRoot ? 'text-white' : 'text-gray-800 dark:text-gray-100';
        const subColor = isRoot ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400';
        if (displayMode === 'en') return <span className={`font-serif text-[14px] leading-snug ${mainColor}`}>{node.nameEn}</span>;
        if (displayMode === 'zh') return <span className={`text-[13.5px] leading-snug ${mainColor}`}>{node.nameZh}</span>;
        return (
            <div className="min-w-0">
                <div className={`font-serif font-semibold text-[13.5px] leading-snug break-words ${mainColor}`}>{node.nameEn}</div>
                <div className={`mt-1 text-[11.5px] leading-snug break-words ${subColor}`}>{node.nameZh}</div>
            </div>
        );
    };

    return (
        <div className="relative w-full">
            <div className={`reader-tree-node flex items-stretch border transition-colors ${isRoot ? 'bg-sky-700 dark:bg-sky-950 border-sky-700 dark:border-sky-800' : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 hover:border-sky-300 dark:hover:border-sky-700'}`}>
                <div className="min-w-0 flex-1 px-3 py-2.5">
                    {isEditing ? (
                        <div className="space-y-2">
                            <input
                                aria-label="导图节点英文标题"
                                value={node.nameEn || ''}
                                onChange={(event) => onUpdateNode?.(nodePath, { nameEn: event.target.value })}
                                className={`w-full px-2 py-1.5 text-[13px] border rounded-sm outline-none ${isRoot ? 'bg-white/95 text-slate-800 border-white/40' : 'bg-white dark:bg-gray-900 text-slate-800 dark:text-gray-100 border-slate-200 dark:border-gray-600'}`}
                                placeholder="English title"
                            />
                            <input
                                aria-label="导图节点中文标题"
                                value={node.nameZh || ''}
                                onChange={(event) => onUpdateNode?.(nodePath, { nameZh: event.target.value })}
                                className={`w-full px-2 py-1.5 text-[12px] border rounded-sm outline-none ${isRoot ? 'bg-white/95 text-slate-700 border-white/40' : 'bg-white dark:bg-gray-900 text-slate-700 dark:text-gray-200 border-slate-200 dark:border-gray-600'}`}
                                placeholder="中文标题"
                            />
                        </div>
                    ) : renderText()}
                </div>
                {isEditing && (
                    <div className="shrink-0 flex items-center gap-1 px-1.5">
                        <button type="button" onClick={(event) => { event.stopPropagation(); onAddChild?.(nodePath); }} className={`w-8 h-8 grid place-items-center rounded-sm ${isRoot ? 'text-white hover:bg-white/15' : 'text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/30'}`} title="新增子节点" aria-label="新增子节点">+</button>
                        {!isRoot && <button type="button" onClick={(event) => { event.stopPropagation(); onDeleteNode?.(nodePath); }} className="w-8 h-8 grid place-items-center rounded-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20" title="删除节点" aria-label="删除节点">×</button>}
                    </div>
                )}
                {hasChildren && (
                    <div className={`shrink-0 self-center px-1.5 py-0.5 text-[10px] font-medium border ${isRoot ? 'border-sky-300/60 text-sky-100' : 'border-slate-200 dark:border-gray-600 text-slate-400'}`}>
                        {node.children.length}
                    </div>
                )}
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); onToggle?.(nodePath); }}
                        className={`w-10 shrink-0 grid place-items-center border-l transition-colors ${isRoot ? 'border-sky-600 text-sky-100 hover:bg-sky-600 hover:text-white' : 'border-slate-100 dark:border-gray-700 text-slate-400 hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-gray-700 dark:hover:text-white'}`}
                        aria-label={`${isCollapsed ? '展开' : '收起'}分支：${nodeLabel}`}
                        aria-expanded={!isCollapsed}
                        title={isCollapsed ? '展开分支' : '收起分支'}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isCollapsed ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6"}></path>
                        </svg>
                    </button>
                ) : (
                    <div className={`w-10 shrink-0 grid place-items-center border-l ${isRoot ? 'border-sky-600' : 'border-slate-100 dark:border-gray-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isRoot ? 'bg-sky-200' : 'bg-slate-300 dark:bg-gray-600'}`}></span>
                    </div>
                )}
            </div>

            {hasChildren && !isCollapsed && (
                <div className={`mt-2 ml-5 pl-4 space-y-2 border-l ${isRoot ? 'border-gray-400 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700'}`}>
                    {node.children.map((child, idx) => (
                        <div key={`${nodePath}-${idx}`} className="relative">
                            <div className="absolute -left-4 top-5 w-4 border-t border-gray-200 dark:border-gray-700"></div>
                            <LogicTreeNode
                                node={child}
                                displayMode={displayMode}
                                nodePath={`${nodePath}.${idx}`}
                                collapsedNodes={collapsedNodes}
                                onToggle={onToggle}
                                isEditing={isEditing}
                                onUpdateNode={onUpdateNode}
                                onAddChild={onAddChild}
                                onDeleteNode={onDeleteNode}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const MindMapNodeText = ({ node, displayMode = 'bilingual', isRoot = false }) => {
    const en = node?.nameEn || '';
    const zh = node?.nameZh || '';
    if (displayMode === 'en') return <div className={`${isRoot ? 'font-semibold' : 'font-serif font-semibold'} leading-snug break-words`}>{en || zh || 'Untitled'}</div>;
    if (displayMode === 'zh') return <div className="font-medium leading-snug break-words">{zh || en || '未命名节点'}</div>;
    return (
        <div className="min-w-0">
            <div className={`${isRoot ? 'font-semibold' : 'font-serif font-semibold'} leading-snug break-words`}>{en || zh || 'Untitled'}</div>
            {zh && en && <div className={`mt-1 break-words ${isRoot ? 'text-sky-100' : 'text-slate-500 dark:text-slate-300'}`}>{zh}</div>}
        </div>
    );
};

const MindMapLeafList = ({ nodes = [], displayMode = 'bilingual', depth = 0 }) => {
    if (!Array.isArray(nodes) || nodes.length === 0) return null;
    return (
        <div className="reader-mindmap-leaves" data-depth={depth}>
            {nodes.map((node, index) => (
                <div key={`${depth}-${index}`}>
                    <div className="reader-mindmap-node reader-mindmap-leaf">
                        <MindMapNodeText node={node} displayMode={displayMode} />
                    </div>
                    <MindMapLeafList nodes={node.children || []} displayMode={displayMode} depth={depth + 1} />
                </div>
            ))}
        </div>
    );
};

const MindMapCanvas = ({ mindmap, displayMode = 'bilingual' }) => {
    if (!mindmap) return null;
    const branches = Array.isArray(mindmap.children) ? mindmap.children : [];
    return (
        <div className="reader-mindmap-scroll custom-scrollbar" data-reader-mindmap-canvas="true">
            <div className="reader-mindmap-canvas">
                <div className="reader-mindmap-node reader-mindmap-root">
                    <MindMapNodeText node={mindmap} displayMode={displayMode} isRoot={true} />
                </div>
                {branches.length > 0 && (
                    <div className="reader-mindmap-branches">
                        {branches.map((branch, index) => (
                            <div key={index} className="reader-mindmap-branch">
                                <div className="reader-mindmap-node reader-mindmap-branch-node">
                                    <MindMapNodeText node={branch} displayMode={displayMode} />
                                </div>
                                <MindMapLeafList nodes={branch.children || []} displayMode={displayMode} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const getMindMapBranchPaths = (node, nodePath = 'root') => {
    if (!node || !Array.isArray(node.children) || node.children.length === 0) return [];
    return [
        nodePath,
        ...node.children.flatMap((child, index) => getMindMapBranchPaths(child, `${nodePath}.${index}`))
    ];
};

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const updateMindMapNodeAtPath = (mindmap, nodePath, updater) => {
    const path = nodePath === 'root' ? [] : nodePath.split('.').slice(1).map(Number);
    const next = cloneJson(mindmap);
    let current = next;
    for (const index of path) {
        if (!current.children?.[index]) return next;
        current = current.children[index];
    }
    const updated = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
    Object.assign(current, updated);
    return next;
};

const removeMindMapNodeAtPath = (mindmap, nodePath) => {
    if (nodePath === 'root') return mindmap;
    const path = nodePath.split('.').slice(1).map(Number);
    const childIndex = path.pop();
    const next = cloneJson(mindmap);
    let parent = next;
    for (const index of path) {
        if (!parent.children?.[index]) return next;
        parent = parent.children[index];
    }
    if (Array.isArray(parent.children)) parent.children.splice(childIndex, 1);
    return next;
};

const MINDMAP_PREVIEW_DATA = {
    mindmap: {
        nameEn: 'How policy reshapes the fashion industry',
        nameZh: '政策如何重塑时尚产业',
        children: [
            {
                nameEn: 'Problem definition',
                nameZh: '问题界定',
                children: [
                    { nameEn: 'Industry standards', nameZh: '行业审美标准', children: [] },
                    { nameEn: 'Public health concern', nameZh: '公共健康担忧', children: [] }
                ]
            },
            {
                nameEn: 'Policy response',
                nameZh: '政策回应',
                children: [
                    { nameEn: 'Runway restrictions', nameZh: '秀场用人限制', children: [] },
                    { nameEn: 'Website regulation', nameZh: '网站内容监管', children: [] }
                ]
            },
            {
                nameEn: 'Likely consequences',
                nameZh: '潜在影响',
                children: [
                    { nameEn: 'Changing incentives', nameZh: '改变行业激励', children: [] },
                    { nameEn: 'Debate over enforcement', nameZh: '执行争议', children: [] }
                ]
            }
        ]
    }
};

export {
  LogicTreeNode,
  MindMapCanvas,
  getMindMapBranchPaths,
  cloneJson,
  updateMindMapNodeAtPath,
  removeMindMapNodeAtPath,
  MINDMAP_PREVIEW_DATA
};
