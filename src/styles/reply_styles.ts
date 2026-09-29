import {css} from 'lit';

/** Readable answer cards with live generation states and progressive disclosure. */
export const replyStyles = css`
  :host { display:flex; flex-direction:column; width:100%; min-width:0; --reply-muted:#64736f; --reply-line:#e2eae6; }
  svg { width:15px; height:15px; flex-shrink:0; pointer-events:none; }
  .message-bubble { display:flex; flex-direction:column; min-width:0; max-width:100%; position:relative; color:var(--ink); font-size:15px; line-height:1.65; overflow-wrap:anywhere; }
  .message-bubble.user { align-self:flex-end; max-width:88%; padding:6px 12px; margin-bottom:32px; border:1px solid #dceae3; border-radius:12px 12px 4px 12px; background:linear-gradient(135deg,#eef6f1,#e8f2ed); box-shadow:0 2px 8px #254c3e04; }
  .message-bubble.assistant { align-self:stretch; padding:14px 16px; border:1px solid transparent; border-radius:14px; background:linear-gradient(160deg,#fff 60%,#fbfdfc) padding-box, linear-gradient(130deg,#cde8dc,#dee5f3 48%,#e4ece7) border-box; box-shadow:0 3px 16px #183b2d05,0 1px 2px #183b2d03; }
  .message-bubble.assistant.is-streaming { box-shadow:0 3px 22px #3869510a,0 0 0 3px #6eba9707; }
  .message-sender { display:block; font-size:13px; line-height:1.3; font-weight:600; color:#254e42; }
  .response-header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
  .message-sender.assistant { min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
  .response-status { display:inline-flex; flex-shrink:0; align-items:center; gap:5px; border:1px solid #e3ebe7; border-radius:999px; padding:3px 8px; background:#f9fbfa; color:#65756c; font-size:10px; line-height:1.6; }
  .status-dot { width:4px; height:4px; border-radius:50%; background:#7c9b8a; }
  .response-status.live { color:#24685c; border-color:#c6e3d4; background:#edf7f1; }
  .response-status.live .status-dot { background:#3a9470; box-shadow:0 0 0 3px #69ae8c18; animation:breathing 1.6s infinite; }
  .response-status.error { color:#a64b3c; border-color:#eed8d1; background:#fff7f4; }
  .response-status.error .status-dot { background:#bb6958; }
  .response-status.cancelled { color:#6e7580; background:#f5f6f8; }
  .generation-track { height:2px; border-radius:2px; margin:-2px 0 10px; background:#e7f1eb; overflow:hidden; }
  .generation-track > span { display:block; height:100%; width:35%; background:linear-gradient(90deg,transparent,#59aa84,#869bda,transparent); animation:scanning 2.2s infinite ease-in-out; }
  .message-content { min-width:0; }
  .message-user-text { white-space:pre-wrap; }
  .thought-details { margin:0 0 10px; border:1px solid #e0eae5; border-radius:8px; background:linear-gradient(120deg,#f5f9f7,#f8f9fc); overflow:hidden; }
  .thought-summary { display:flex; align-items:center; gap:8px; padding:6px 10px; cursor:pointer; list-style:none; color:#466859; font-size:12px; line-height:1.5; font-weight:500; }
  .thought-summary::-webkit-details-marker { display:none; }
  .thought-summary:hover { background:#dfebe440; }
  .reasoning-icon { display:flex; align-items:center; justify-content:center; width:15px; height:15px; flex-shrink:0; color:#70a58e; }
  .thinking .reasoning-icon svg { animation:breathing 1.6s infinite ease-in-out; }
  .reasoning-hint { color:#6e7e75; font-size:10px; font-weight:400; margin-left:auto; white-space:nowrap; }
  .thought-summary > svg { width:12px; height:12px; color:#83958a; transition:transform .2s; }
  .thought-details[open] .thought-summary > svg { transform:rotate(90deg); }
  .thought-content { border-top:1px solid #e4ece7; padding:12px 14px; max-height:250px; overflow:auto; font-size:13px; color:#566760; line-height:1.7; font-style:normal; }
  .thought-content p { margin:0 0 10px; }
  .thought-content p:last-child { margin-bottom:0; }
  .thought-content ol, .thought-content ul { padding-left:20px; }
  .thought-content li + li { margin-top:6px; }
  .reply-prose > :first-child { margin-top:0; }
  .reply-prose > :last-child { margin-bottom:0; }
  .reply-prose p { margin:0 0 14px; }
  .reply-prose h1, .reply-prose h2, .reply-prose h3, .reply-prose h4 { font-family:var(--font-sans); color:#243d32; font-weight:600; line-height:1.4; letter-spacing:-.25px; margin:22px 0 10px; }
  .reply-prose h1 { font-size:23px; } .reply-prose h2 { font-size:20px; } .reply-prose h3 { font-size:17px; } .reply-prose h4 { font-size:15px; }
  .reply-prose strong { font-weight:600; color:#263c31; }
  .reply-prose ul, .reply-prose ol { padding-left:22px; margin:10px 0 16px; }
  .reply-prose li { padding-left:2px; } .reply-prose li + li { margin-top:7px; }
  .reply-prose li::marker { color:#61947d; }
  .reply-prose blockquote { border-left:2px solid #7bb097; border-radius:0 8px 8px 0; background:#f4f8f5; padding:12px 15px; margin:16px 0; color:#51655b; }
  .reply-prose blockquote p:last-child { margin-bottom:0; }
  .reply-prose hr { border:0; border-top:1px solid var(--reply-line); margin:20px 0; }
  .message-content a { color:var(--accent); text-underline-offset:3px; }
  .message-content a[href^='#source-'] { display:inline; color:#286b54; background:#edf6f0; border:1px solid #d5e9dc; border-radius:5px; padding:1px 5px; font:500 11px var(--font-mono); text-decoration:none; white-space:nowrap; }
  .message-content a[href^='#source-']:hover { background:#dcefe3; border-color:#a2cbb3; }
  .message-content code { font-family:var(--font-mono); font-size:.85em; border-radius:5px; padding:2px 5px; background:#eef3f0; color:#355d4b; }
  .message-content pre { background:#f6f8f7; border:1px solid var(--reply-line); padding:14px; border-radius:9px; margin:14px 0; overflow:auto; font-family:var(--font-mono); font-size:12px; line-height:1.65; }
  .message-content pre code { background:none; padding:0; border-radius:0; }
  .message-content document-code-block pre { margin:0; border:0; border-radius:0; }
  .reply-prose table { display:block; width:max-content; max-width:100%; overflow-x:auto; border-collapse:collapse; font-size:13px; line-height:1.5; margin:16px 0; }
  .reply-prose th, .reply-prose td { border:1px solid var(--reply-line); padding:9px 12px; text-align:left; }
  .reply-prose th { background:#f0f6f2; color:#365344; font-weight:600; }
  .answer-placeholder { margin:18px 0 6px; }
  .answer-placeholder > span { display:block; font-size:12px; color:var(--reply-muted); margin-bottom:14px; }
  .skeleton-line { height:8px; border-radius:8px; margin:10px 0; background:linear-gradient(90deg,#edf2ef,#f9fbfa,#edf2ef); background-size:200% 100%; animation:skeleton 1.8s infinite linear; }
  .skeleton-line:nth-of-type(2) { width:86%; } .skeleton-line:nth-of-type(3) { width:61%; }
  .evidence-section { margin-top:12px; padding:10px 0 0; border-top:1px solid var(--reply-line); }
  .evidence-heading { display:flex; justify-content:space-between; align-items:center; gap:8px; color:var(--reply-muted); font-size:11px; line-height:1.5; }
  .evidence-heading > span:first-child { display:flex; align-items:center; gap:6px; }
  .evidence-heading svg { width:12px; height:12px; }
  .reading-scope { min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:68%; font-size:10px; }
  .source-citations { display:flex; flex-wrap:wrap; gap:7px; margin-top:9px; }
  .source-citation { display:inline-flex; align-items:center; gap:7px; min-width:0; max-width:100%; border:1px solid #dbe8df; background:#f6faf7; border-radius:7px; padding:6px 9px; font-family:inherit; color:#536c5e; font-size:11px; line-height:1.6; text-align:left; cursor:pointer; transition:background .15s, border-color .15s; }
  .source-citation:hover { background:#e8f4ed; border-color:#a4cdb5; }
  .source-citation svg { width:11px; height:11px; color:#7da78e; }
  .source-citation-id { color:#2e6d4f; font:500 10px var(--font-mono); border-right:1px solid #d4e4d9; padding-right:7px; flex-shrink:0; }
  .source-citation-label { min-width:0; overflow-wrap:anywhere; }
  .response-notice { font-size:11px; color:var(--reply-muted); line-height:1.6; margin:10px 0 0; }
  .response-notice.error { color:#a14d3c; }
  .message-actions { display:flex; align-items:center; justify-content:flex-start; gap:4px; margin-top:10px; padding-top:6px; border-top:1px solid var(--reply-line); }
  .user .message-actions { position:absolute; top:100%; right:0; border:0; margin:0; padding-top:4px; transition:opacity .15s; }
  .action-control { position:relative; display:inline-flex; flex-shrink:0; }
  .btn-action { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; flex-shrink:0; border:1px solid transparent; background:transparent; color:#61736a; padding:0; border-radius:8px; cursor:pointer; transition:background .15s, color .15s; }
  .btn-action:hover:not(:disabled) { color:#286950; background:#ecf5ef; border-color:#dceadf; }
  .btn-action:disabled { opacity:.45; cursor:default; }
  .btn-action.copied, .btn-action.active { color:#286950; background:#edf6ef; }
  .btn-action.failed { color:#a14d3c; }
  .btn-action svg { width:17px; height:17px; }
  .action-tooltip { position:absolute; z-index:5; top:calc(100% + 6px); left:50%; transform:translate(-50%,-3px); opacity:0; visibility:hidden; pointer-events:none; padding:6px 9px; border:1px solid #dfe7e2; border-radius:7px; background:#fff; color:#40594d; box-shadow:0 3px 12px #203c3012; font-size:11px; font-weight:500; line-height:1.4; white-space:nowrap; transition:opacity .12s,transform .12s; }
  .action-control:hover .action-tooltip, .action-control:focus-within .action-tooltip { opacity:1; visibility:visible; transform:translate(-50%,0); }
  .user-actions .action-control:nth-child(2) .action-tooltip { left:auto; right:0; transform:translateY(-3px); }
  .user-actions .action-control:nth-child(2):hover .action-tooltip, .user-actions .action-control:nth-child(2):focus-within .action-tooltip { transform:translateY(0); }
  .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
  .response-details-panel { margin-top:12px; padding:14px; border:1px solid #e0e9e3; border-radius:10px; background:#f7faf8; }
  .response-details-panel h4 { margin:0 0 13px; color:#466859; font-size:12px; line-height:1.4; font-weight:600; }
  .response-details-panel > p { margin:0; color:var(--reply-muted); font-size:12px; line-height:1.6; }
  .message-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin:0; }
  .message-stats > div { min-width:0; }
  .message-stats dt { font-size:10px; color:var(--reply-muted); margin-bottom:3px; line-height:1.4; }
  .message-stats dd { margin:0; color:#355c47; font:500 12px var(--font-mono); line-height:1.5; overflow-wrap:anywhere; }
  .source-citation:focus-visible, .message-content a:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
  @keyframes breathing { 0%,100% { opacity:.4; } 50% { opacity:1; } }
  @keyframes scanning { 0% { transform:translateX(-100%); } 100% { transform:translateX(380%); } }
  @keyframes skeleton { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }
  @media (hover:hover) and (pointer:fine) {
    .user .message-actions { opacity:0; pointer-events:none; }
    .user:hover .message-actions, .user:focus-within .message-actions { opacity:1; pointer-events:auto; }
  }
  @media (max-width:580px) {
    .message-bubble.assistant { padding:12px; border-radius:12px; font-size:14px; }
    .message-bubble.user { padding:6px 11px; font-size:14px; max-width:92%; margin-bottom:44px; }
    .user .message-actions { opacity:1; pointer-events:auto; }
    .btn-action { width:40px; height:40px; }
    .action-tooltip { top:auto; bottom:calc(100% + 6px); }
    .response-header { margin-bottom:8px; gap:7px; }
    .message-sender { font-size:12px; }
    .response-status { font-size:9px; padding:3px 6px; }
    .thought-summary { padding:6px 9px; gap:6px; font-size:11px; }
    .reasoning-hint { font-size:9px; }
    .thought-content { padding:11px; font-size:12px; }
    .reply-prose h1 { font-size:21px; } .reply-prose h2 { font-size:18px; }
  }
  @media (hover:none), (pointer:coarse) { .btn-action { width:40px; height:40px; } .message-bubble.user { margin-bottom:44px; } }
  @media (prefers-reduced-motion:reduce) { *, *::before, *::after { animation:none !important; transition:none !important; } }
`;
