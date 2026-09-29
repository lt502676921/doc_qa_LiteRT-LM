/**
 * Copyright 2026 The ODML Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {css} from 'lit';

/** Shared CSS styles for the chat components. */
export const sharedStyles = css`
  * {
    box-sizing: border-box;
  }

  label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: none;
    letter-spacing: 0;
  }

  select, input[type="number"], input[type="text"], textarea {
    background-color: var(--page);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--ink);
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    font-family: inherit;
  }

  select:focus, input:focus, textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }

  [hidden] { display: none !important; }

  button:focus-visible, summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  /* Base buttons */
  .icon-spin { animation: icon-spin 1s linear infinite; }
  @keyframes icon-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .icon-spin { animation: none; } }

  .btn {
    font-weight: 600;
    padding: 10px 18px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: inherit;
  }

  .btn-primary {
    background-color: var(--accent);
    color: #ffffff;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--accent-hover);
  }

  .btn-stop {
    background-color: #c53030 !important;
    color: #ffffff !important;
  }

  .btn-stop:hover {
    background-color: #9b2c2c !important;
  }

  .btn-secondary {
    background-color: rgba(28, 27, 22, 0.05);
    border: 1px solid var(--border);
    color: var(--ink);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: rgba(28, 27, 22, 0.1);
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* Custom subtle scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(28, 27, 22, 0.15);
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(28, 27, 22, 0.28);
  }
`;
