import {css} from 'lit';

/** Layout and visual hierarchy for the reading workspace and welcome page. */
export const workspaceStyles = css`
  :host { display:flex; flex-direction:column; width:100%; height:100%; min-height:0; overflow:hidden; color:var(--ink); }
  [hidden] { display:none !important; }
  button, input { font:inherit; }
  button { cursor:pointer; }
  button:disabled { cursor:default; opacity:.5; }
  button:focus-visible, summary:focus-visible, [tabindex]:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
  .topbar { flex:0 0 var(--topbar-h); display:flex; align-items:center; justify-content:space-between; gap:16px; padding:0 28px; background:var(--surface); border-bottom:1px solid var(--line); z-index:20; }
  .topbar-left, .topbar-right, .brand-group { display:flex; align-items:center; gap:16px; min-width:0; }
  .topbar-right { flex-shrink:0; gap:12px; }
  .brand { margin:0; font-family:var(--font-serif); font-size:23px; font-weight:600; letter-spacing:-.7px; white-space:nowrap; }
  .brand-dot { color:var(--accent); }
  .brand-description { color:var(--ink-muted); font-size:13px; }
  .brand-divider { height:18px; width:1px; background:var(--line); }
  .icon-button { display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; padding:0; flex-shrink:0; border:1px solid transparent; border-radius:8px; background:transparent; color:var(--ink-muted); font-size:16px; }
  .icon-button:hover { background:var(--bg); color:var(--ink); border-color:var(--line); }
  .topbar-status-badge { display:flex; align-items:center; gap:7px; padding:6px 10px; border:0; border-radius:7px; color:var(--ink-muted); background:transparent; font-size:12px; white-space:nowrap; }
  .topbar-status-badge:hover { background:var(--bg); }
  .topbar-status-dot, .privacy-dot, .context-dot { width:6px; height:6px; border-radius:50%; background:var(--accent); display:inline-block; flex-shrink:0; }
  .topbar-status-dot.idle { background:#8b958e; }
  .topbar-status-dot.error { background:var(--danger); }
  .topbar-status-dot.loading { background:#b98933; animation:pulse 1.5s infinite; }
  .file-btn { position:relative; display:inline-flex; align-items:center; justify-content:center; gap:22px; padding:11px 20px; min-height:42px; border:1px solid var(--accent); border-radius:9px; background:var(--accent); color:white; font-size:14px; font-weight:600; text-transform:none; letter-spacing:0; cursor:pointer; transition:background .15s; }
  .file-btn:hover { background:var(--accent-hover); }
  .file-btn:focus-within { outline:2px solid var(--accent); outline-offset:3px; }
  .file-btn:has(input:disabled) { opacity:.5; cursor:default; }
  .file-btn input { position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:inherit; }
  .file-btn-secondary { background:var(--surface); color:var(--ink); border-color:var(--line); min-height:36px; padding:7px 13px; font-size:13px; }
  .file-btn-secondary:hover { background:var(--accent-soft); border-color:var(--accent); }
  .welcome { flex:1; min-height:0; overflow-y:auto; padding:42px 40px 24px; }
  .welcome-content { max-width:1120px; margin:auto; }
  .welcome-heading { margin:0 0 30px; }
  .eyebrow { display:flex; gap:8px; align-items:center; color:var(--accent); font-size:12px; font-weight:600; letter-spacing:.02em; }
  .welcome-heading h2 { font-family:var(--font-serif); font-weight:400; font-size:clamp(34px, 3.5vw, 48px); line-height:1.12; letter-spacing:-1.5px; margin:15px 0 13px; }
  .welcome-heading h2 br { display:none; }
  .welcome-heading > p { color:var(--ink-muted); font-size:16px; line-height:1.6; margin:0; }
  .welcome-grid { display:grid; grid-template-columns:1.3fr 1fr; gap:20px; }
  .upload-card { display:flex; align-items:center; flex-direction:column; justify-content:center; padding:28px; border:1px dashed #b5c9bf; border-radius:16px; background:var(--surface); min-height:280px; text-align:center; transition:background .15s, border-color .15s; }
  .upload-card.dragging, .document-empty.dragging { background:var(--accent-soft); border-color:var(--accent); }
  .upload-icon { width:52px; height:52px; background:var(--accent-soft); border-radius:14px; display:grid; place-items:center; color:var(--accent); margin-bottom:16px; }
  .upload-icon svg { width:28px; height:28px; }
  .upload-card h3 { font-size:19px; font-weight:600; margin:0 0 8px; letter-spacing:-.3px; }
  .upload-card > p { margin:0 0 20px; font-size:14px; color:var(--ink-muted); line-height:1.6; }
  .upload-card small { margin-top:14px; font-size:12px; color:var(--ink-muted); }
  .workflow-card { border-radius:16px; background:#eaf0eb; padding:26px 28px; }
  .workflow-steps { list-style:none; padding:0; margin:24px 0 0; display:flex; flex-direction:column; gap:23px; }
  .workflow-steps li { display:flex; gap:15px; align-items:flex-start; }
  .step-number { color:#6b8b78; font-family:var(--font-mono); font-size:11px; padding-top:3px; }
  .workflow-steps h3 { font-size:15px; font-weight:600; margin:0 0 4px; }
  .workflow-steps p { font-size:13px; color:#5c7063; margin:0; line-height:1.5; }
  .recent-section { margin-top:28px; }
  .section-heading { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; }
  .section-heading h3 { font-size:15px; font-weight:600; margin:0; letter-spacing:-.15px; }
  .text-button { background:none; border:0; padding:4px 0; color:var(--accent); font-size:12px; }
  .text-button:hover { text-decoration:underline; }
  .recent-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .recent-card { display:flex; gap:13px; align-items:center; text-align:left; padding:14px 16px; min-width:0; border:1px solid var(--line); border-radius:11px; background:var(--surface); color:var(--ink); }
  .recent-card:hover { border-color:#9bb9aa; }
  .recent-icon { width:34px; height:38px; display:grid; place-items:center; background:var(--bg); border-radius:6px; color:var(--accent); flex-shrink:0; }
  .recent-icon svg { width:21px; height:21px; }
  .recent-copy { min-width:0; flex:1; }
  .recent-copy strong { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:14px; font-weight:600; }
  .recent-copy small { display:block; font-size:12px; margin-top:3px; color:var(--ink-muted); }
  .card-arrow { color:#89958b; }
  .recent-empty { font-size:13px; color:var(--ink-muted); padding:16px 0; border-block:1px solid var(--line); margin:0; }
  .example-library { margin-top:27px; }
  .section-caption { color:var(--ink-muted); font-size:12px; }
  .example-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
  .example-card { display:flex; flex-direction:column; gap:0; padding:17px 16px; min-height:145px; border:1px solid var(--line); background:var(--surface); border-radius:11px; text-align:left; color:var(--ink); font:inherit; transition:transform .15s, border-color .15s; }
  .example-card:hover:not(:disabled) { border-color:#9bb9aa; transform:translateY(-2px); }
  .example-type { display:flex; align-items:center; justify-content:space-between; font-size:10px; letter-spacing:.04em; color:var(--accent); margin-bottom:13px; font-weight:600; }
  .example-type span { font-size:15px; }
  .example-card strong { font-size:14px; font-weight:600; line-height:1.35; margin-bottom:7px; }
  .example-card > span:not(.example-type) { font-size:11px; color:var(--ink-muted); margin-top:auto; }
  .example-card small { font-size:11px; color:var(--ink-muted); line-height:1.4; margin-top:5px; }
  .welcome-footer { margin-top:24px; display:flex; gap:12px; justify-content:space-between; align-items:center; color:var(--ink-muted); font-size:12px; }
  .workspace { flex:1; min-height:0; display:grid; grid-template-columns:minmax(360px, min(var(--reading-width,60%), calc(100% - 354px))) 12px minmax(0,1fr); overflow:hidden; padding:20px 24px 22px; }
  .workspace.resizing { user-select:none; cursor:col-resize; }
  .pane { display:flex; flex-direction:column; overflow:hidden; min-width:0; min-height:0; }
  .pane-document { padding:0 12px 0 0; }
  .pane-header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; flex-shrink:0; }
  .document-heading { display:flex; align-items:center; gap:11px; min-width:0; }
  .document-heading > div { min-width:0; }
  .document-symbol { width:36px; height:42px; display:grid; place-items:center; color:var(--accent); border:1px solid var(--line); border-radius:7px; background:var(--surface); flex-shrink:0; }
  .document-symbol svg { width:22px; height:22px; }
  .document-name { font-size:16px; font-weight:600; margin:0 0 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pane-meta { margin:0; font-size:12px; color:var(--ink-muted); }
  .document-footnote { font-size:11px; color:var(--ink-muted); padding:8px 4px 0; margin:0; line-height:1.4; flex-shrink:0; }
  .splitter { display:flex; justify-content:center; align-items:center; cursor:col-resize; touch-action:none; border-radius:6px; }
  .splitter span { width:3px; height:36px; border-radius:2px; background:#d3d8d1; transition:background .15s; }
  .splitter:hover span, .splitter:focus-visible span { background:var(--accent); }
  .pane-ai { margin-left:12px; background:var(--surface); border:1px solid var(--line); border-radius:15px; }
  .assistant-header { display:flex; justify-content:space-between; align-items:center; gap:12px; min-height:45px; padding:0 16px; border-bottom:1px solid var(--line); flex-shrink:0; }
  .assistant-header h2 { min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-family:var(--font-serif); font-size:17px; line-height:1.3; font-weight:400; letter-spacing:-.25px; margin:0; }
  .assistant-tabs { display:flex; align-self:stretch; gap:16px; min-width:0; flex-shrink:0; }
  .assistant-tabs button { display:flex; align-items:center; gap:8px; min-height:44px; border:0; border-bottom:2px solid transparent; background:transparent; color:var(--ink-muted); font-size:13px; line-height:1.4; font-weight:500; padding:8px 0; }
  .assistant-tabs button[aria-selected='true'] { color:var(--accent); border-bottom-color:var(--accent); font-weight:600; }
  .context-panel { margin:12px 16px 0; border:1px solid var(--line); background:#f6f8f5; border-radius:8px; flex-shrink:0; max-height:30vh; overflow:auto; }
  .context-panel > summary { display:flex; gap:7px; align-items:center; padding:10px 11px; list-style:none; cursor:pointer; font-size:12px; color:#597263; }
  .context-panel > summary::-webkit-details-marker { display:none; }
  .context-percent { margin-left:auto; font-size:11px; white-space:nowrap; color:var(--ink-muted); }
  .context-percent > span { margin-left:5px; }
  .context-warning { background:#fff8eb; border-color:#dcc49c; }
  .context-warning .context-dot { background:#b98933; }
  .context-details { padding:1px 12px 12px; }
  .context-heading { display:flex; gap:10px; justify-content:space-between; color:var(--ink-muted); font-size:11px; }
  .context-panel progress { width:100%; height:5px; margin:8px 0; accent-color:var(--accent); }
  .context-panel small { display:block; font-size:11px; line-height:1.6; color:var(--ink-muted); }
  .qa-block { flex:1; min-height:0; display:flex; flex-direction:column; }
  document-chat-window { display:flex; flex:1; min-height:0; }
  .summary-block { flex:1; min-height:0; display:flex; flex-direction:column; padding:22px; gap:16px; }
  .summary-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
  .summary-header h3 { font-size:14px; font-weight:600; margin:0; }
  .btn-summarize { font-size:12px; padding:8px 12px; }
  .summary-scroll { flex:1; overflow-y:auto; min-height:0; }
  .summary-body { font-size:15px; line-height:1.75; overflow-wrap:anywhere; }
  .summary-body p { margin:0 0 14px; }
  .summary-body ul, .summary-body ol { padding-left:20px; }
  .summary-body h1, .summary-body h2, .summary-body h3 { font-size:18px; line-height:1.5; }
  .summary-body a[href^='#source-'] { color:var(--accent); background:var(--accent-soft); border-radius:4px; padding:1px 4px; }
  .summary-empty { padding:50px 10px 20px; text-align:center; }
  .summary-illustration { display:grid; place-items:center; width:64px; height:72px; background:var(--bg); border:1px solid var(--line); border-radius:10px; color:#8da391; font-size:40px; margin:0 auto 20px; }
  .summary-empty h3 { font-family:var(--font-serif); font-size:23px; font-weight:400; line-height:1.35; margin:0 0 12px; }
  .summary-empty p { font-size:14px; color:var(--ink-muted); line-height:1.6; max-width:290px; margin:auto; }
  .source-links { display:flex; flex-wrap:wrap; gap:6px; margin:16px 0; }
  .source-links button { border:1px solid var(--line); border-radius:6px; padding:5px 8px; color:var(--accent); background:var(--surface); font-size:11px; }
  .source-links button:hover { background:var(--accent-soft); }
  .document-empty { flex:1; min-height:0; overflow:auto; display:flex; flex-direction:column; gap:16px; justify-content:center; align-items:center; padding:30px; border:1px dashed var(--line); border-radius:12px; background:var(--surface); text-align:center; }
  .document-empty > svg { width:40px; color:#93a99a; }
  .document-empty h3 { font-size:20px; font-weight:500; margin:0; }
  .document-empty p { font-size:14px; color:var(--ink-muted); max-width:320px; margin:0; line-height:1.6; }
  .inline-examples { width:100%; font-size:13px; color:var(--accent); }
  .inline-examples summary { cursor:pointer; }
  .compact .example-grid { grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); }
  .compact .example-card { min-height:115px; }
  .text-note { font-size:12px; color:var(--ink-muted); line-height:1.5; }
  .error-note { color:var(--danger) !important; font-size:13px; line-height:1.5; }
  .loading-bar { display:block; width:120px; height:4px; border-radius:3px; overflow:hidden; background:var(--accent-soft); }
  .loading-bar::after { content:''; display:block; width:40%; height:100%; background:var(--accent); animation:loading 1.3s infinite ease-in-out; }
  .summary-streaming-indicator { display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--accent); animation:pulse 1.4s infinite; }
  .sidebar-overlay { position:fixed; inset:0; background:#24272440; z-index:999; backdrop-filter:blur(3px); opacity:0; pointer-events:none; transition:opacity .2s; }
  .sidebar-overlay.open { opacity:1; pointer-events:auto; }
  .sidebar { position:fixed; top:0; left:0; bottom:0; width:340px; max-width:90vw; z-index:1000; background:var(--surface); border-right:1px solid var(--line); padding:22px; transform:translateX(-100%); transition:transform .2s; display:flex; flex-direction:column; overflow:hidden; }
  .sidebar.open { transform:translateX(0); box-shadow:12px 0 40px #24272420; }
  .drawer-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:22px; }
  .drawer-title { font-size:18px; font-weight:600; margin:0; }
  document-sidebar { flex:1; min-height:0; overflow:hidden; }
  .preview-overlay { position:fixed; inset:0; background:#242724; z-index:9999; flex-direction:column; }
  .preview-overlay iframe { width:100%; height:100%; border:none; background:white; }
  .btn-close-preview { position:absolute; top:16px; right:24px; background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:8px 16px; color:var(--ink); z-index:10000; }
  .mobile-switch { display:none; }
  @keyframes pulse { 0%,100% { opacity:.3; } 50% { opacity:1; } }
  @keyframes loading { 0% { transform:translateX(-100%); } 100% { transform:translateX(350%); } }
  @media (max-width:1100px) {
    .welcome { padding:32px 28px 24px; }
    .welcome-grid { grid-template-columns:1.2fr 1fr; }
    .workflow-card { padding:25px 22px; }
    .example-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
    .workspace { padding:16px; }
    .assistant-header { padding:0 14px; }
    .brand-description, .brand-divider { display:none; }
  }
  @media (max-width:860px) {
    .topbar { padding:0 20px; }
    .mobile-switch { display:flex; margin:12px 20px 0; padding:4px; border-radius:9px; background:#e9ece5; flex-shrink:0; }
    .mobile-switch button { flex:1; background:transparent; color:var(--ink-muted); border:0; padding:8px; border-radius:6px; font-size:13px; }
    .mobile-switch button[aria-pressed='true'] { background:var(--surface); color:var(--accent); box-shadow:0 1px 3px #24272410; font-weight:600; }
    .workspace { display:flex; padding:14px 20px 16px; }
    .pane { display:none; flex:1; }
    .pane.mobile-active { display:flex; }
    .pane-document { padding:0; }
    .pane-ai { margin:0; }
    .splitter { display:none; }
    .welcome-grid { grid-template-columns:1fr 1fr; gap:14px; }
    .upload-card { padding:24px 18px; }
    .upload-card h3 { font-size:17px; }
    .workflow-card { padding:24px 18px; }
    .workflow-steps { gap:20px; }
    .workflow-steps h3 { font-size:14px; }
    .context-panel { max-height:25vh; }
  }
  @media (max-width:580px) {
    .topbar { padding:0 14px; gap:8px; }
    .topbar-left { gap:9px; }
    .brand { font-size:21px; }
    .topbar-right { gap:6px; }
    .topbar-status-badge { font-size:11px; padding:5px 4px; }
    .topbar:has(.file-btn) .topbar-status-badge { display:none; }
    .file-btn-secondary { padding:7px 10px; font-size:12px; }
    .welcome { padding:28px 20px 22px; }
    .welcome-heading { margin-bottom:23px; }
    .welcome-heading h2 { font-size:36px; letter-spacing:-1px; }
    .welcome-heading h2 br { display:block; }
    .welcome-heading > p { font-size:14px; }
    .welcome-grid { grid-template-columns:1fr; }
    .upload-card { min-height:260px; padding:26px 18px; }
    .workflow-card { padding:22px; }
    .workflow-steps { gap:18px; margin-top:18px; }
    .recent-grid { grid-template-columns:1fr; }
    .section-heading { align-items:baseline; }
    .section-caption { display:none; }
    .example-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .example-card { padding:14px; min-height:140px; }
    .welcome-footer { flex-direction:column; align-items:flex-start; gap:8px; line-height:1.5; }
    .workspace { padding:12px 12px 14px; }
    .mobile-switch { margin:10px 12px 0; }
    .pane-header { margin-bottom:12px; }
    .assistant-header { padding:0 12px; }
    .assistant-header h2 { display:none; }
    .summary-block { padding:18px; }
    .document-footnote { font-size:10px; }
  }
  @media (max-width:360px) { .welcome-heading h2 { font-size:30px; } }
  @media (prefers-reduced-motion:reduce) { *, *::before, *::after { animation:none !important; transition:none !important; } }
`;
